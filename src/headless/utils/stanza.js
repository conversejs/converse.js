const parser = new DOMParser();
const parserErrorNS = parser.parseFromString('invalid', 'text/xml')
                            .getElementsByTagName("parsererror")[0].namespaceURI;

export function toStanza (string) {
    const node = parser.parseFromString(string, "text/xml");
    if (node.getElementsByTagNameNS(parserErrorNS, 'parsererror').length) {
        throw new Error(`Parser Error: ${string}`);
    }
    return node.firstElementChild;
}


/**
 * Tagged template literal function which can be used to generate XML stanzas.
 * Similar to the `html` function, from Lit.
 *
 * @example stx`<presence type="${type}"><show>${show}</show></presence>`
 */
export function stx (strings, ...values) {
    return toStanza(
        strings.reduce((acc, str) => {
            const idx = strings.indexOf(str);
            return acc + str + (values.length > idx ? values[idx] : '')
        }, '')
    );
}
