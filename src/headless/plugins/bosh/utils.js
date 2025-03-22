/**
 * @typedef {module:shared.api.user} LoginHookPayload
 */
import log from "@converse/log";
import api from '../../shared/api/index.js';
import _converse from "../../shared/_converse.js";
import { Strophe } from "strophe.js";
import { Model } from '@converse/skeletor';
import { createStore } from '../../utils/storage.js';
import { isTestEnv } from '../../utils/session.js';
import { setUserJID, } from '../../utils/init.js';
import { BOSH_WAIT, PREBIND } from '../../shared/constants.js';

const BOSH_SESSION_ID = 'converse.bosh-session';

let bosh_session;

async function initBOSHSession () {
    const id = BOSH_SESSION_ID;
    if (!bosh_session) {
        bosh_session = new Model({id});
        bosh_session.browserStorage = createStore(id, "session");
        await new Promise(resolve => bosh_session.fetch({'success': resolve, 'error': resolve}));
    }

    let jid = _converse.session.get('jid');
    if (jid) {
        if (bosh_session.get('jid') !== jid) {
            jid = await setUserJID(jid);
            bosh_session.clear({'silent': true });
            bosh_session.save({jid});
        }
    } else { // Keepalive
        const jid = bosh_session.get('jid');
        jid && await setUserJID(jid);
    }
    return bosh_session;
}


export function startNewPreboundBOSHSession () {
    if (!api.settings.get('prebind_url')) {
        throw new Error("startNewPreboundBOSHSession: If you use prebind then you MUST supply a prebind_url");
    }
    const connection = api.connection.get();
    const xhr = new XMLHttpRequest();
    xhr.open('GET', api.settings.get('prebind_url'), true);
    xhr.setRequestHeader('Accept', 'application/json, text/javascript');
    xhr.onload = async function (event) {
        if (xhr.status >= 200 && xhr.status < 400) {
            const data = JSON.parse(xhr.responseText);
            const jid = await setUserJID(data.jid);
            connection.attach(
                jid,
                data.sid,
                data.rid,
                connection.onConnectStatusChanged,
                BOSH_WAIT
            );
        } else {
            xhr.onerror(event);
        }
    };
    xhr.onerror = function () {
        api.connection.destroy();
        /**
         * Triggered when fetching prebind tokens failed
         * @event _converse#noResumeableBOSHSession
         * @type { _converse }
         * @example _converse.api.listen.on('noResumeableBOSHSession', _converse => { ... });
         */
        api.trigger('noResumeableBOSHSession', _converse);
    };
    xhr.send();
}

/**
 * @param {unknown} _
 * @param {LoginHookPayload} payload
 */
export async function attemptPrebind (_, payload) {
    if (payload.success) return payload;

    const { automatic } = payload;
    // See whether there is a BOSH session to re-attach to
    if (await restoreBOSHSession()) {
        return { ...payload, success: true };
    } else if (api.settings.get("authentication") === PREBIND && (!automatic || api.settings.get("auto_login"))) {
        startNewPreboundBOSHSession();
        return { ...payload, success: true };
    }
    return payload;
}

export function saveJIDToSession() {
    if (bosh_session !== undefined) {
        bosh_session.save({'jid': _converse.session.get('jid')});
    }
}

export function clearSession () {
    if (bosh_session === undefined) {
        // Remove manually, even if we don't have the corresponding
        // model, to avoid trying to reconnect to a stale BOSH session
        const id = BOSH_SESSION_ID;
        sessionStorage.removeItem(id);
        sessionStorage.removeItem(`${id}-${id}`);
    } else {
        bosh_session.destroy();
        bosh_session = undefined;
    }
}


export async function restoreBOSHSession () {
    const jid = (await initBOSHSession()).get('jid');
    const connection = api.connection.get();
    if (jid && (connection._proto instanceof Strophe.Bosh)) {
        try {
            connection.restore(jid, connection.onConnectStatusChanged);
            return true;
        } catch (e) {
            !isTestEnv() && log.warn("Could not restore session for jid: "+jid+" Error message: "+e.message);
            return false;
        }
    }
    return false;
}
