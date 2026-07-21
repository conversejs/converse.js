/**
 * A single attribute test within a compound selector: `[name]` for presence, or
 * `[name=value]` / `[name="value"]` for equality.
 */
export type AttributeTest = {
    name: string;
    /** Absent for a presence test such as `[src]`. */
    value?: string;
};

/**
 * A type selector together with its attribute tests, e.g.
 * `delay[xmlns="urn:xmpp:delay"]`.
 */
export type Compound = {
    /** The localName to match, or null to match any element. */
    name: string | null;
    attributes: AttributeTest[];
};

/**
 * A compound selector plus the combinator tying it to the step on its left. The
 * first step's combinator describes its relationship to the context node, which
 * is what makes `:scope > x` and a bare `x` differ.
 */
export type Step = {
    combinator: 'descendant' | 'child';
    compound: Compound;
};

/**
 * The verdict a TreeWalker filter returns, matching the `NodeFilter.FILTER_*`
 * constants: accept the node, reject it along with its subtree, or skip the
 * node but still descend into it.
 */
export type FilterVerdict = 1 | 2 | 3;

/**
 * Either form the DOM accepts for a TreeWalker filter.
 */
export type NodeFilterCallback = ((node: Node) => FilterVerdict) | { acceptNode: (node: Node) => FilterVerdict };
