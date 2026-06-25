import type { DiscoInfoData } from '../disco/types';

// Parsed XEP-0115 entity capabilities, as advertised in a presence stanza's
// `<c xmlns="http://jabber.org/protocol/caps"/>` element.
export type CapsAttributes = {
    hash: string;
    node: string;
    ver: string;
};

// The verified disco#info data cached against a verification hash. Caps adds no
// fields of its own, so this is just disco's generic info shape.
export type CapsInfoData = DiscoInfoData;
