import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import Call from './model.js';
import Calls from './calls.js';
import calls_api from './api.js';
import { registerCallHandlers, unregisterCallHandlers } from './utils.js';
import { discoverIceServers } from './extdisco.js';
import { writeCallHistory } from './history.js';
import { getRTCPeerConnection } from './rtp.js';

const { Strophe } = converse.env;

converse.plugins.add('converse-jingle', {
    dependencies: ['converse-chat', 'converse-disco', 'converse-roster', 'converse-vcard'],

    initialize() {
        api.promises.add(['callsInitialized']);

        api.settings.extend({
            call_ice_servers: [],
        });

        const exports = { Call, Calls };
        Object.assign(_converse.exports, exports);

        Object.assign(api, { calls: calls_api });

        // Other clients only offer to call us once they see these, e.g.
        // Conversations needs Jingle, RTP audio, ICE-UDP and DTLS-SRTP.
        api.listen.on('addClientFeatures', () => {
            if (!getRTCPeerConnection()) return; // e.g. under Node.js, without a polyfill

            [
                Strophe.NS.JINGLE,
                Strophe.NS.JINGLE_RTP,
                Strophe.NS.JINGLE_RTP_AUDIO,
                Strophe.NS.JINGLE_ICE,
                Strophe.NS.JINGLE_DTLS,
                Strophe.NS.JINGLE_MESSAGE,
                Strophe.NS.JINGLE_GROUPING,
                Strophe.NS.JINGLE_RTP_FB,
                Strophe.NS.JINGLE_RTP_HDREXT,
                Strophe.NS.JINGLE_RTP_SSMA,
            ].forEach((feature) => api.disco.own.features.add(feature));
        });

        api.listen.on('pluginsInitialized', () => {
            const calls = new Calls();
            Object.assign(_converse.state, { calls });
            /**
             * Triggered once the `_converse.state.calls` collection has been created.
             * @event _converse#callsInitialized
             */
            api.trigger('callsInitialized');
        });

        api.listen.on('connected', registerCallHandlers);
        api.listen.on('reconnected', registerCallHandlers);
        api.listen.on('beforeTearDown', unregisterCallHandlers);

        api.listen.on('callEnded', (call) => writeCallHistory(call));

        api.listen.on('connected', discoverIceServers);
        api.listen.on('reconnected', discoverIceServers);

        api.listen.on('clearSession', () => {
            // Ending a call removes it from the collection, so iterate over a copy.
            [...(_converse.state.calls?.models ?? [])].forEach((c) => c.hangup());
            _converse.state.calls?.reset();
            delete _converse.state.ice_servers;
        });
    },
});
