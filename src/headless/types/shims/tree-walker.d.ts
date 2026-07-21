/**
 * `NodeFilter` and a forward-only `TreeWalker` for `@xmldom/xmldom`.
 *
 * Two things ask for `document.createTreeWalker` under Node. `u.isEqualNode`
 * uses it to strip insignificant whitespace before comparing two stanzas, and
 * lit-html's Node build calls it at module scope: it decides between a real DOM
 * and its own stub with `void 0 === globalThis.document ? stub : document`, so
 * the moment Strophe installs an XML document, lit takes the real-DOM branch
 * and needs the method to exist. Supplying it here keeps that working whatever
 * order the modules happen to load in.
 *
 * Traversal is forward-only: `nextNode()` is implemented, along with the
 * `whatToShow` bitmask and both filter forms. `previousNode()` and the relative
 * movers (`parentNode()`, `firstChild()` &c.) are deliberately absent rather
 * than half-right, so reaching for one throws instead of quietly misbehaving.
 *
 * @module shims/tree-walker
 */
/**
 * @see https://dom.spec.whatwg.org/#interface-nodefilter
 */
export const NodeFilter: Readonly<{
    FILTER_ACCEPT: 1;
    FILTER_REJECT: 2;
    FILTER_SKIP: 3;
    SHOW_ALL: 4294967295;
    SHOW_ELEMENT: 1;
    SHOW_ATTRIBUTE: 2;
    SHOW_TEXT: 4;
    SHOW_CDATA_SECTION: 8;
    SHOW_PROCESSING_INSTRUCTION: 64;
    SHOW_COMMENT: 128;
    SHOW_DOCUMENT: 256;
    SHOW_DOCUMENT_TYPE: 512;
    SHOW_DOCUMENT_FRAGMENT: 1024;
}>;
export class TreeWalker {
    /**
     * @param {Node} root
     * @param {number} [whatToShow]
     * @param {import('./types').NodeFilterCallback} [filter]
     */
    constructor(root: Node, whatToShow?: number, filter?: import("./types").NodeFilterCallback);
    root: Node;
    whatToShow: number;
    filter: import("./types").NodeFilterCallback;
    currentNode: Node;
    /**
     * The next node in document order that the filter accepts, or null at the
     * end of the tree. A REJECT verdict skips the node's whole subtree; SKIP
     * passes over the node but still descends into it.
     * @returns {Node|null}
     */
    nextNode(): Node | null;
}
//# sourceMappingURL=tree-walker.d.ts.map