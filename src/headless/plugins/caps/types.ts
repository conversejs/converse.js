// Parsed XEP-0115 entity capabilities, as advertised in a presence stanza's
// `<c xmlns="http://jabber.org/protocol/caps"/>` element.
export type CapsAttributes = {
    hash: string;
    node: string;
    ver: string;
};
