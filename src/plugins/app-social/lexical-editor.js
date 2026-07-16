/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * Lexical integration for the rich Social composer.
 *
 * **Every Lexical import lives in this one module**, which the composer loads with a dynamic
 * `import()` on first focus, so the whole editor is split into its own chunk and stays out
 * of Converse's core bundle.
 *
 * Exposes a tiny, framework-agnostic handle so the Lit component never touches
 * Lexical internals directly:
 *   createSocialEditor(rootEl) → { getMarkdown, getHtml, isEmpty, insertText,
 *                                  format, clear, focus, destroy }
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
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { $generateHtmlFromNodes } from '@lexical/html';
import { $createLinkNode, LinkNode } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
import {
    $convertToMarkdownString,
    BOLD_ITALIC_STAR,
    BOLD_ITALIC_UNDERSCORE,
    BOLD_STAR,
    BOLD_UNDERSCORE,
    HEADING,
    INLINE_CODE,
    ITALIC_STAR,
    ITALIC_UNDERSCORE,
    LINK,
    QUOTE,
    STRIKETHROUGH,
    registerMarkdownShortcuts,
} from '@lexical/markdown';

// A curated transformer set: the inline styles and blocks a social post needs,
// serialized as standard (GitHub-flavoured-compatible) Markdown so Movim reads
// the `<content type="text">` we publish. Lists and fenced code blocks are left
// out for now (they need extra nodes/packages); images will be a
// TEXT_MATCH transformer later. Mentions are plain LinkNodes (`[@Name](xmpp:jid)`
// via LINK), so an XMPP client renders them as profile links and the renostr
// bridge can translate them to NIP-27 `nostr:` mentions.
const TRANSFORMERS = [
    HEADING,
    QUOTE,
    BOLD_ITALIC_STAR,
    BOLD_ITALIC_UNDERSCORE,
    BOLD_STAR,
    BOLD_UNDERSCORE,
    ITALIC_STAR,
    ITALIC_UNDERSCORE,
    STRIKETHROUGH,
    INLINE_CODE,
    LINK,
];

// An emoji-shortname autocomplete trigger: a `:` that starts a token (at the very
// start of the text node, or right after whitespace) followed by at least one
// shortname character. Capture group 1 is the typed query (the chars after the
// colon). A closing `:` ends the token, so a completed `:smile:` no longer matches.
const EMOJI_TRIGGER = /(?:^|\s):([-+\w]+)$/;

// A mention autocomplete trigger: an `@` that starts a token, followed by zero or
// more name/JID characters (so a bare `@` lists the whole follow list). `@` and `.`
// are in the charset so a full JID can be typed; `:` is not, so the two triggers
// are mutually exclusive.
const MENTION_TRIGGER = /(?:^|\s)@([\w.@-]*)$/;

/**
 * If the collapsed caret sits right after `regex`'s trigger token, return the
 * typed query (the regex's first capture), else `null`. Must run inside an
 * editor state read.
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

// Class names Lexical stamps onto its DOM for styling hooks. Kept minimal; these
// are editor-only and get stripped from the published XHTML (see the composer's
// htmlToXhtml normaliser), so they never reach the wire.
const THEME = {
    heading: {
        h1: 'social-rich__h1',
        h2: 'social-rich__h2',
        h3: 'social-rich__h3',
    },
    quote: 'social-rich__quote',
    link: 'social-rich__link',
    text: {
        bold: 'social-rich__bold',
        italic: 'social-rich__italic',
        strikethrough: 'social-rich__strike',
        code: 'social-rich__code',
    },
};

/**
 * Attach a Lexical rich-text editor to `rootEl` and return a small handle.
 * @param {HTMLElement} rootEl - A `contenteditable` host element.
 * @param {object} [opts]
 * @param {() => void} [opts.onChange] - Called after each edit (e.g. to toggle a
 *      disabled Post button). Kept optional so the caller can avoid per-keystroke
 *      re-renders.
 * @returns {import('./types.ts').LexicalEditor}
 */
export function createSocialEditor(rootEl, { onChange } = {}) {
    const editor = createEditor({
        namespace: 'converse-social-compose',
        nodes: [HeadingNode, QuoteNode, LinkNode],
        theme: THEME,
        html: {
            export: new Map([
                [
                    // LinkNode's own DOM export whitelists http(s)/mailto/sms/tel and
                    // rewrites every other scheme (so our xmpp: mention URIs) to
                    // about:blank. Export links with the raw URL instead; the composer
                    // runs the exported HTML through DOMPurify (whose URI allowlist
                    // includes xmpp:) before anything reaches the wire.
                    LinkNode,
                    (_editor, /** @type {LinkNode} */ node) => {
                        const element = document.createElement('a');
                        element.href = node.getURL();
                        const title = node.getTitle();
                        if (title) element.title = title;
                        return { element };
                    },
                ],
            ]),
        },
        onError: (e) => {
            // Surface Lexical's internal errors rather than swallowing them.
            throw e;
        },
    });
    editor.setRootElement(rootEl);

    const cleanup = mergeRegister(
        registerRichText(editor),
        registerHistory(editor, createEmptyHistoryState(), 1000),
        registerMarkdownShortcuts(editor, TRANSFORMERS),
        onChange ? editor.registerUpdateListener(() => onChange()) : () => {},
    );

    return {
        editor,

        /** Serialize the document to Markdown (the `<content type="text">` source). */
        getMarkdown: () => editor.getEditorState().read(() => $convertToMarkdownString(TRANSFORMERS)),

        /** Serialize the document to HTML (normalised to XHTML by the caller). */
        getHtml: () => editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null)),

        isEmpty: () => editor.getEditorState().read(() => $getRoot().getTextContent().trim().length === 0),

        insertText: (text) =>
            editor.update(() => {
                let selection = $getSelection();
                if (!$isRangeSelection(selection)) {
                    // Focus may sit in the emoji picker rather than the editor, so there
                    // is no live range selection: fall back to appending at the very end.
                    $getRoot().selectEnd();
                    selection = $getSelection();
                }
                if ($isRangeSelection(selection)) selection.insertText(text);
            }),

        /** Toggle an inline format on the selection: 'bold' | 'italic' | 'strikethrough' | 'code'. */
        format: (type) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, type),

        /**
         * If the collapsed caret sits right after an emoji-shortname trigger
         * (a `:foo` token), return the typed query (`foo`), else `null`. Used to
         * drive the composer's inline emoji autocomplete.
         */
        getEmojiQuery: () => editor.getEditorState().read(() => $getTriggerQuery(EMOJI_TRIGGER)),

        /**
         * Replace the `:query` trigger immediately before the caret with `replacement`
         * (the resolved emoji glyph). A no-op if the caret has since moved off the
         * trigger. The caret ends up just after the inserted glyph.
         * @param {string} query - The chars typed after the colon (without the colon).
         * @param {string} replacement
         */
        replaceEmojiTrigger: (query, replacement) =>
            editor.update(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
                const node = selection.anchor.getNode();
                if (!$isTextNode(node)) return;
                const offset = selection.anchor.offset;
                const trigger = `:${query}`;
                if (!node.getTextContent().slice(0, offset).endsWith(trigger)) return;
                node.spliceText(offset - trigger.length, trigger.length, replacement, true);
            }),

        /**
         * If the collapsed caret sits right after a mention trigger (an `@foo`
         * token, possibly a bare `@`), return the typed query (`foo`, or `''`),
         * else `null`. Drives the composer's mention autocomplete.
         */
        getMentionQuery: () => editor.getEditorState().read(() => $getTriggerQuery(MENTION_TRIGGER)),

        /**
         * Replace the `@query` trigger immediately before the caret with a link
         * (the mention: `text` linking to `url`, e.g. `@Name` → `xmpp:jid`),
         * followed by a space. Serialized by the LINK markdown transformer as
         * `[text](url)`. A no-op if the caret has since moved off the trigger.
         * The caret ends up just after the trailing space.
         * @param {string} query - The chars typed after the `@` (without the `@`).
         * @param {string} text - The link's text (e.g. `@Alice`).
         * @param {string} url - The link's target (e.g. `xmpp:alice@example.org`).
         */
        replaceMentionTrigger: (query, text, url) =>
            editor.update(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
                const node = selection.anchor.getNode();
                if (!$isTextNode(node)) return;
                const offset = selection.anchor.offset;
                const trigger = `@${query}`;
                if (!node.getTextContent().slice(0, offset).endsWith(trigger)) return;
                // Isolate the trigger's text node, then swap it for the link.
                const start = offset - trigger.length;
                const parts = node.splitText(start, offset);
                const target = parts[start === 0 ? 0 : 1];
                const link = $createLinkNode(url);
                link.append($createTextNode(text));
                target.replace(link);
                const space = $createTextNode(' ');
                link.insertAfter(space);
                space.select(1, 1);
            }),

        clear: () =>
            editor.update(() => {
                $getRoot().clear();
            }),

        focus: () => editor.focus(),

        destroy: () => {
            cleanup();
            editor.setRootElement(null);
        },
    };
}


