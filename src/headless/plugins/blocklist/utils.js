import converse from '../../shared/api/public.js';
import send_api from '../../shared/api/send.js';

const { Strophe, stx, u } = converse.env;

/**
 * Sends an IQ stanza to remove one or more JIDs from the blocklist
 * @param {string|string[]} jid
 */
export async function sendUnblockStanza(jid) {
    const jids = Array.isArray(jid) ? jid : [jid];
    const stanza = stx`
        <iq xmlns="jabber:client" type="set" id="${u.getUniqueId()}">
            <unblock xmlns="${Strophe.NS.BLOCKING}">
                ${jids.map((id) => stx`<item jid="${id}"/>`)}
            </unblock>
        </iq>`;
    await send_api.sendIQ(stanza);
}

/**
 * Sends an IQ stanza to add one or more JIDs from the blocklist
 * @param {string|string[]} jid
 */
export async function sendBlockStanza(jid) {
    const jids = Array.isArray(jid) ? jid : [jid];
    const stanza = stx`
        <iq xmlns="jabber:client" type="set" id="${u.getUniqueId()}">
            <block xmlns="${Strophe.NS.BLOCKING}">
                ${jids.map((id) => stx`<item jid="${id}"/>`)}
            </block>
        </iq>`;
    await send_api.sendIQ(stanza);
}
