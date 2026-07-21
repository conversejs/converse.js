/**
 * A minimal CSS selector engine that runs against any W3C DOM.
 *
 * Node.js has no DOM of its own. Strophe 5 supplies `@xmldom/xmldom`, which is
 * a complete enough XML DOM to build and parse stanzas, but it implements
 * neither `querySelector` nor anything Sizzle can run on (Sizzle feature-detects
 * against a live browser document and throws on import under Node).
 *
 * Rather than pull a full HTML DOM into a headless client, this implements
 * exactly the selector subset Converse uses on stanzas:
 *
 *  - type selectors, matched case-sensitively against `localName`, so `vCard`
 *    and `BINVAL` work and a prefixed `stream:features` matches `features`,
 *    the same way a browser matches type selectors in an XML document;
 *  - attribute selectors `[name]`, `[name=value]` and `[name="value"]`,
 *    chainable, which is how namespaces get matched (`[xmlns="..."]`);
 *  - the descendant and child (`>`) combinators, `:scope`, and Sizzle's leading
 *    `>`, which means the same thing as `:scope >`;
 *  - selector lists (`a, b`).
 *
 * There are no class, id or pseudo-class selectors, because stanzas have none
 * and nothing in Converse asks for them. Anything outside the grammar throws a
 * SyntaxError rather than silently never matching.
 *
 * @module shims/selector
 */

const WHITESPACE = /[ \t\r\n\f]/;

/** Characters that end a type selector. */
const NAME_END = /[ \t\r\n\f>,[\]]/;

/** A type selector we're prepared to match: an XML name, no prefix. */
const NAME = /^[A-Za-z_][\w-]*$/;

/** @type {Map<string, import('./types').Step[][]>} */
const cache = new Map();

/**
 * @param {string} selector
 * @param {string} reason
 * @returns {never}
 */
function fail(selector, reason) {
    throw new SyntaxError(`Unsupported selector "${selector}": ${reason}`);
}

/**
 * Parses the attribute selectors, if any, that follow a type selector.
 * @param {string} selector
 * @param {number} start - Index of the opening `[`.
 * @returns {{ attributes: import('./types').AttributeTest[], index: number }}
 */
function parseAttributes(selector, start) {
    const attributes = [];
    let i = start;

    while (selector[i] === '[') {
        i++;
        let name = '';
        while (i < selector.length && selector[i] !== '=' && selector[i] !== ']') name += selector[i++];
        name = name.trim();
        if (!name) fail(selector, 'empty attribute name');

        let value;
        if (selector[i] === '=') {
            i++;
            const quote = selector[i];
            if (quote === '"' || quote === "'") {
                i++;
                value = '';
                while (i < selector.length && selector[i] !== quote) value += selector[i++];
                if (selector[i] !== quote) fail(selector, 'unterminated attribute value');
                i++;
            } else {
                value = '';
                while (i < selector.length && selector[i] !== ']') value += selector[i++];
                value = value.trim();
            }
        }
        if (selector[i] !== ']') fail(selector, 'unterminated attribute selector');
        i++;
        attributes.push({ name, value });
    }
    return { attributes, index: i };
}

/**
 * @param {string} selector
 * @returns {import('./types').Step[][]} One entry per comma-separated selector in the list.
 */
function parse(selector) {
    const cached = cache.get(selector);
    if (cached) return cached;

    /** @type {import('./types').Step[][]} */
    const selectors = [];
    /** @type {import('./types').Step[]} */
    let steps = [];
    /** @type {'descendant'|'child'} */
    let combinator = 'descendant';
    let i = 0;

    while (i < selector.length) {
        let saw_whitespace = false;
        while (i < selector.length && WHITESPACE.test(selector[i])) {
            i++;
            saw_whitespace = true;
        }
        if (i >= selector.length) break;

        if (selector[i] === ',') {
            if (!steps.length) fail(selector, 'empty selector in list');
            selectors.push(steps);
            steps = [];
            combinator = 'descendant';
            i++;
            continue;
        }

        if (selector[i] === '>') {
            i++;
            combinator = 'child';
            while (i < selector.length && WHITESPACE.test(selector[i])) i++;
        } else if (saw_whitespace && steps.length) {
            combinator = 'descendant';
        }

        // `:scope` anchors the selector to the context node, which the first
        // step's combinator already expresses, so it contributes no step.
        if (selector.startsWith(':scope', i)) {
            if (steps.length) fail(selector, '":scope" may only appear at the start');
            i += ':scope'.length;
            continue;
        }

        let name = '';
        while (i < selector.length && !NAME_END.test(selector[i])) name += selector[i++];
        if (name && name !== '*' && !NAME.test(name)) {
            // Catches class, id, namespaced and pseudo-class selectors, none of
            // which stanzas have. Failing loudly beats never matching.
            fail(selector, `"${name}" is not a plain element name`);
        }

        const { attributes, index } = parseAttributes(selector, i);
        i = index;

        if (!name && !attributes.length) fail(selector, `unexpected "${selector[i]}"`);

        steps.push({ combinator, compound: { name: !name || name === '*' ? null : name, attributes } });
        combinator = 'descendant';
    }

    if (!steps.length) fail(selector, 'no compound selector found');
    selectors.push(steps);

    cache.set(selector, selectors);
    return selectors;
}

/**
 * @param {unknown} node
 * @returns {boolean}
 */
function isElement(node) {
    return /** @type {any} */ (node)?.nodeType === 1;
}

/**
 * @param {Element} el
 * @param {import('./types').Compound} compound
 * @returns {boolean}
 */
function matchesCompound(el, compound) {
    if (compound.name !== null && el.localName !== compound.name) return false;
    for (const { name, value } of compound.attributes) {
        if (value === undefined) {
            if (!el.hasAttribute(name)) return false;
        } else if (el.getAttribute(name) !== value) {
            return false;
        }
    }
    return true;
}

/**
 * Matches `el` against `steps[index]` and, recursively, against every step to
 * its left. Walking right-to-left is what lets the descendant combinator
 * backtrack: `a b a` has to be able to try more than one ancestor for `a`.
 *
 * @param {Element} el
 * @param {import('./types').Step[]} steps
 * @param {number} index
 * @param {Element|Document|null} context
 *  The node the selector is relative to, or null to match against the whole
 *  tree (which is what `Element.matches()` does).
 * @returns {boolean}
 */
function matchesChain(el, steps, index, context) {
    if (!matchesCompound(el, steps[index].compound)) return false;

    const { combinator } = steps[index];
    if (index === 0) {
        // `el` is already known to sit below `context`, so a descendant
        // combinator is satisfied by construction.
        return combinator === 'child' ? el.parentNode === context : true;
    }

    let parent = el.parentNode;
    if (combinator === 'child') {
        return isElement(parent) && matchesChain(/** @type {Element} */ (parent), steps, index - 1, context);
    }
    while (isElement(parent) && parent !== context) {
        if (matchesChain(/** @type {Element} */ (parent), steps, index - 1, context)) return true;
        parent = parent.parentNode;
    }
    return false;
}

/**
 * Yields every descendant element of `node` in document order.
 * @param {Element|Document|DocumentFragment} node
 * @returns {Generator<Element>}
 */
function* descendants(node) {
    for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 1) {
            const el = /** @type {Element} */ (/** @type {unknown} */ (child));
            yield el;
            yield* descendants(el);
        }
    }
}

/**
 * @param {Element|Document|DocumentFragment} context
 * @param {string} selector
 * @returns {Element[]}
 */
export function selectAll(context, selector) {
    const selectors = parse(selector);
    const matches = [];
    for (const el of descendants(context)) {
        if (selectors.some((steps) => matchesChain(el, steps, steps.length - 1, /** @type {any} */ (context)))) {
            matches.push(el);
        }
    }
    return matches;
}

/**
 * @param {Element|Document|DocumentFragment} context
 * @param {string} selector
 * @returns {Element|null}
 */
export function selectFirst(context, selector) {
    const selectors = parse(selector);
    for (const el of descendants(context)) {
        if (selectors.some((steps) => matchesChain(el, steps, steps.length - 1, /** @type {any} */ (context)))) {
            return el;
        }
    }
    return null;
}

/**
 * @param {Element} el
 * @param {string} selector
 * @returns {boolean}
 */
export function matches(el, selector) {
    return parse(selector).some((steps) => matchesChain(el, steps, steps.length - 1, null));
}
