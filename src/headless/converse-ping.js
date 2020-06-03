/**
 * @module converse-ping
 * @description
 * Converse.js plugin which add support for application-level pings
 * as specified in XEP-0199 XMPP Ping.
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, converse } from "./converse-core";
import log from "./log";

const { Strophe, $iq } = converse.env;
const u = converse.env.utils;

Strophe.addNamespace('PING', "urn:xmpp:ping");


converse.plugins.add('converse-ping', {

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        let lastStanzaDate;

        api.settings.extend({
            ping_interval: 60 //in seconds
        });

        function pong (ping) {
            lastStanzaDate = new Date();
            const from = ping.getAttribute('from');
            const id = ping.getAttribute('id');
            const iq = $iq({type: 'result', to: from,id: id});
            _converse.connection.sendIQ(iq);
            return true;
        }

        function registerPongHandler () {
            if (_converse.connection.disco !== undefined) {
                api.disco.own.features.add(Strophe.NS.PING);
            }
            return _converse.connection.addHandler(pong, Strophe.NS.PING, "iq", "get");
        }

        function registerPingHandler () {
            _converse.connection.addHandler(() => {
                if (api.settings.get('ping_interval') > 0) {
                    // Handler on each stanza, saves the received date
                    // in order to ping only when needed.
                    lastStanzaDate = new Date();
                    return true;
                }
            });
        }

        setTimeout(() => {
            if (api.settings.get('ping_interval') > 0) {
                const now = new Date();
                if (!lastStanzaDate) {
                    lastStanzaDate = now;
                }
                if ((now - lastStanzaDate)/1000 > api.settings.get('ping_interval')) {
                    return api.ping();
                }
                return true;
            }
        }, 1000);


        /************************ BEGIN Event Handlers ************************/
        const onConnected = function () {
            // Wrapper so that we can spy on registerPingHandler in tests
            registerPongHandler();
            registerPingHandler();
        };
        api.listen.on('connected', onConnected);
        api.listen.on('reconnected', onConnected);


        function onWindowStateChanged (data) {
            if (data.state === 'visible' && api.connection.connected()) {
                api.ping(null, 5000);
            }
        }
        api.listen.on('windowStateChanged', onWindowStateChanged);
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(api, {
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
                lastStanzaDate = new Date();
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
        });
    }
});
