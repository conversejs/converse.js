import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import Call from './model.js';
import Calls from './calls.js';
import calls_api from './api.js';
import { registerCallHandlers } from './utils.js';

converse.plugins.add('converse-jingle', {
    dependencies: ['converse-disco', 'converse-roster', 'converse-vcard'],

    initialize() {
        api.promises.add(['callsInitialized']);

        const exports = { Call, Calls };
        Object.assign(_converse.exports, exports);

        Object.assign(api, { calls: calls_api });

        // We don't advertise Jingle RTP disco features yet: this only does JMI
        // signalling, so claiming RTP-audio capability would be premature.

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

        api.listen.on('clearSession', () => {
            _converse.state.calls?.forEach((c) => c.hangup());
            _converse.state.calls?.reset();
        });
    },
});
