import { describe, it, expect, afterEach } from 'vitest';
import { createSocialEditor } from '../lexical-editor.js';

/** @type {Array<{ destroy: () => void, root: Element }>} */
const created = [];

function makeEditor() {
    const root = document.createElement('div');
    root.setAttribute('contenteditable', 'true');
    document.body.appendChild(root);
    const handle = createSocialEditor(root);
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

describe('The Social composer editor', function () {
    it('still serializes GitHub-flavoured Markdown, which Movim reads', function () {
        // Social publishes `<content type="text">` as GFM, so the output spelling must not
        // drift even though the composer now accepts XEP-0393's typing shortcuts.
        const editor = makeEditor();
        editor.setMarkdown('**bold** _italic_ ~~strike~~ `code`');
        expect(editor.getMarkdown()).toBe('**bold** _italic_ ~~strike~~ `code`');

        const html = editor.getHtml();
        expect(html).toMatch(/<strong[\s>]/);
        expect(html).toMatch(/<em[\s>]/);
        expect(html).toMatch(/<s[\s>]/);
        expect(html).toMatch(/<code[\s>]/);
    });

    it('keeps the markdown constructs XEP-0393 has no syntax for', function () {
        // Headings and links are why Social cannot simply adopt the chat wire format:
        // mentions are published as `[@Name](xmpp:jid)` links for the renostr bridge.
        const editor = makeEditor();
        editor.setMarkdown('## Heading');
        expect(editor.getHtml()).toMatch(/<h2[\s>]/);

        const links = makeEditor();
        links.setMarkdown('[@Alice](xmpp:alice@example.org)');
        expect(links.getMarkdown()).toBe('[@Alice](xmpp:alice@example.org)');
        expect(links.getHtml()).toContain('xmpp:alice@example.org');
    });
});
