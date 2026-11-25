import { Strophe } from 'strophe.js';
import { settings_api } from '../settings/api.js';

export function generateResource() {
    return `/converse.js-${Math.floor(Math.random() * 139749528).toString()}`;
}

export function setStropheLogLevel() {
    const level = settings_api.get('loglevel');
    Strophe.setLogLevel(Strophe.LogLevel[level.toUpperCase()]);
}

export function getConnectionServiceURL() {
    if (('WebSocket' in globalThis || 'MozWebSocket' in globalThis) && settings_api.get('websocket_url')) {
        return settings_api.get('websocket_url');
    } else if (settings_api.get('bosh_service_url')) {
        return settings_api.get('bosh_service_url');
    }
    return '';
}
