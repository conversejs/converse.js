/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Converse.js plugin which add support for XEP-0206: XMPP Over BOSH
 */
import 'strophe.js/src/bosh';
import _converse from '../shared/_converse.js';
import api, { converse } from '../shared/api/index.js';
import log from "../log.js";
import { BOSH_WAIT } from '../shared/constants.js';
import { Model } from '@converse/skeletor/src/model.js';
import { setUserJID, } from '../utils/init.js';
import { isTestEnv } from '../utils/session.js';
import { createStore } from '../utils/storage.js';

const { Strophe } = converse.env;

const BOSH_SESSION_ID = 'converse.bosh-session';


converse.plugins.add('converse-bosh', {

    enabled () {
        return !_converse.api.settings.get("blacklisted_plugins").includes('converse-bosh');
    },

    initialize () {
        api.settings.extend({
            bosh_service_url: undefined,
            prebind_url: null
        });


        async function initBOSHSession () {
            const id = BOSH_SESSION_ID;
            if (!_converse.bosh_session) {
                _converse.bosh_session = new Model({id});
                _converse.bosh_session.browserStorage = createStore(id, "session");
                await new Promise(resolve => _converse.bosh_session.fetch({'success': resolve, 'error': resolve}));
            }
            if (_converse.jid) {
                if (_converse.bosh_session.get('jid') !== _converse.jid) {
                    const jid = await setUserJID(_converse.jid);
                    _converse.bosh_session.clear({'silent': true });
                    _converse.bosh_session.save({jid});
                }
            } else { // Keepalive
                const jid = _converse.bosh_session.get('jid');
                jid && await setUserJID(jid);
            }
            return _converse.bosh_session;
        }


        _converse.startNewPreboundBOSHSession = function () {
            if (!api.settings.get('prebind_url')) {
                throw new Error("startNewPreboundBOSHSession: If you use prebind then you MUST supply a prebind_url");
            }
            const connection = api.connection.get();
            const xhr = new XMLHttpRequest();
            xhr.open('GET', api.settings.get('prebind_url'), true);
            xhr.setRequestHeader('Accept', 'application/json, text/javascript');
            xhr.onload = async function () {
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
                    xhr.onerror();
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


        _converse.restoreBOSHSession = async function () {
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


        /************************ BEGIN Event Handlers ************************/
        api.listen.on('clearSession', () => {
            if (_converse.bosh_session === undefined) {
                // Remove manually, even if we don't have the corresponding
                // model, to avoid trying to reconnect to a stale BOSH session
                const id = BOSH_SESSION_ID;
                sessionStorage.removeItem(id);
                sessionStorage.removeItem(`${id}-${id}`);
            } else {
                _converse.bosh_session.destroy();
                delete _converse.bosh_session;
            }
        });

        api.listen.on('setUserJID', () => {
            if (_converse.bosh_session !== undefined) {
                _converse.bosh_session.save({'jid': _converse.jid});
            }
        });

        api.listen.on('addClientFeatures', () => api.disco.own.features.add(Strophe.NS.BOSH));

        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(api, {
            /**
             * This namespace lets you access the BOSH tokens
             *
             * @namespace api.tokens
             * @memberOf api
             */
            tokens: {
                /**
                 * @method api.tokens.get
                 * @param { string } [id] The type of token to return ('rid' or 'sid').
                 * @returns 'string' A token, either the RID or SID token depending on what's asked for.
                 * @example _converse.api.tokens.get('rid');
                 */
                get (id) {
                    const connection = api.connection.get();
                    if (!connection) {
                        return null;
                    }
                    if (id.toLowerCase() === 'rid') {
                        return connection.rid || connection._proto.rid;
                    } else if (id.toLowerCase() === 'sid') {
                        return connection.sid || connection._proto.sid;
                    }
                }
            }
        });
        /************************ end api ************************/
    }
});
