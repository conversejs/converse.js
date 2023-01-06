export function toStanza(string: any): Element;
/**
 * Tagged template literal function which can be used to generate XML stanzas.
 * Similar to the `html` function, from Lit.
 *
 * @example stx`<presence type="${type}"><show>${show}</show></presence>`
 */
export function stx(strings: any, ...values: any[]): Element;
