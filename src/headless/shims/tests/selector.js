/**
 * Tests for the Node.js DOM shims. These run under Node, not a browser, so they
 * exercise the same code path a Node consumer of @converse/headless gets.
 */
import { describe, expect, it } from 'vitest';
import '../node-dom.js';
import sizzle from '../sizzle.js';

const STANZA = `<message xmlns="jabber:client" to="romeo@montague.lit/orchard" from="room@conference.lit/juliet" type="groupchat">
  <body>hello</body>
  <delay xmlns="urn:xmpp:delay" stamp="2023-01-01T00:00:00Z"/>
  <x xmlns="http://jabber.org/protocol/muc#user">
    <item affiliation="member" role="participant" jid="juliet@montague.lit"/>
    <status code="110"/>
  </x>
  <stanza-id xmlns="urn:xmpp:sid:0" id="abc"/>
  <apply-to xmlns="urn:xmpp:fasten:0" id="orig">
    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:title" content="T"/>
    <meta xmlns="http://www.w3.org/1999/xhtml" property="og:description" content="D"/>
  </apply-to>
  <pubsub xmlns="http://jabber.org/protocol/pubsub">
    <items node="urn:xmpp:bookmarks:1"><item id="current"><conference name="Balcony"/></item></items>
    <publish-options/>
  </pubsub>
  <vCard xmlns="vcard-temp">
    <FN>Juliet</FN>
    <PHOTO><TYPE>image/png</TYPE><BINVAL>Zm9v</BINVAL></PHOTO>
  </vCard>
  <error type="cancel">
    <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
    <text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">nope</text>
  </error>
  <x xmlns="jabber:x:data" type="result">
    <field var="a"><value>1</value></field>
    <field var="b"><value>2</value></field>
  </x>
</message>`;

/** A fresh tree per test, so mutating tests can't leak into the others. */
function parse() {
    return new DOMParser().parseFromString(STANZA, 'text/xml').documentElement;
}

describe('querySelector/querySelectorAll', () => {
    it('matches type selectors on localName', () => {
        expect(parse().querySelector('body').textContent).toBe('hello');
    });

    it('matches case-sensitively, as an XML document does', () => {
        const stanza = parse();
        expect(stanza.querySelector('vCard FN').textContent).toBe('Juliet');
        expect(stanza.querySelector('vcard fn')).toBe(null);
    });

    it('matches a prefixed element on its local name', () => {
        const doc = new DOMParser().parseFromString(
            `<stream:features xmlns:stream="http://etherx.jabber.org/streams"><bind/></stream:features>`,
            'text/xml',
        );
        expect(doc.querySelector('features')).not.toBe(null);
    });

    it('handles hyphenated element names', () => {
        expect(parse().querySelector('service-unavailable').localName).toBe('service-unavailable');
    });

    it('supports the descendant combinator', () => {
        expect(parse().querySelector('error text').textContent).toBe('nope');
    });

    it('supports the child combinator', () => {
        expect(parse().querySelectorAll('pubsub > items > item')).toHaveLength(1);
    });

    it('scopes with :scope', () => {
        const stanza = parse();
        expect(stanza.querySelectorAll(':scope > body')).toHaveLength(1);
        // `item` exists, but nested two levels down, so :scope > excludes it.
        expect(stanza.querySelectorAll(':scope > item')).toHaveLength(0);
    });

    it('supports attribute presence, bare and quoted values', () => {
        const stanza = parse();
        expect(stanza.querySelectorAll('[stamp]')).toHaveLength(1);
        expect(stanza.querySelector('x[type=result]').getAttribute('type')).toBe('result');
        expect(stanza.querySelector('items[node="urn:xmpp:bookmarks:1"]').localName).toBe('items');
    });

    it('matches an attribute-only compound', () => {
        expect(sizzle('[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]', parse())).toHaveLength(2);
    });

    it('does not match a namespace the element inherits rather than declares', () => {
        // This mirrors how a browser behaves, and it is what the parsers rely on
        // when they match `delay[xmlns="urn:xmpp:delay"]`.
        const stanza = parse();
        expect(sizzle('delay[xmlns="urn:xmpp:delay"]', stanza)).toHaveLength(1);
        expect(sizzle('body[xmlns="jabber:client"]', stanza)).toHaveLength(0);
    });

    it('supports selector lists', () => {
        expect(parse().querySelectorAll('body, delay')).toHaveLength(2);
    });

    it('returns matches in document order', () => {
        expect(parse().querySelectorAll('vCard *').map((el) => el.localName)).toEqual([
            'FN',
            'PHOTO',
            'TYPE',
            'BINVAL',
        ]);
    });

    it('returns null when nothing matches', () => {
        expect(parse().querySelector('nonexistent')).toBe(null);
    });

    it('throws on a selector outside the supported grammar', () => {
        expect(() => parse().querySelector('.some-class')).toThrow(SyntaxError);
        expect(() => parse().querySelector('#some-id')).toThrow(SyntaxError);
        expect(() => parse().querySelector('field:required')).toThrow(SyntaxError);
    });
});

describe('sizzle shim', () => {
    it('treats a leading > as child-of-context', () => {
        const stanza = parse();
        expect(sizzle('> body', stanza)).toHaveLength(1);
        expect(sizzle('> item', stanza)).toHaveLength(0);
    });

    it('resolves a nested context', () => {
        const fastening = sizzle('> apply-to[xmlns="urn:xmpp:fasten:0"]', parse())[0];
        expect(sizzle('> meta[xmlns="http://www.w3.org/1999/xhtml"]', fastening)).toHaveLength(2);
    });

    it('matches chained attribute selectors', () => {
        expect(sizzle('x[type="result"][xmlns="jabber:x:data"] field', parse())).toHaveLength(2);
    });
});

describe('DOM globals and element members', () => {
    it('installs the constructors that instanceof checks rely on', () => {
        const stanza = parse();
        expect(stanza instanceof Element).toBe(true);
        expect(stanza instanceof Node).toBe(true);
        expect(stanza.ownerDocument instanceof Document).toBe(true);
    });

    it('agrees with the document Strophe builds stanzas from', () => {
        // A second @xmldom/xmldom copy would break every `instanceof Element`
        // check in the parsers, so assert the realms are the same one.
        expect(globalThis.document.createElement('x') instanceof Element).toBe(true);
    });

    it('implements matches() and closest()', () => {
        const stanza = parse();
        expect(stanza.querySelector('BINVAL').matches('vCard PHOTO BINVAL')).toBe(true);
        expect(stanza.querySelector('body').matches('delay')).toBe(false);
        expect(stanza.querySelector('BINVAL').closest('vCard').localName).toBe('vCard');
    });

    it('serialises outerHTML', () => {
        expect(parse().querySelector('stanza-id').outerHTML).toBe('<stanza-id xmlns="urn:xmpp:sid:0" id="abc"/>');
    });

    it('walks element siblings', () => {
        const stanza = parse();
        expect(stanza.querySelector('body').nextElementSibling.localName).toBe('delay');
        expect(stanza.querySelector('delay').previousElementSibling.localName).toBe('body');
    });

    it('removes an element', () => {
        const stanza = parse();
        stanza.querySelector('publish-options').remove();
        expect(stanza.querySelector('publish-options')).toBe(null);
    });
});

describe('createTreeWalker', () => {
    it('yields nodes in document order, honouring whatToShow', () => {
        const stanza = parse();
        const walker = document.createTreeWalker(stanza.querySelector('vCard'), NodeFilter.SHOW_ELEMENT);
        const names = [];
        let node;
        while ((node = walker.nextNode())) names.push(node.localName);
        expect(names).toEqual(['FN', 'PHOTO', 'TYPE', 'BINVAL']);
    });

    it('skips a node but still descends into it', () => {
        const stanza = parse();
        const walker = document.createTreeWalker(stanza.querySelector('vCard'), NodeFilter.SHOW_ELEMENT, (node) =>
            node.localName === 'PHOTO' ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT,
        );
        const names = [];
        let node;
        while ((node = walker.nextNode())) names.push(node.localName);
        expect(names).toEqual(['FN', 'TYPE', 'BINVAL']);
    });

    it('rejects a node together with its subtree', () => {
        const stanza = parse();
        const walker = document.createTreeWalker(stanza.querySelector('vCard'), NodeFilter.SHOW_ELEMENT, (node) =>
            node.localName === 'PHOTO' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
        );
        const names = [];
        let node;
        while ((node = walker.nextNode())) names.push(node.localName);
        expect(names).toEqual(['FN']);
    });
});
