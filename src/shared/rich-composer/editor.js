/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The shared Lexical integration behind Converse's rich composers.
 *
 * **Every Lexical import lives in this module and its callers' config modules**, which
 * composers load with a dynamic `import()` on first focus, so the whole editor is split
 * into its own chunk and stays out of Converse's core bundle. Nothing here may be
 * imported statically from a composer (see {@link ./triggers.js} for the constants that
 * composers *do* need eagerly).
 *
 * Consumers serialize to different wire formats. The Social composer publishes
 * GitHub-flavoured Markdown, while chat sends XEP-0393 message styling.
 * The transformer sets are therefore injected rather than baked in.
 *
 * Note that input and output are separate sets. Lexical uses transformers both for
 * typing shortcuts and for serialization, but the two need not agree. That separation is
 * what lets every composer share one typing experience even though the generated wire
 * format differs. Since the editor is WYSIWYG, the differing output is invisible to the
 * user.
 *
 * Exposes a small, framework-agnostic handle so Lit components never touch Lexical
 * internals directly.
 */
import {
    $createTextNode,
    $getRoot,
    $getSelection,
    $isRangeSelection,
    $isTextNode,
    createEditor,
    FORMAT_TEXT_COMMAND,
} from 'lexical';
import { registerRichText } from '@lexical/rich-text';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { $generateHtmlFromNodes } from '@lexical/html';
import { $createLinkNode } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
import { $convertFromMarkdownString, $convertToMarkdownString, registerMarkdownShortcuts } from '@lexical/markdown';

/**
 * If the collapsed caret sits right after `regex`'s trigger token, return the typed
 * query (the regex's first capture), else `null`. Must run inside an editor state read.
 * @param {RegExp} regex
 * @returns {string|null}
 */
function $getTriggerQuery(regex) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;

    const node = selection.anchor.getNode();
    if (!$isTextNode(node)) return null;

    const before = node.getTextContent().slice(0, selection.anchor.offset);
    return before.match(regex)?.[1] ?? null;
}

/**
 * Locate the trigger token ending at the collapsed caret, returning the text node and
 * the offsets it spans, or `null` if the caret has since moved off it. Must run inside
 * an editor update.
 * @param {string} trigger - The full trigger text, e.g. `:smile` or `@alice`.
 */
function $getTriggerRange(trigger) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;

    const node = selection.anchor.getNode();
    if (!$isTextNode(node)) return null;

    const end = selection.anchor.offset;
    if (!node.getTextContent().slice(0, end).endsWith(trigger)) return null;

    return { node, start: end - trigger.length, end };
}

/**
 * Attach a Lexical rich-text editor to `rootEl` and return a small handle.
 * @param {HTMLElement} rootEl - A `contenteditable` host element.
 * @param {import('./types').RichEditorOptions} opts
 * @returns {import('./types').RichEditor}
 */
export function createRichEditor(
    rootEl,
    {
        namespace = 'converse-rich-composer',
        nodes = [],
        theme = {},
        transformers,
        input_transformers,
        html_export,
        onChange,
    },
) {
    const editor = createEditor({
        namespace,
        nodes,
        theme,
        ...(html_export ? { html: { export: html_export } } : {}),
        onError: (e) => {
            // Surface Lexical's internal errors rather than swallowing them.
            throw e;
        },
    });
    editor.setRootElement(rootEl);

    const cleanup = mergeRegister(
        registerRichText(editor),
        registerHistory(editor, createEmptyHistoryState(), 1000),
        registerMarkdownShortcuts(editor, input_transformers ?? transformers),
        onChange ? editor.registerUpdateListener(() => onChange()) : () => {},
    );

    return {
        editor,

        /** Serialize the document through the output transformers. */
        getMarkdown: () => editor.getEditorState().read(() => $convertToMarkdownString(transformers)),

        /**
         * Replace the document with `text`, parsed through the same output transformers.
         * Used to restore a draft or load a message being corrected.
         *
         * Committed discretely, so callers can read the document straight back rather than
         * waiting for Lexical's normal (asynchronous) reconciliation.
         * @param {string} text
         */
        setMarkdown: (text) =>
            editor.update(
                () => {
                    $convertFromMarkdownString(text ?? '', transformers);
                    // Leave the caret at the end, where someone loading a draft or a message
                    // to correct would carry on typing. Without this the document has no
                    // selection at all, and nothing can tell where the caret notionally is.
                    $getRoot().selectEnd();
                },
                { discrete: true },
            ),

        /** Serialize the document to HTML (normalised to XHTML by the caller, if needed). */
        getHtml: () => editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null)),

        isEmpty: () => editor.getEditorState().read(() => $getRoot().getTextContent().trim().length === 0),

        // Discrete, like setMarkdown: callers routinely insert and then read the document
        // straight back (the composer serializes it to send), and Lexical's default
        // asynchronous commit would hand them the state from before the insert.
        insertText: (text) =>
            editor.update(
                () => {
                    let selection = $getSelection();
                    if (!$isRangeSelection(selection)) {
                        // Focus may sit elsewhere (e.g. an emoji picker) so there is no live
                        // range selection: fall back to appending at the very end.
                        $getRoot().selectEnd();
                        selection = $getSelection();
                    }
                    if ($isRangeSelection(selection)) selection.insertText(text);
                },
                { discrete: true },
            ),

        /** Toggle an inline format on the selection: 'bold' | 'italic' | 'strikethrough' | 'code'. */
        format: (type) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, type),

        /**
         * Whether a collapsed caret sits at the very start of the document. Stands in for
         * a textarea's `selectionEnd === 0`, which a contenteditable has no equivalent of.
         * An empty document counts as both start and end.
         */
        isCaretAtStart: () =>
            editor.getEditorState().read(() => {
                // An untouched editor has no selection at all, and an empty document has
                // nowhere else for the caret to be.
                if ($getRoot().getTextContent().length === 0) return true;
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
                if (selection.anchor.offset !== 0) return false;
                const first = $getRoot().getFirstDescendant();
                return first === null || selection.anchor.getNode().is(first);
            }),

        /** Whether a collapsed caret sits at the very end of the document. */
        isCaretAtEnd: () =>
            editor.getEditorState().read(() => {
                if ($getRoot().getTextContent().length === 0) return true;
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
                const last = $getRoot().getLastDescendant();
                if (last === null) return true;
                const node = selection.anchor.getNode();
                return node.is(last) && selection.anchor.offset === node.getTextContent().length;
            }),

        /**
         * If the collapsed caret sits right after `regex`'s trigger token, return the
         * typed query, else `null`. Drives a composer's inline typeahead; see
         * {@link ./triggers.js} for the shared patterns.
         * @param {RegExp} regex
         */
        getTriggerQuery: (regex) => editor.getEditorState().read(() => $getTriggerQuery(regex)),

        /**
         * Replace the trigger token immediately before the caret with `replacement`
         * (e.g. a resolved emoji glyph). A no-op if the caret has since moved off the
         * trigger. The caret ends up just after the replacement.
         * @param {string} trigger - The full trigger text, e.g. `:smile`.
         * @param {string} replacement
         */
        replaceTrigger: (trigger, replacement) =>
            editor.update(() => {
                const range = $getTriggerRange(trigger);
                if (!range) return;
                range.node.spliceText(range.start, trigger.length, replacement, true);
            }),

        /**
         * Replace the trigger token immediately before the caret with a link (`text`
         * linking to `url`), followed by a space. Serialized by a LINK transformer as
         * `[text](url)`, so only formats that have link syntax should use this. A no-op
         * if the caret has since moved off the trigger.
         * @param {string} trigger - The full trigger text, e.g. `@alice`.
         * @param {string} text - The link's text, e.g. `@Alice`.
         * @param {string} url - The link's target, e.g. `xmpp:alice@example.org`.
         */
        replaceTriggerWithLink: (trigger, text, url) =>
            editor.update(() => {
                const range = $getTriggerRange(trigger);
                if (!range) return;

                // Isolate the trigger's text node, then swap it for the link.
                const parts = range.node.splitText(range.start, range.end);
                const target = parts[range.start === 0 ? 0 : 1];
                const link = $createLinkNode(url);

                link.append($createTextNode(text));
                target.replace(link);

                const space = $createTextNode(' ');
                link.insertAfter(space);
                space.select(1, 1);
            }),

        clear: () =>
            editor.update(
                () => {
                    $getRoot().clear();
                },
                { discrete: true },
            ),

        /** Put the caret at the very start, as arrowing up does in a real browser. */
        selectStart: () => editor.update(() => $getRoot().selectStart(), { discrete: true }),

        focus: () => editor.focus(),

        destroy: () => {
            cleanup();
            editor.setRootElement(null);
        },
    };
}
