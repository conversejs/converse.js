// Converse.js
// http://conversejs.org
//
// Copyright (c) The Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-bosh
 * @description
 * Converse.js plugin which add support for XEP-0206: XMPP Over BOSH
 */
import 'strophe.js/src/bosh';
import BrowserStorage from "backbone.browserStorage";
import converse from "./converse-core";

const { Backbone, Strophe } = converse.env;

const BOSH_SESSION_ID = 'converse.bosh-session';


converse.plugins.add('converse-bosh', {

    initialize () {
        const { _converse } = this;

        _converse.api.settings.update({
            bosh_service_url: undefined,
            prebind_url: null
        });


        async function initBOSHSession () {
            const id = BOSH_SESSION_ID;
            if (!_converse.bosh_session) {
                _converse.bosh_session = new Backbone.Model({id});
                _converse.bosh_session.browserStorage = new BrowserStorage.session(id);
                await new Promise(resolve => _converse.bosh_session.fetch({'success': resolve, 'error': resolve}));
            }
            if (_converse.jid && _converse.bosh_session.get('jid') === _converse.jid) {
                _converse.bosh_session.clear({'silent': true });
                _converse.bosh_session.save({'jid': _converse.jid, id});
            }
            return _converse.bosh_session;
        }


        _converse.startNewPreboundBOSHSession = function () {
            if (!_converse.prebind_url) {
                throw new Error(
                    "attemptPreboundSession: If you use prebind then you MUST supply a prebind_url");
            }
            const xhr = new XMLHttpRequest();
            xhr.open('GET', _converse.prebind_url, true);
            xhr.setRequestHeader('Accept', 'application/json, text/javascript');
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 400) {
                    const data = JSON.parse(xhr.responseText);
                    _converse.connection.attach(
                        data.jid,
                        data.sid,
                        data.rid,
                        _converse.onConnectStatusChanged
                    );
                } else {
                    xhr.onerror();
                }
            };
            xhr.onerror = function () {
                delete _converse.connection;
                /**
                 * Triggered when fetching prebind tokens failed
                 * @event _converse#noResumeableBOSHSession
                 * @type { _converse }
                 * @example _converse.api.listen.on('noResumeableBOSHSession', _converse => { ... });
                 */
                _converse.api.trigger('noResumeableBOSHSession', _converse);
            };
            xhr.send();
        }


        _converse.restoreBOSHSession = async function () {
            if (!_converse.api.connection.isType('bosh')) {
                return false;
            }
            const jid = (await initBOSHSession()).get('jid');
            if (jid) {
                try {
                    _converse.connection.restore(jid, _converse.onConnectStatusChanged);
                    return true;
                } catch (e) {
                    _converse.log(
                        "Could not restore session for jid: "+
                        jid+" Error message: "+e.message, Strophe.LogLevel.WARN);
                    return false;
                }
            }
            return false;
        }


        /************************ BEGIN Event Handlers ************************/
        _converse.api.listen.on('clearSession', () => {
            if (_converse.bosh_session === undefined) {
                // Remove manually, even if we don't have the corresponding
                // model, to avoid trying to reconnect to a stale BOSH session
                const id = BOSH_SESSION_ID;
                sessionStorage.removeItem(id);
                sessionStorage.removeItem(`${id}-${id}`);
            } else {
                _converse.bosh_session.destroy();
                _converse.bosh_session.browserStorage._clear();
                delete _converse.bosh_session;
            }
        });

        _converse.api.listen.on('setUserJID', () => {
            if (_converse.bosh_session !== undefined) {
                _converse.bosh_session.save({'jid': _converse.jid});
            }
        });

        _converse.api.listen.on('addClientFeatures',
            () => _converse.api.disco.own.features.add(Strophe.NS.BOSH)
        );

        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(_converse.api, {
            /**
             * This namespace lets you access the BOSH tokens
             *
             * @namespace _converse.api.tokens
             * @memberOf _converse.api
             */
            tokens: {
                /**
                 * @method _converse.api.tokens.get
                 * @param {string} [id] The type of token to return ('rid' or 'sid').
                 * @returns 'string' A token, either the RID or SID token depending on what's asked for.
                 * @example _converse.api.tokens.get('rid');
                 */
                get (id) {
                    if (_converse.connection === undefined) {
                        return null;
                    }
                    if (id.toLowerCase() === 'rid') {
                        return _converse.connection.rid || _converse.connection._proto.rid;
                    } else if (id.toLowerCase() === 'sid') {
                        return _converse.connection.sid || _converse.connection._proto.sid;
                    }
                }
            }
        });
        /************************ end api ************************/
    }
});
