import api, { converse } from '../../shared/api/index.js';
import { isTestEnv } from '../../utils/session.js';

const { Strophe, $iq } = converse.env;

let lastStanzaDate;

export function onWindowStateChanged () {
    if (!document.hidden) api.ping(null, 5000);
}

export function setLastStanzaDate (date) {
    lastStanzaDate = date;
}

function pong (ping) {
    lastStanzaDate = new Date();
    const from = ping.getAttribute('from');
    const id = ping.getAttribute('id');
    const iq = $iq({type: 'result', to: from,id: id});
    api.sendIQ(iq);
    return true;
}

export function registerPongHandler () {
    const connection = api.connection.get();
    if (connection.disco) {
        api.disco.own.features.add(Strophe.NS.PING);
    }
    return connection.addHandler(pong, Strophe.NS.PING, "iq", "get");
}

export function registerPingHandler () {
    api.connection.get()?.addHandler(() => {
        if (api.settings.get('ping_interval') > 0) {
            // Handler on each stanza, saves the received date
            // in order to ping only when needed.
            lastStanzaDate = new Date();
            return true;
        }
    });
}

let intervalId;

export function registerHandlers () {
    // Wrapper so that we can spy on registerPingHandler in tests
    registerPongHandler();
    registerPingHandler();
    clearInterval(intervalId);
    intervalId = setInterval(onEverySecond, 1000);
}

export function unregisterIntervalHandler () {
    clearInterval(intervalId);
}

export function onEverySecond () {
    if (isTestEnv() || !api.connection.authenticated()) {
        return;
    }
    const ping_interval = api.settings.get('ping_interval');
    if (ping_interval > 0) {
        const now = new Date();
        lastStanzaDate = lastStanzaDate ?? now;
        if ((now.valueOf() - lastStanzaDate.valueOf())/1000 > ping_interval) {
            api.ping();
        }
    }
}
