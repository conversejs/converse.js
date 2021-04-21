import log from '@converse/headless/log.js';
import { _converse, api, converse } from "@converse/headless/core.js";
import { setLastStanzaDate } from './utils.js';

const { Strophe, $iq, u } = converse.env;

export default {
    /**
     * Pings the service represented by the passed in JID by sending an IQ stanza.
     * @private
     * @method api.ping
     * @param { String } [jid] - The JID of the service to ping
     * @param { Integer } [timeout] - The amount of time in
     *  milliseconds to wait for a response. The default is 10000;
     */
    async ping (jid, timeout) {
        // XXX: We could first check here if the server advertised that it supports PING.
        // However, some servers don't advertise while still responding to pings
        //
        // const feature = _converse.disco_entities[_converse.domain].features.findWhere({'var': Strophe.NS.PING});
        setLastStanzaDate(new Date());
        jid = jid || Strophe.getDomainFromJid(_converse.bare_jid);
        if (_converse.connection) {
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
            } else if (u.isErrorStanza(result)) {
                log.error(`Error while pinging ${jid}`);
                log.error(result);
            }
            return true;
        }
        return false;
    }
}
