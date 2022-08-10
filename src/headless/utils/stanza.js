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


export function stanza (strings, ...values) {
    return toStanza(
        strings.reduce((acc, str) => {
            const idx = strings.indexOf(str);
            return acc + str + (values.length > idx ? values[idx] : '')
        }, '')
    );
}
