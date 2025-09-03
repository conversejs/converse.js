/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { _converse, api, converse } from '@converse/headless';
import { onEverySecond, onUserActivity, registerIntervalHandler, tearDown, sendCSI } from './utils.js';
import '../modal/index.js';
import './modals/profile.js';
import './modals/user-settings.js';
import './statusview.js';

const { Strophe } = converse.env;

Strophe.addNamespace('IDLE', 'urn:xmpp:idle:1');

converse.plugins.add('converse-profile', {
    dependencies: [
        'converse-status',
        'converse-modal',
        'converse-vcard',
        'converse-chatboxviews',
        'converse-adhoc-views',
    ],

    initialize() {
        api.settings.extend({
            show_client_info: true,
            auto_away: 0, // Seconds after which user status is set to 'away'
            auto_xa: 0, // Seconds after which user status is set to 'xa'
            csi_waiting_time: 0, // Support for XEP-0352. Seconds before client is considered idle and CSI is sent out.
            idle_presence_timeout: 300, // Seconds after which an idle presence is sent
        });

        const exports = {
            onUserActivity,
            onEverySecond,
            sendCSI,
            registerIntervalHandler,
        };
        Object.assign(_converse, exports); // Deprecated
        Object.assign(_converse.exports, exports);

        if (api.settings.get('idle_presence_timeout') > 0) {
            api.listen.on('addClientFeatures', () => api.disco.own.features.add(Strophe.NS.IDLE));
        }

        api.listen.on(
            'presencesInitialized',
            /** @param {boolean} reconnecting */ (reconnecting) => !reconnecting && registerIntervalHandler()
        );
        api.listen.on('beforeTearDown', tearDown);
    },
});
