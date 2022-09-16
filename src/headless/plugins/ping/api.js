import log from '@converse/headless/log.js';
import { _converse, api, converse } from "@converse/headless/core.js";
import { setLastStanzaDate } from './utils.js';

const { Strophe, $iq, u } = converse.env;

export default {
    /**
     * Pings the entity represented by the passed in JID by sending an IQ stanza to it.
     * If we already know we're not connected, no ping is sent out and `false` is returned.
     * If the ping is sent out to the user's bare JID and no response is received it will attempt to reconnect.
     * @method api.ping
     * @param { String } [jid] - The JID of the service to ping
     * @param { Integer } [timeout] - The amount of time in
     *  milliseconds to wait for a response. The default is 10000;
     * @returns { Boolean } Whether the pinged entity responded with a non-error IQ stanza.
     */
    async ping (jid, timeout) {
        if (!api.connection.connected()) {
            log.warn("Not pinging when we know we're not connected");
            return false;
        }

        // XXX: We could first check here if the server advertised that it supports PING.
        // However, some servers don't advertise while still responding to pings
        // const feature = _converse.disco_entities[_converse.domain].features.findWhere({'var': Strophe.NS.PING});
        setLastStanzaDate(new Date());
        jid = jid || Strophe.getDomainFromJid(_converse.bare_jid);
        const iq = $iq({
                'type': 'get',
                'to': jid,
                'id': u.getUniqueId('ping')
            }).c('ping', {'xmlns': Strophe.NS.PING});

        const result = await api.sendIQ(iq, timeout || 10000, false);
        if (result === null) {
            log.warn(`Timeout while pinging ${jid}`);
            if (jid === Strophe.getDomainFromJid(_converse.bare_jid)) {
                api.connection.reconnect();
            }
            return false;
        } else if (u.isErrorStanza(result)) {
            log.error(`Error while pinging ${jid}`);
            log.error(result);
            return false;
        }
        return true;
    }
}
