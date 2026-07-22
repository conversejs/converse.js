/**
 * Node.js DOM shim.
 *
 * Strophe 5's Node entry point installs `@xmldom/xmldom` as the global
 * `document`/`DOMParser`/`XMLSerializer` and `ws` as the global `WebSocket`,
 * which covers everything Strophe itself needs. Converse needs a little more
 * from the same DOM, so this fills the remaining gaps:
 *
 *  - the `Element`, `Node`, `Document` &c. constructors as globals, so that the
 *    `stanza instanceof Element` checks throughout the parsers keep working;
 *  - `querySelector`, `querySelectorAll`, `matches` and `closest`, which
 *    `@xmldom/xmldom` does not implement and Sizzle cannot supply under Node;
 *  - `createTreeWalker`, `outerHTML`, `previousElementSibling`,
 *    `nextElementSibling` and `remove`.
 *
 * It is imported for its side effects by `index-node.js`, before anything that
 * touches a stanza. Importing Strophe here rather than relying on the entry
 * point's import order is what guarantees the globals exist by the time the
 * prototypes below are patched.
 *
 * `@xmldom/xmldom` is imported under a namespace rather than by name, so that
 * `Element`, `Node` and friends keep meaning the `lib.dom` types in the
 * annotations below, as they do everywhere else in Converse. The two type
 * universes only genuinely meet at the `outerHTML` getter.
 *
 * @module shims/node-dom
 */
import 'strophe.js';
import * as xmldom from '@xmldom/xmldom';
import { matches, selectAll, selectFirst } from './selector.js';
import { NodeFilter, TreeWalker } from './tree-walker.js';

// Strophe and Converse have to agree on which `@xmldom/xmldom` copy is in play,
// otherwise every `instanceof Element` check silently returns false. npm dedupes
// the two (Strophe declares it as an optional peer dependency, Converse as an
// optional dependency, both on ^0.9.0), but a hoisting accident would be very
// hard to diagnose from the symptoms, so say so plainly instead.
if (!(globalThis.document?.createElement('sample') instanceof xmldom.Element)) {
    throw new Error(
        '@converse/headless: Strophe and Converse resolved different copies of @xmldom/xmldom. ' +
            'Deduplicate it (npm dedupe) before continuing.',
    );
}

// Declared, but left undefined, because Node has no Web Storage. skeletor's
// session-storage driver probes for it with a bare `sessionStorage` reference
// inside a try/catch and logs the resulting ReferenceError, so every process
// start prints a stack trace. Declaring the global makes the reference resolve
// to `undefined`, the probe fall through, and the log go away.
//
// Anything testing for Web Storage must therefore use `typeof`, not
// `'sessionStorage' in globalThis`, which this makes true. That is the test
// localforage and `utils/storage.js` already use. `localStorage` is left
// undeclared because nothing probes for it the same way.
globalThis.sessionStorage = undefined;

Object.assign(globalThis, {
    Attr: xmldom.Attr,
    CDATASection: xmldom.CDATASection,
    CharacterData: xmldom.CharacterData,
    Comment: xmldom.Comment,
    Document: xmldom.Document,
    DocumentFragment: xmldom.DocumentFragment,
    DocumentType: xmldom.DocumentType,
    Element: xmldom.Element,
    Node: xmldom.Node,
    NodeFilter,
    NodeList: xmldom.NodeList,
    ProcessingInstruction: xmldom.ProcessingInstruction,
    Text: xmldom.Text,
});

/**
 * Defines a property only if the DOM doesn't already have it, so that a future
 * `@xmldom/xmldom` implementing any of these wins over the shim.
 * @param {object} proto
 * @param {string} name
 * @param {PropertyDescriptor} descriptor
 */
function polyfill(proto, name, descriptor) {
    if (proto && !(name in proto)) {
        Object.defineProperty(proto, name, { configurable: true, ...descriptor });
    }
}

for (const proto of [xmldom.Element.prototype, xmldom.Document.prototype, xmldom.DocumentFragment.prototype]) {
    // `querySelectorAll` returns a plain Array rather than a static NodeList.
    // Every caller either iterates it or reads `length`, and an Array is a
    // superset of a NodeList for both.
    polyfill(proto, 'querySelectorAll', {
        writable: true,
        /**
         * @this {Element|Document|DocumentFragment}
         * @param {string} selector
         */
        value(selector) {
            return selectAll(this, selector);
        },
    });
    polyfill(proto, 'querySelector', {
        writable: true,
        /**
         * @this {Element|Document|DocumentFragment}
         * @param {string} selector
         */
        value(selector) {
            return selectFirst(this, selector);
        },
    });
}

polyfill(xmldom.Document.prototype, 'createTreeWalker', {
    writable: true,
    /**
     * @param {Node} root
     * @param {number} [whatToShow]
     * @param {import('./types').NodeFilterCallback} [filter]
     */
    value(root, whatToShow, filter) {
        return new TreeWalker(root, whatToShow, filter);
    },
});

polyfill(xmldom.Element.prototype, 'matches', {
    writable: true,
    /**
     * @this {Element}
     * @param {string} selector
     */
    value(selector) {
        return matches(this, selector);
    },
});

polyfill(xmldom.Element.prototype, 'closest', {
    writable: true,
    /**
     * @this {Element}
     * @param {string} selector
     */
    value(selector) {
        for (let el = /** @type {Element} */ (this); el?.nodeType === 1; el = /** @type {Element} */ (el.parentNode)) {
            if (matches(el, selector)) return el;
        }
        return null;
    },
});

// Read-only on purpose: nothing in Converse should be assigning markup to a
// stanza, and a getter-only property makes such an assignment throw in strict
// mode rather than quietly do nothing.
polyfill(xmldom.Element.prototype, 'outerHTML', {
    /** @this {Element} */
    get() {
        // The one place the two DOM type universes meet: `this` really is an
        // xmldom element, which is what this serializer expects.
        const el = /** @type {xmldom.Element} */ (/** @type {unknown} */ (this));
        return new xmldom.XMLSerializer().serializeToString(el);
    },
});

polyfill(xmldom.Element.prototype, 'previousElementSibling', {
    /** @this {Element} */
    get() {
        let node = this.previousSibling;
        while (node && node.nodeType !== 1) node = node.previousSibling;
        return node ?? null;
    },
});

polyfill(xmldom.Element.prototype, 'nextElementSibling', {
    /** @this {Element} */
    get() {
        let node = this.nextSibling;
        while (node && node.nodeType !== 1) node = node.nextSibling;
        return node ?? null;
    },
});

polyfill(xmldom.Element.prototype, 'remove', {
    writable: true,
    /** @this {Element} */
    value() {
        this.parentNode?.removeChild(this);
    },
});
