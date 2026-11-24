/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The chat composer's Lexical configuration, layered over the shared editor in
 * {@link shared/rich-composer/editor.js}.
 *
 * Like that module this one is only ever reached through the composer's dynamic
 * `import()` on first focus, so Lexical stays out of Converse's core bundle.
 *
 * Chat serializes to XEP-0393 Message Styling: a plain-text body carrying `*bold*`,
 * `_italic_`, `~strike~`, `` `code` ``, fenced blocks and `>` quotes. That is the whole
 * wire format, so unlike the Social composer there is no separate HTML export; the body
 * we hand to `sendMessage` is exactly what a plain-textarea user could have typed.
 */
import { QuoteNode } from '@lexical/rich-text';
import { CodeNode } from '@lexical/code';
import { createRichEditor } from 'shared/rich-composer/editor.js';
import { STYLING_TRANSFORMERS, stripMarkdownEscapes } from 'shared/rich-composer/styling.js';

// Class names Lexical stamps on its DOM for styling hooks. Editor-only: they never reach
// the wire, since the body is serialized from the document rather than from this markup.
const THEME = {
    quote: 'chat-rich__quote',
    code: 'chat-rich__code-block',
    text: {
        bold: 'chat-rich__bold',
        italic: 'chat-rich__italic',
        strikethrough: 'chat-rich__strike',
        code: 'chat-rich__code',
    },
};

/**
 * Attach a Lexical editor configured for chat messages.
 * @param {HTMLElement} rootEl - A `contenteditable` host element.
 * @param {object} [opts]
 * @param {() => void} [opts.onChange] - Called after each edit.
 * @returns {import('shared/rich-composer/types').RichEditor}
 */
export function createChatEditor(rootEl, { onChange } = {}) {
    const handle = createRichEditor(rootEl, {
        namespace: 'converse-chat-compose',
        nodes: [QuoteNode, CodeNode],
        theme: THEME,
        // Input and output are the same set here: what you type is what goes on the wire.
        transformers: STYLING_TRANSFORMERS,
        onChange,
    });

    return {
        ...handle,
        /**
         * The body to send. Lexical escapes markdown-special characters, but XEP-0393 has
         * no escape syntax, so those backslashes would travel as literal text.
         */
        getMarkdown: () => stripMarkdownEscapes(handle.getMarkdown()),
    };
}
