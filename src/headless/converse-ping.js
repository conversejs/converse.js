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

// Strophe methods for building stanzas
const { Strophe, $iq, _ } = converse.env;

Strophe.addNamespace('PING', "urn:xmpp:ping");


converse.plugins.add('converse-ping', {

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;

        _converse.api.settings.update({
            ping_interval: 180 //in seconds
        });

        _converse.ping = function (jid, success, error, timeout) {
            // XXX: We could first check here if the server advertised that
            // it supports PING.
            // However, some servers don't advertise while still keeping the
            // connection option due to pings.
            //
            // var feature = _converse.disco_entities[_converse.domain].features.findWhere({'var': Strophe.NS.PING});
            _converse.lastStanzaDate = new Date();
            if (_.isNil(jid)) {
                jid = Strophe.getDomainFromJid(_converse.bare_jid);
            }
            if (_.isUndefined(timeout) ) { timeout = null; }
            if (_.isUndefined(success) ) { success = null; }
            if (_.isUndefined(error) ) { error = null; }
            if (_converse.connection) {
                const id = _converse.connection.getUniqueId('ping');
                const iq = $iq({
                    'type': 'get',
                    'to': jid,
                    'id': id
                }).c('ping', {'xmlns': Strophe.NS.PING});
                _converse.connection.sendIQ(iq, success, error, timeout);
                return true;
            }
            return false;
        };

        _converse.pong = function (ping) {
            _converse.lastStanzaDate = new Date();
            const from = ping.getAttribute('from');
            const id = ping.getAttribute('id');
            const iq = $iq({type: 'result', to: from,id: id});
            _converse.connection.sendIQ(iq);
            return true;
        };

        _converse.registerPongHandler = function () {
            if (!_.isUndefined(_converse.connection.disco)) {
                _converse.api.disco.own.features.add(Strophe.NS.PING);
            }
            return _converse.connection.addHandler(_converse.pong, Strophe.NS.PING, "iq", "get");
        };

        _converse.registerPingHandler = function () {
            _converse.registerPongHandler();
            if (_converse.ping_interval > 0) {
                _converse.connection.addHandler(function () {
                    /* Handler on each stanza, saves the received date
                     * in order to ping only when needed.
                     */
                    _converse.lastStanzaDate = new Date();
                    return true;
                });
                _converse.connection.addTimedHandler(1000, function () {
                    const now = new Date();
                    if (!_converse.lastStanzaDate) {
                        _converse.lastStanzaDate = now;
                    }
                    if ((now - _converse.lastStanzaDate)/1000 > _converse.ping_interval) {
                        return _converse.ping();
                    }
                    return true;
                });
            }
        };

        const onConnected = function () {
            // Wrapper so that we can spy on registerPingHandler in tests
            _converse.registerPingHandler();
        };
        _converse.api.listen.on('connected', onConnected);
        _converse.api.listen.on('reconnected', onConnected);
    }
});
