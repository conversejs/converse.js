/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Functional programming utilities
 */
export const map = f => step => (a, c) => step(a, f(c));

export const filter = predicate => step => (a, c) => predicate(c) ? step(a, c) : a;

export const compose = (...fns) => x => fns.reduceRight((y, f) => f(y), x);

export const curry = (f, arr = []) => (...args) => (
  a => a.length === f.length ? f(...a) : curry(f, a)
)([...arr, ...args]);

export const transduce = curry((step, initial, xform, foldable) =>
  foldable.reduce(xform(step), initial)
);

export const concatArray = (a, c) => a.concat([c]);

export const toArray = transduce(concatArray, []);

export const logStep = v => { console.log(v); return v; }
