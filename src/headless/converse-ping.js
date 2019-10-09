// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-ping
 * @description
 * Converse.js plugin which add support for application-level pings
 * as specified in XEP-0199 XMPP Ping.
 */
import converse from "./converse-core";
const { Strophe, $iq } = converse.env;
const u = converse.env.utils;

Strophe.addNamespace('PING', "urn:xmpp:ping");


converse.plugins.add('converse-ping', {

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;
        let lastStanzaDate;

        _converse.api.settings.update({
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
                _converse.api.disco.own.features.add(Strophe.NS.PING);
            }
            return _converse.connection.addHandler(pong, Strophe.NS.PING, "iq", "get");
        }

        function registerPingHandler () {
            _converse.connection.addHandler(() => {
                if (_converse.ping_interval > 0) {
                    // Handler on each stanza, saves the received date
                    // in order to ping only when needed.
                    lastStanzaDate = new Date();
                    return true;
                }
            });
        }

        setTimeout(() => {
            if (_converse.ping_interval > 0) {
                const now = new Date();
                if (!lastStanzaDate) {
                    lastStanzaDate = now;
                }
                if ((now - lastStanzaDate)/1000 > _converse.ping_interval) {
                    return _converse.api.ping();
                }
                return true;
            }
        }, 1000);


        const onConnected = function () {
            // Wrapper so that we can spy on registerPingHandler in tests
            registerPongHandler();
            registerPingHandler();
        };
        _converse.api.listen.on('connected', onConnected);
        _converse.api.listen.on('reconnected', onConnected);


        /************************ BEGIN API ************************/
        Object.assign(_converse.api, {
            /**
             * Pings the service represented by the passed in JID by sending an
             * IQ stanza.
             * @private
             * @method _converse.api.ping
             * @param { string } [jid] - The JID of the service to ping
             */
            async ping (jid) {
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
                            'id': _converse.connection.getUniqueId('ping')
                        }).c('ping', {'xmlns': Strophe.NS.PING});

                    const result = await _converse.api.sendIQ(iq, 10000, false);
                    if (result === null) {
                        _converse.log(`Timeout while pinging ${jid}`, Strophe.LogLevel.WARN);
                        if (jid === Strophe.getDomainFromJid(_converse.bare_jid)) {
                            _converse.api.connection.reconnect();
                        }
                    } else if (u.isErrorStanza(result)) {
                        _converse.log(`Error while pinging ${jid}`, Strophe.LogLevel.ERROR);
                        _converse.log(result, Strophe.LogLevel.ERROR);
                    }
                    return true;
                }
                return false;
            }
        });
    }
});
