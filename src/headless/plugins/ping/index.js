/**
 * @description
 * Converse.js plugin which add support for application-level pings
 * as specified in XEP-0199 XMPP Ping.
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import api, { converse } from '../../shared/api/index.js';
import ping_api from './api.js';
import { onWindowStateChanged, registerHandlers, unregisterIntervalHandler } from './utils.js';

const { Strophe } = converse.env;


Strophe.addNamespace('PING', "urn:xmpp:ping");


converse.plugins.add('converse-ping', {

    initialize () {
        api.settings.extend({
            ping_interval: 60 //in seconds
        });

        Object.assign(api, ping_api);

        api.listen.on('connected', registerHandlers);
        api.listen.on('reconnected', registerHandlers);
        api.listen.on('disconnected', unregisterIntervalHandler);

        document.addEventListener('visibilitychange', onWindowStateChanged);
    }
});
