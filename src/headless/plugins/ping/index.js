/**
 * @description
 * Converse.js plugin which add support for application-level pings
 * as specified in XEP-0199 XMPP Ping.
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import ping_api from './api.js';
import { api, converse } from "@converse/headless/core.js";
import { onEverySecond, onWindowStateChanged, onConnected } from './utils.js';

const { Strophe } = converse.env;


Strophe.addNamespace('PING', "urn:xmpp:ping");


converse.plugins.add('converse-ping', {

    initialize () {
        api.settings.extend({
            ping_interval: 60 //in seconds
        });

        Object.assign(api, ping_api);

        setInterval(onEverySecond, 1000);

        api.listen.on('connected', onConnected);
        api.listen.on('reconnected', onConnected);
        api.listen.on('windowStateChanged', onWindowStateChanged);
    }
});
