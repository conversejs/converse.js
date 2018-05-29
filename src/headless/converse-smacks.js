// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/* This is a Converse.js plugin which add support for XEP-0198: Stream Management */

import converse from "./converse-core";

const { Strophe, $build, _ } = converse.env;
Strophe.addNamespace('SM', 'urn:xmpp:sm:3');


converse.plugins.add('converse-smacks', {

    initialize () {
        const { _converse } = this;

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        _converse.api.settings.update({
            'smacks_max_unacked_stanzas': 5,
        });

        function isStreamManagementSupported () {
            return _converse.api.disco.stream.getFeature('sm', Strophe.NS.SM);
        }

        function handleAck (el) {
            if (_converse.session.get('smacks_enabled')) {
                const handled = parseInt(el.getAttribute('h'), 10),
                      last_known_handled = _converse.session.get('num_stanzas_handled_by_server'),
                      delta = handled - last_known_handled;

                if (delta < 0) {
                    return new Error(
                        `New reported stanza count lower than previous. `+
                        `New: ${handled} - Previous: ${last_known_handled}`
                    );
                }
                const unacked_stanzas = _converse.session.get('unacked_stanzas');
                if (delta > _converse.session.get('unacked_stanzas').length) {
                    return new Error(
                        `Higher reported acknowledge count than unacknowledged stanzas. `+
                        `Reported Acknowledged Count: ${delta} -`+
                        `Unacknowledged Stanza Count: ${unacked_stanzas.length} -`+
                        `New: ${handled} - Previous: ${last_known_handled}`
                    );
                }
                _converse.session.save({
                    'num_stanzas_handled_by_server': handled,
                    'num_stanzas_since_last_ack': 0,
                    'unacked_stanzas': unacked_stanzas.slice(delta)
                });
            }
            return true;
        }

        function sendAck() {
            if (_converse.session.get('smacks_enabled')) {
                converse.connection.send($build('a', {
                    'xmlns': Strophe.NS.SM,
                    'h': _converse.session.get('num_stanzas_handled')
                }));
            }
            return true;
        }

        function requestAcknowledgement () {
            _converse.session.set('num_stanzas_since_last_ack', 0);
            _converse.connection.send($build('r', {'xmlns': Strophe.NS.SM}));
        }

        function stanzaHandler (el) {
            if (_converse.session.get('smacks_enabled')) {
                if (Strophe.isTagEqual(el, 'iq') || Strophe.isTagEqual(el, 'presence') || Strophe.isTagEqual(el, 'message'))  {
                    const h = _converse.session.get('num_stanzas_handled');
                    _converse.session.save('num_stanzas_handled', h+1);
                }
            }
            return true;
        }

        function initSMACKS(el) {
            let enabled;
            if (Strophe.isTagEqual(el, 'failed')) {
                enabled = false;
                _converse.log('Failed to enable stream management', Strophe.LogLevel.ERROR);
                _converse.log(el.outerHTML, Strophe.LogLevel.ERROR);
            } else {
                enabled = true;
            }
            _converse.session.save({
                'smacks_enabled': enabled,
                'num_stanzas_handled': 0,
                'num_stanzas_handled_by_server': 0,
                'num_stanzas_since_last_ack': 0,
                'unacked_stanzas': []
            });
            _converse.connection.resume();
            return true;
        }

        async function enable () {
            if (!(await isStreamManagementSupported())) {
                return;
            }
            _converse.connection.addHandler(stanzaHandler);
            _converse.connection.addHandler(sendAck, Strophe.NS.SM, 'r');
            _converse.connection.addHandler(handleAck, Strophe.NS.SM, 'a');
            _converse.connection.addHandler(initSMACKS, Strophe.NS.SM, 'enabled');
            _converse.connection.addHandler(initSMACKS, Strophe.NS.SM, 'failed');

            _converse.session.save('stanzas_sent', 0);

            const stanza = $build('enable', {
                'xmlns': Strophe.NS.SM,
                'resume': false
            });
            _converse.connection.send(stanza);
            _converse.connection.flush();
            _converse.connection.pause();
        }


        function onStanzaSent (el) {
            if (_converse.session.get('smacks_enabled')) {
                return;
            }
            for (let i = 0; i < el.children.length; i++) {
                const child = el.children[i];
                if (Strophe.isTagEqual(child, 'iq') ||
                    Strophe.isTagEqual(child, 'presence') ||
                    Strophe.isTagEqual(child, 'message')) {

                    _converse.session.save(
                        'unacked_stanzas',
                        _converse.session.get('unacked_stanzas').concat([el])
                    );
                    if (_converse.smacks_max_unacked_stanzas > 0) {
                        _converse.session.save(
                            'num_stanzas_since_last_ack',
                            _converse.session.get('num_stanzas_since_last_ack') + 1
                        );
                        if (_converse.session.get('num_stanzas_since_last_ack') === _converse.smacks_max_unacked_stanzas) {
                            this.requestAcknowledgement();
                        }
                    }
                }
            }
        }

        _converse.api.listen.on('streamFeaturesAdded', enable);
        _converse.api.listen.on('send', enable);
    }
});
