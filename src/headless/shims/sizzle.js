/**
 * A stand-in for Sizzle under Node.
 *
 * Sizzle is a browser selector engine: it feature-detects against a live
 * document at import time and throws `window is not defined` under Node. The
 * `#sizzle` subpath import in package.json resolves to this module instead when
 * the `node` condition applies, so the ~140 `sizzle()` calls in the parsers keep
 * working unchanged.
 *
 * Only the two-argument call form is implemented, because that is the only one
 * Converse uses. Sizzle's leading `>` (child of the context node) is understood
 * by the selector engine.
 *
 * @module shims/sizzle
 */
import { selectAll } from './selector.js';

/**
 * @param {string} selector
 * @param {Element|Document|DocumentFragment} [context]
 * @returns {Element[]}
 */
export default function sizzle(selector, context) {
    return selectAll(context ?? globalThis.document, selector);
}
