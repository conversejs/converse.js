import XMPPStatus from './status.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import status_api from './api.js';
import { shouldClearCache } from '../../utils/session.js';
import {
    initStatus,
    onEverySecond,
    onUserActivity,
    registerIntervalHandler,
    tearDown,
    sendCSI
} from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('IDLE', 'urn:xmpp:idle:1');


converse.plugins.add('converse-status', {

    initialize () {

        api.settings.extend({
            auto_away: 0, // Seconds after which user status is set to 'away'
            auto_xa: 0, // Seconds after which user status is set to 'xa'
            csi_waiting_time: 0, // Support for XEP-0352. Seconds before client is considered idle and CSI is sent out.
            default_state: 'online',
            idle_presence_timeout: 300, // Seconds after which an idle presence is sent
            priority: 0,
        });
        api.promises.add(['statusInitialized']);

        const exports = { XMPPStatus, onUserActivity, onEverySecond, sendCSI, registerIntervalHandler };
        Object.assign(_converse, exports); // Deprecated
        Object.assign(_converse.exports, exports);
        Object.assign(_converse.api.user, status_api);

        if (api.settings.get("idle_presence_timeout") > 0) {
            api.listen.on('addClientFeatures', () => api.disco.own.features.add(Strophe.NS.IDLE));
        }

        api.listen.on('presencesInitialized', (reconnecting) => (!reconnecting && registerIntervalHandler()));
        api.listen.on('beforeTearDown', tearDown);

        api.listen.on('clearSession', () => {
            if (shouldClearCache(_converse) && _converse.state.xmppstatus) {
                _converse.state.xmppstatus.destroy();
                delete _converse.state.xmppstatus;
                Object.assign(_converse, { xmppstatus: undefined }); // XXX DEPRECATED
                api.promises.add(['statusInitialized']);
            }
        });

        api.listen.on('connected', () => initStatus(false));
        api.listen.on('reconnected', () => initStatus(true));
    }
});
