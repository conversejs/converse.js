// Converse.js
// http://conversejs.org
//
// Copyright (c) The Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
//
/**
 * @module converse-smacks
 * @description
 * Converse.js plugin which adds support for XEP-0198: Stream Management
 */
import converse from "./converse-core";

const { Strophe, } = converse.env;
const u = converse.env.utils;


Strophe.addNamespace('SM', 'urn:xmpp:sm:3');


converse.plugins.add('converse-smacks', {

    initialize () {
        const { _converse } = this;

        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        _converse.api.settings.update({
            'enable_smacks': false,
            'smacks_max_unacked_stanzas': 5,
        });

        function isStreamManagementSupported () {
            if (_converse.api.connection.isType('bosh') && !_converse.isTestEnv()) {
                return false;
            }
            return _converse.api.disco.stream.getFeature('sm', Strophe.NS.SM);
        }

        function handleAck (el) {
            if (!_converse.session.get('smacks_enabled')) {
                return true;
            }
            const handled = parseInt(el.getAttribute('h'), 10);
            const last_known_handled = _converse.session.get('num_stanzas_handled_by_server');
            const delta = handled - last_known_handled;

            if (delta < 0) {
                const err_msg = `New reported stanza count lower than previous. `+
                    `New: ${handled} - Previous: ${last_known_handled}`
                _converse.log(err_msg, Strophe.LogLevel.ERROR);
            }
            const unacked_stanzas = _converse.session.get('unacked_stanzas');
            if (delta > unacked_stanzas.length) {
                const err_msg =
                    `Higher reported acknowledge count than unacknowledged stanzas. `+
                    `Reported Acknowledged Count: ${delta} -`+
                    `Unacknowledged Stanza Count: ${unacked_stanzas.length} -`+
                    `New: ${handled} - Previous: ${last_known_handled}`
                _converse.log(err_msg, Strophe.LogLevel.ERROR);
            }
            _converse.session.save({
                'num_stanzas_handled_by_server': handled,
                'num_stanzas_since_last_ack': 0,
                'unacked_stanzas': unacked_stanzas.slice(delta)
            });
            return true;
        }

        function sendAck() {
            if (_converse.session.get('smacks_enabled')) {
                const h = _converse.session.get('num_stanzas_handled');
                const stanza = u.toStanza(`<a xmlns="${Strophe.NS.SM}" h="${h}"/>`);
                _converse.api.send(stanza);
            }
            return true;
        }

        function stanzaHandler (el) {
            if (_converse.session.get('smacks_enabled')) {
                if (u.isTagEqual(el, 'iq') || u.isTagEqual(el, 'presence') || u.isTagEqual(el, 'message'))  {
                    const h = _converse.session.get('num_stanzas_handled');
                    _converse.session.save('num_stanzas_handled', h+1);
                }
            }
            return true;
        }

        function initSessionData () {
            _converse.session.save({
                'smacks_enabled': _converse.session.get('smacks_enabled') || false,
                'num_stanzas_handled': _converse.session.get('num_stanzas_handled') || 0,
                'num_stanzas_handled_by_server': _converse.session.get('num_stanzas_handled_by_server') || 0,
                'num_stanzas_since_last_ack': _converse.session.get('num_stanzas_since_last_ack') || 0,
                'unacked_stanzas': _converse.session.get('unacked_stanzas') || []
            });
        }

        function resetSessionData () {
            _converse.session && _converse.session.save({
                'smacks_enabled': false,
                'num_stanzas_handled': 0,
                'num_stanzas_handled_by_server': 0,
                'num_stanzas_since_last_ack': 0,
                'unacked_stanzas': []
            });
        }

        function saveSessionData (el) {
            const data = {'smacks_enabled': true};
            if (['1', 'true'].includes(el.getAttribute('resume'))) {
                data['smacks_stream_id'] = el.getAttribute('id');
            }
            _converse.session.save(data);
            return true;
        }

        function onFailedStanza (el) {
            if (el.querySelector('item-not-found')) {
                // Stream resumption must happen before resource binding but
                // enabling a new stream must happen after resource binding.
                // Since resumption failed, we simply continue.
                //
                // After resource binding, sendEnableStanza will be called
                // based on the afterResourceBinding event.
                _converse.log('Could not resume previous SMACKS session, session id not found. '+
                              'A new session will be established.', Strophe.LogLevel.WARN);
            } else {
                _converse.log('Failed to enable stream management', Strophe.LogLevel.ERROR);
                _converse.log(el.outerHTML, Strophe.LogLevel.ERROR);
            }
            resetSessionData();
            return true;
        }

        function resendUnackedStanzas () {
            const stanzas = _converse.session.get('unacked_stanzas');
            // We clear the unacked_stanzas array because it'll get populated
            // again in `onStanzaSent`
            _converse.session.save('unacked_stanzas', []);

            // XXX: Currently we're resending *all* unacked stanzas, including
            // IQ[type="get"] stanzas that longer have handlers (because the
            // page reloaded or we reconnected, causing removal of handlers).
            //
            // *Side-note:* Is it necessary to clear handlers upon reconnection?
            //
            // I've considered not resending those stanzas, but then keeping
            // track of what's been sent and ack'd and their order gets
            // prohibitively complex.
            //
            // It's unclear how much of a problem this poses.
            //
            // Two possible solutions are running @converse/headless as a
            // service worker or handling IQ[type="result"] stanzas
            // differently, more like push stanzas, so that they don't need
            // explicit handlers.
            stanzas.forEach(s => _converse.api.send(s));
        }

        function onResumedStanza (el) {
            saveSessionData(el);
            handleAck(el);
            resendUnackedStanzas();
            _converse.connection.do_bind = false; // No need to bind our resource anymore
            _converse.connection.authenticated = true;
            _converse.connection.restored = true;
            _converse.connection._changeConnectStatus(Strophe.Status.CONNECTED, null);
        }

        async function sendResumeStanza () {
            const promise = u.getResolveablePromise();
            _converse.connection._addSysHandler(el => promise.resolve(onResumedStanza(el)), Strophe.NS.SM, 'resumed');
            _converse.connection._addSysHandler(el => promise.resolve(onFailedStanza(el)), Strophe.NS.SM, 'failed');

            const previous_id = _converse.session.get('smacks_stream_id');
            const h = _converse.session.get('num_stanzas_handled');
            const stanza = u.toStanza(`<resume xmlns="${Strophe.NS.SM}" h="${h}" previd="${previous_id}"/>`);
            _converse.api.send(stanza);
            _converse.connection.flush();
            await promise;
        }

        async function sendEnableStanza () {
            if (!_converse.enable_smacks || _converse.session.get('smacks_enabled')) {
                return;
            }
            if (await isStreamManagementSupported()) {
                const promise = u.getResolveablePromise();
                _converse.connection._addSysHandler(el => promise.resolve(saveSessionData(el)), Strophe.NS.SM, 'enabled');
                _converse.connection._addSysHandler(el => promise.resolve(onFailedStanza(el)), Strophe.NS.SM, 'failed');

                const resume = (_converse.api.connection.isType('websocket') || _converse.isTestEnv());
                const stanza = u.toStanza(`<enable xmlns="${Strophe.NS.SM}" resume="${resume}"/>`);
                _converse.api.send(stanza);
                _converse.connection.flush();
                await promise;
            }
        }

        async function enableStreamManagement () {
            if (!_converse.enable_smacks) {
                return;
            }
            if (!(await isStreamManagementSupported())) {
                return;
            }
            _converse.connection.addHandler(stanzaHandler);
            _converse.connection.addHandler(sendAck, Strophe.NS.SM, 'r');
            _converse.connection.addHandler(handleAck, Strophe.NS.SM, 'a');
            if (_converse.session.get('smacks_stream_id')) {
                await sendResumeStanza();
            } else {
                resetSessionData();
            }
        }

        function onStanzaSent (stanza) {
            if (!_converse.session) {
                _converse.log('No _converse.session!', Strophe.LogLevel.WARN);
                return;
            }
            if (!_converse.session.get('smacks_enabled')) {
                return;
            }
            if (u.isTagEqual(stanza, 'iq') ||
                    u.isTagEqual(stanza, 'presence') ||
                    u.isTagEqual(stanza, 'message')) {

                const stanza_string = Strophe.serialize(stanza);
                _converse.session.save(
                    'unacked_stanzas',
                    (_converse.session.get('unacked_stanzas') || []).concat([stanza_string])
                );
                const max_unacked = _converse.smacks_max_unacked_stanzas;
                if (max_unacked > 0) {
                    const num = _converse.session.get('num_stanzas_since_last_ack') + 1;
                    if (num % max_unacked === 0) {
                        // Request confirmation of sent stanzas
                        _converse.api.send(u.toStanza(`<r xmlns="${Strophe.NS.SM}"/>`));
                    }
                    _converse.session.save({'num_stanzas_since_last_ack': num});
                }
            }
        }

        _converse.api.listen.on('userSessionInitialized', initSessionData);
        _converse.api.listen.on('beforeResourceBinding', enableStreamManagement);
        _converse.api.listen.on('afterResourceBinding', sendEnableStanza);
        _converse.api.listen.on('send', onStanzaSent);
    }
});
