import log from '../../log.js';
import { Strophe } from 'strophe.js';
import { settings_api } from '../settings/api.js';

export function generateResource () {
    return `/converse.js-${Math.floor(Math.random() * 139749528).toString()}`;
}

export function setUpXMLLogging (connection) {
    const lmap = {};
    lmap[Strophe.LogLevel.DEBUG] = 'debug';
    lmap[Strophe.LogLevel.INFO] = 'info';
    lmap[Strophe.LogLevel.WARN] = 'warn';
    lmap[Strophe.LogLevel.ERROR] = 'error';
    lmap[Strophe.LogLevel.FATAL] = 'fatal';

    Strophe.log = (level, msg) => log.log(msg, lmap[level]);
    Strophe.error = (msg) => log.error(msg);

    connection.xmlInput = (body) => log.debug(body.outerHTML, 'color: darkgoldenrod');
    connection.xmlOutput = (body) => log.debug(body.outerHTML, 'color: darkcyan');
}

export function getConnectionServiceURL () {
    if (('WebSocket' in window || 'MozWebSocket' in window) && settings_api.get('websocket_url')) {
        return settings_api.get('websocket_url');
    } else if (settings_api.get('bosh_service_url')) {
        return settings_api.get('bosh_service_url');
    }
    return '';
}
