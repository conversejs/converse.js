import { describe, it, expect, afterEach } from 'vitest';
import { QuoteNode } from '@lexical/rich-text';
import { CodeNode } from '@lexical/code';
import { BOLD_STAR, INLINE_CODE, ITALIC_STAR, ITALIC_UNDERSCORE, STRIKETHROUGH } from '@lexical/markdown';
import { createRichEditor } from '../editor.js';
import { BOLD_SINGLE_STAR, STRIKE_SINGLE_TILDE, STYLING_TRANSFORMERS, withStylingShortcuts } from '../styling.js';

/** @type {Array<{ destroy: () => void, root: Element }>} */
const created = [];

function makeEditor() {
    const root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    document.body.appendChild(root);
    const handle = createRichEditor(root, {
        namespace: 'test-styling',
        nodes: [QuoteNode, CodeNode],
        transformers: STYLING_TRANSFORMERS,
    });
    created.push({ destroy: handle.destroy, root });
    return handle;
}

afterEach(() => {
    while (created.length) {
        const { destroy, root } = created.pop();
        destroy();
        root.remove();
    }
});

describe('XEP-0393 message styling transformers', function () {
    it('parses the single-character markers into real formatting', function () {
        const editor = makeEditor();
        editor.setMarkdown('*bold* _italic_ ~strike~ `code`');

        // Assert on the serialized HTML, not just the text, so a no-op passthrough
        // (markers left as literal characters) cannot make this pass.
        const html = editor.getHtml();
        expect(html).toMatch(/<strong[\s>]/);
        expect(html).toMatch(/<em[\s>]/);
        expect(html).toMatch(/<s[\s>]/);
        expect(html).toMatch(/<code[\s>]/);
    });

    it('round-trips a styled body back to the same markers', function () {
        const editor = makeEditor();
        const body = '*bold* _italic_ ~strike~ `code`';
        editor.setMarkdown(body);
        expect(editor.getMarkdown()).toBe(body);
    });

    it('treats a single star as bold, not italic (the CommonMark difference)', function () {
        const editor = makeEditor();
        // The whole point of the XEP-0393 set: CommonMark would make this italic.
        editor.setMarkdown('*hello*');
        expect(editor.getHtml()).toMatch(/<strong[\s>]/);
        expect(editor.getHtml()).not.toMatch(/<em[\s>]/);
    });

    it('leaves plain text untouched', function () {
        const editor = makeEditor();
        editor.setMarkdown('just a plain message');
        expect(editor.getMarkdown()).toBe('just a plain message');
        expect(editor.getHtml()).not.toMatch(/<strong|<em[\s>]|<s[\s>]/);
    });

    it('parses a fenced preformatted block (XEP-0393 § 5.1.2)', function () {
        const editor = makeEditor();
        editor.setMarkdown('```\nline one\nline two\n```');

        // Lexical exports a code block as <pre>, unlike inline code's <code>.
        expect(editor.getHtml()).toMatch(/<pre[\s>]/);
        // The fence must round-trip bare: converse's texture renderer takes everything
        // between the fences verbatim, so a stray language tag would land in the body.
        const out = editor.getMarkdown();
        expect(out).toBe('```\nline one\nline two\n```');
    });

    it('parses a quote, which XEP-0393 and CommonMark spell the same way', function () {
        const editor = makeEditor();
        editor.setMarkdown('> quoted');
        expect(editor.getHtml()).toMatch(/<blockquote/);
        expect(editor.getMarkdown()).toBe('> quoted');
    });
});

describe('withStylingShortcuts', function () {
    it('drops the transformers that would fight over a single star or tilde', function () {
        const set = withStylingShortcuts([BOLD_STAR, ITALIC_STAR, ITALIC_UNDERSCORE, STRIKETHROUGH, INLINE_CODE]);

        // CommonMark's `*` = italic conflicts with XEP-0393's `*` = bold, so it goes.
        expect(set).not.toContain(ITALIC_STAR);
        // Doubled tags don't conflict, so they survive and keep working.
        expect(set).toContain(BOLD_STAR);
        expect(set).toContain(STRIKETHROUGH);
        // Non-conflicting singles are untouched.
        expect(set).toContain(ITALIC_UNDERSCORE);
        expect(set).toContain(INLINE_CODE);
        // And the XEP-0393 spellings are added.
        expect(set).toContain(BOLD_SINGLE_STAR);
        expect(set).toContain(STRIKE_SINGLE_TILDE);
    });

    it('orders doubled tags before their single-character counterparts', function () {
        const set = withStylingShortcuts([BOLD_STAR, STRIKETHROUGH]);
        // `**` must be tried before `*`, otherwise typing `**bold**` matches the single
        // star first and produces an empty bold run.
        expect(set.indexOf(BOLD_STAR)).toBeLessThan(set.indexOf(BOLD_SINGLE_STAR));
        expect(set.indexOf(STRIKETHROUGH)).toBeLessThan(set.indexOf(STRIKE_SINGLE_TILDE));
    });
});
