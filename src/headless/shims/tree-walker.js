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
export const NodeFilter = Object.freeze({
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,

    SHOW_ALL: 0xffffffff,
    SHOW_ELEMENT: 0x1,
    SHOW_ATTRIBUTE: 0x2,
    SHOW_TEXT: 0x4,
    SHOW_CDATA_SECTION: 0x8,
    SHOW_PROCESSING_INSTRUCTION: 0x40,
    SHOW_COMMENT: 0x80,
    SHOW_DOCUMENT: 0x100,
    SHOW_DOCUMENT_TYPE: 0x200,
    SHOW_DOCUMENT_FRAGMENT: 0x400,
});

/**
 * Applies `whatToShow` and then the filter, if any. Kept out of the class so it
 * stays off the emitted declaration: a `#private` member would shift
 * TypeScript's name mangling counter across every other declaration file.
 * @param {TreeWalker} walker
 * @param {Node} node
 * @returns {import('./types').FilterVerdict}
 */
function accept(walker, node) {
    // `whatToShow` is a bitmask indexed by nodeType, which is 1-based.
    if (!(walker.whatToShow & (1 << (node.nodeType - 1)))) return NodeFilter.FILTER_SKIP;
    if (!walker.filter) return NodeFilter.FILTER_ACCEPT;

    const filter = typeof walker.filter === 'function' ? walker.filter : walker.filter.acceptNode;
    return filter.call(walker.filter, node) ?? NodeFilter.FILTER_ACCEPT;
}

export class TreeWalker {
    /**
     * @param {Node} root
     * @param {number} [whatToShow]
     * @param {import('./types').NodeFilterCallback} [filter]
     */
    constructor(root, whatToShow = NodeFilter.SHOW_ALL, filter = null) {
        this.root = root;
        this.whatToShow = whatToShow;
        this.filter = filter;
        this.currentNode = root;
    }

    /**
     * The next node in document order that the filter accepts, or null at the
     * end of the tree. A REJECT verdict skips the node's whole subtree; SKIP
     * passes over the node but still descends into it.
     * @returns {Node|null}
     */
    nextNode() {
        let node = this.currentNode;
        /** @type {import('./types').FilterVerdict} */
        let verdict = NodeFilter.FILTER_ACCEPT;

        for (;;) {
            while (verdict !== NodeFilter.FILTER_REJECT && node.firstChild) {
                node = node.firstChild;
                verdict = accept(this, node);
                if (verdict === NodeFilter.FILTER_ACCEPT) {
                    this.currentNode = node;
                    return node;
                }
            }

            let following = null;
            for (let candidate = node; candidate && candidate !== this.root; candidate = candidate.parentNode) {
                if (candidate.nextSibling) {
                    following = candidate.nextSibling;
                    break;
                }
            }
            if (!following) return null;

            node = following;
            verdict = accept(this, node);
            if (verdict === NodeFilter.FILTER_ACCEPT) {
                this.currentNode = node;
                return node;
            }
        }
    }
}
