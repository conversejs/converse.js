/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The Social composer's Lexical configuration: transformer set, theme and node types,
 * layered over the shared editor in {@link shared/rich-composer/editor.js}.
 *
 * Like that module, this one is only ever reached through the composer's dynamic
 * `import()` on first focus, so both stay out of Converse's core bundle.
 *
 * It re-exposes the shared handle with mention/emoji-specific wrappers, so the composer
 * talks in terms of its own triggers rather than passing regexes around.
 */
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { LinkNode } from '@lexical/link';
import {
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
} from '@lexical/markdown';
import { createRichEditor } from 'shared/rich-composer/editor.js';
import { withStylingShortcuts } from 'shared/rich-composer/styling.js';
import { EMOJI_TRIGGER, MENTION_TRIGGER } from 'shared/rich-composer/triggers.js';

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
    // `_italic_` before `*italic*`: both are valid GFM, but only the underscore spelling
    // also means italic under XEP-0393 (where a single `*` is bold). Serializing the
    // unambiguous one keeps a post readable whichever convention renders it, including
    // Converse's own texture renderer, which applies XEP-0393 styling to post bodies.
    ITALIC_UNDERSCORE,
    ITALIC_STAR,
    STRIKETHROUGH,
    INLINE_CODE,
    LINK,
];

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

// LinkNode's own DOM export whitelists http(s)/mailto/sms/tel and rewrites every
// other scheme (so our xmpp: mention URIs) to about:blank. Export links with the
// raw URL instead; the composer runs the exported HTML through DOMPurify (whose
// URI allowlist includes xmpp:) before anything reaches the wire.
const HTML_EXPORT = new Map([
    [
        LinkNode,
        (_editor, /** @type {LinkNode} */ node) => {
            const element = document.createElement('a');
            element.href = node.getURL();
            const title = node.getTitle();
            if (title) element.title = title;
            return { element };
        },
    ],
]);

/**
 * Attach a Lexical rich-text editor configured for Social posts.
 * @param {HTMLElement} rootEl - A `contenteditable` host element.
 * @param {object} [opts]
 * @param {() => void} [opts.onChange] - Called after each edit (e.g. to toggle a
 *      disabled Post button). Kept optional so the caller can avoid per-keystroke
 *      re-renders.
 * @returns {import('./types.ts').LexicalEditor}
 */
export function createSocialEditor(rootEl, { onChange } = {}) {
    const handle = createRichEditor(rootEl, {
        namespace: 'converse-social-compose',
        nodes: [HeadingNode, QuoteNode, LinkNode],
        theme: THEME,
        transformers: TRANSFORMERS,
        // Type the way chat does (XEP-0393's `*bold*`, `~strike~`) while still publishing
        // GitHub-flavoured Markdown, so the two composers feel the same. `**bold**` and
        // `~~strike~~` keep working for anyone used to CommonMark.
        input_transformers: withStylingShortcuts(TRANSFORMERS),
        html_export: HTML_EXPORT,
        onChange,
    });

    return {
        ...handle,

        /**
         * If the collapsed caret sits right after an emoji-shortname trigger
         * (a `:foo` token), return the typed query (`foo`), else `null`.
         */
        getEmojiQuery: () => handle.getTriggerQuery(EMOJI_TRIGGER),

        /**
         * Replace the `:query` trigger immediately before the caret with `replacement`
         * (the resolved emoji glyph).
         * @param {string} query - The chars typed after the colon (without the colon).
         * @param {string} replacement
         */
        replaceEmojiTrigger: (query, replacement) => handle.replaceTrigger(`:${query}`, replacement),

        /**
         * If the collapsed caret sits right after a mention trigger (an `@foo` token,
         * possibly a bare `@`), return the typed query (`foo`, or `''`), else `null`.
         */
        getMentionQuery: () => handle.getTriggerQuery(MENTION_TRIGGER),

        /**
         * Replace the `@query` trigger immediately before the caret with a link (the
         * mention: `text` linking to `url`), followed by a space.
         * @param {string} query - The chars typed after the `@` (without the `@`).
         * @param {string} text - The link's text (e.g. `@Alice`).
         * @param {string} url - The link's target (e.g. `xmpp:alice@example.org`).
         */
        replaceMentionTrigger: (query, text, url) => handle.replaceTriggerWithLink(`@${query}`, text, url),
    };
}
