/**
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Functional programming hepers.
 */

export const pipe = (...functions) => args => functions.reduce((arg, fn) => fn(arg), args);
