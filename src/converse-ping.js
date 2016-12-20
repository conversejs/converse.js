// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

/* This is a Converse.js plugin which add support for application-level pings
 * as specified in XEP-0199 XMPP Ping.
 */
(function (root, factory) {
    define("converse-ping", [
        "converse-core",
        "converse-api",
        "strophe.ping"
    ], factory);
}(this, function (_converse, converse_api) {
    "use strict";
    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe;
    
    converse_api.plugins.add('converse-ping', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var _converse = this.converse;

            this.updateSettings({
                ping_interval: 180 //in seconds
            });

            _converse.ping = function (jid, success, error, timeout) {
                // XXX: We could first check here if the server advertised that
                // it supports PING.
                // However, some servers don't advertise while still keeping the
                // connection option due to pings.
                //
                // var feature = _converse.features.findWhere({'var': Strophe.NS.PING});
                _converse.lastStanzaDate = new Date();
                if (typeof jid === 'undefined' || jid === null) {
                    jid = Strophe.getDomainFromJid(_converse.bare_jid);
                }
                if (typeof timeout === 'undefined' ) { timeout = null; }
                if (typeof success === 'undefined' ) { success = null; }
                if (typeof error === 'undefined' ) { error = null; }
                if (_converse.connection) {
                    _converse.connection.ping.ping(jid, success, error, timeout);
                    return true;
                }
                return false;
            };

            _converse.pong = function (ping) {
                _converse.lastStanzaDate = new Date();
                _converse.connection.ping.pong(ping);
                return true;
            };

            _converse.registerPongHandler = function () {
                _converse.connection.disco.addFeature(Strophe.NS.PING);
                _converse.connection.ping.addPingHandler(_converse.pong);
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
                        var now = new Date();
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

            var onConnected = function () {
                // Wrapper so that we can spy on registerPingHandler in tests
                _converse.registerPingHandler();
            };
            _converse.on('connected', onConnected);
            _converse.on('reconnected', onConnected);
        }
    });
}));
