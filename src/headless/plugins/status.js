/**
 * @module converse-status
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import isNaN from "lodash-es/isNaN";
import isObject from "lodash-es/isObject";
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api, converse } from "@converse/headless/core";

const { Strophe, $build, $pres } = converse.env;


converse.plugins.add('converse-status', {

    initialize () {

        api.settings.extend({
            auto_away: 0, // Seconds after which user status is set to 'away'
            auto_xa: 0, // Seconds after which user status is set to 'xa'
            csi_waiting_time: 0, // Support for XEP-0352. Seconds before client is considered idle and CSI is sent out.
            default_state: 'online',
            priority: 0,
        });
        api.promises.add(['statusInitialized']);

        _converse.XMPPStatus = Model.extend({
            defaults () {
                return {"status":  api.settings.get("default_state")}
            },

            initialize () {
                this.on('change', item => {
                    if (!isObject(item.changed)) {
                        return;
                    }
                    if ('status' in item.changed || 'status_message' in item.changed) {
                        api.user.presence.send(this.get('status'), null, this.get('status_message'));
                    }
                });
            },

            getNickname () {
                return _converse.nickname;
            },

            getFullname () {
                // Gets overridden in converse-vcard
                return '';
            },

            constructPresence (type, to=null, status_message) {
                type = typeof type === 'string' ? type : (this.get('status') || api.settings.get("default_state"));
                status_message = typeof status_message === 'string' ? status_message : this.get('status_message');
                let presence;
                const attrs = {to};
                if ((type === 'unavailable') ||
                        (type === 'probe') ||
                        (type === 'error') ||
                        (type === 'unsubscribe') ||
                        (type === 'unsubscribed') ||
                        (type === 'subscribe') ||
                        (type === 'subscribed')) {
                    attrs['type'] = type;
                    presence = $pres(attrs);
                } else if (type === 'offline') {
                    attrs['type'] = 'unavailable';
                    presence = $pres(attrs);
                } else if (type === 'online') {
                    presence = $pres(attrs);
                } else {
                    presence = $pres(attrs).c('show').t(type).up();
                }

                if (status_message) {
                    presence.c('status').t(status_message).up();
                }

                const priority = api.settings.get("priority");
                presence.c('priority').t(isNaN(Number(priority)) ? 0 : priority).up();
                if (_converse.idle) {
                    const idle_since = new Date();
                    idle_since.setSeconds(idle_since.getSeconds() - _converse.idle_seconds);
                    presence.c('idle', {xmlns: Strophe.NS.IDLE, since: idle_since.toISOString()});
                }
                return presence;
            }
        });


        /**
         * Send out a Client State Indication (XEP-0352)
         * @private
         * @method sendCSI
         * @memberOf _converse
         * @param { String } stat - The user's chat status
         */
        _converse.sendCSI = function (stat) {
            api.send($build(stat, {xmlns: Strophe.NS.CSI}));
            _converse.inactive = (stat === _converse.INACTIVE) ? true : false;
        };


        _converse.onUserActivity = function () {
            /* Resets counters and flags relating to CSI and auto_away/auto_xa */
            if (_converse.idle_seconds > 0) {
                _converse.idle_seconds = 0;
            }
            if (!_converse.connection?.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // This can happen when the connection reconnects.
                return;
            }
            if (_converse.inactive) {
                _converse.sendCSI(_converse.ACTIVE);
            }
            if (_converse.idle) {
                _converse.idle = false;
                api.user.presence.send();
            }
            if (_converse.auto_changed_status === true) {
                _converse.auto_changed_status = false;
                // XXX: we should really remember the original state here, and
                // then set it back to that...
                _converse.xmppstatus.set('status', api.settings.get("default_state"));
            }
        };

        _converse.onEverySecond = function () {
            /* An interval handler running every second.
             * Used for CSI and the auto_away and auto_xa features.
             */
            if (!_converse.connection?.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // This can happen when the connection reconnects.
                return;
            }
            const stat = _converse.xmppstatus.get('status');
            _converse.idle_seconds++;
            if (api.settings.get("csi_waiting_time") > 0 &&
                    _converse.idle_seconds > api.settings.get("csi_waiting_time") &&
                    !_converse.inactive) {
                _converse.sendCSI(_converse.INACTIVE);
            }
            if (api.settings.get("idle_presence_timeout") > 0 &&
                    _converse.idle_seconds > api.settings.get("idle_presence_timeout") &&
                    !_converse.idle) {
                _converse.idle = true;
                api.user.presence.send();
            }
            if (api.settings.get("auto_away") > 0 &&
                    _converse.idle_seconds > api.settings.get("auto_away") &&
                    stat !== 'away' && stat !== 'xa' && stat !== 'dnd') {
                _converse.auto_changed_status = true;
                _converse.xmppstatus.set('status', 'away');
            } else if (api.settings.get("auto_xa") > 0 &&
                    _converse.idle_seconds > api.settings.get("auto_xa") &&
                    stat !== 'xa' && stat !== 'dnd') {
                _converse.auto_changed_status = true;
                _converse.xmppstatus.set('status', 'xa');
            }
        };

        _converse.registerIntervalHandler = function () {
            /* Set an interval of one second and register a handler for it.
             * Required for the auto_away, auto_xa and csi_waiting_time features.
             */
            if (
                api.settings.get("auto_away") < 1 &&
                api.settings.get("auto_xa") < 1 &&
                api.settings.get("csi_waiting_time") < 1 &&
                api.settings.get("idle_presence_timeout") < 1
            ) {
                // Waiting time of less then one second means features aren't used.
                return;
            }
            _converse.idle_seconds = 0;
            _converse.auto_changed_status = false; // Was the user's status changed by Converse?

            const { unloadevent } = _converse;
            window.addEventListener('click', _converse.onUserActivity);
            window.addEventListener('focus', _converse.onUserActivity);
            window.addEventListener('keypress', _converse.onUserActivity);
            window.addEventListener('mousemove', _converse.onUserActivity);
            window.addEventListener(unloadevent, _converse.onUserActivity, {'once': true, 'passive': true});
            window.addEventListener(unloadevent, () => _converse.session?.save('active', false));
            _converse.everySecondTrigger = window.setInterval(_converse.onEverySecond, 1000);
        };


        api.listen.on('presencesInitialized', (reconnecting) => {
            if (!reconnecting) {
                _converse.registerIntervalHandler();
            }
        });


        function onStatusInitialized (reconnecting) {
            /**
             * Triggered when the user's own chat status has been initialized.
             * @event _converse#statusInitialized
             * @example _converse.api.listen.on('statusInitialized', status => { ... });
             * @example _converse.api.waitUntil('statusInitialized').then(() => { ... });
             */
            api.trigger('statusInitialized', reconnecting);
        }


        function initStatus (reconnecting) {
            // If there's no xmppstatus obj, then we were never connected to
            // begin with, so we set reconnecting to false.
            reconnecting = _converse.xmppstatus === undefined ? false : reconnecting;
            if (reconnecting) {
                onStatusInitialized(reconnecting);
            } else {
                const id = `converse.xmppstatus-${_converse.bare_jid}`;
                _converse.xmppstatus = new _converse.XMPPStatus({'id': id});
                _converse.xmppstatus.browserStorage = _converse.createStore(id, "session");
                _converse.xmppstatus.fetch({
                    'success': () => onStatusInitialized(reconnecting),
                    'error': () => onStatusInitialized(reconnecting),
                    'silent': true
                });
            }
        }


        /************************ BEGIN Event Handlers ************************/
        api.listen.on('clearSession', () => {
            if (_converse.shouldClearCache() && _converse.xmppstatus) {
                _converse.xmppstatus.destroy();
                delete _converse.xmppstatus;
                api.promises.add(['statusInitialized']);
            }
        });

        api.listen.on('connected', () => initStatus(false));
        api.listen.on('reconnected', () => initStatus(true));
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(_converse.api.user, {
            /**
             * @namespace _converse.api.user.presence
             * @memberOf _converse.api.user
             */
            presence: {
                /**
                 * Send out a presence stanza
                 * @method _converse.api.user.presence.send
                 * @param { String } type
                 * @param { String } to
                 * @param { String } [status] - An optional status message
                 * @param { Element[]|Strophe.Builder[]|Element|Strophe.Builder } [child_nodes]
                 *  Nodes(s) to be added as child nodes of the `presence` XML element.
                 */
                async send (type, to, status, child_nodes) {
                    await api.waitUntil('statusInitialized');
                    const presence = _converse.xmppstatus.constructPresence(type, to, status);
                    if (child_nodes) {
                        if (!Array.isArray(child_nodes)) {
                            child_nodes = [child_nodes];
                        }
                        child_nodes.map(c => c?.tree() ?? c).forEach(c => presence.cnode(c).up());
                    }
                    api.send(presence);
                }
            },

            /**
             * Set and get the user's chat status, also called their *availability*.
             * @namespace _converse.api.user.status
             * @memberOf _converse.api.user
             */
            status: {
                /**
                 * Return the current user's availability status.
                 * @async
                 * @method _converse.api.user.status.get
                 * @example _converse.api.user.status.get();
                 */
                async get () {
                    await api.waitUntil('statusInitialized');
                    return _converse.xmppstatus.get('status');
                },

                /**
                 * The user's status can be set to one of the following values:
                 *
                 * @async
                 * @method _converse.api.user.status.set
                 * @param {string} value The user's chat status (e.g. 'away', 'dnd', 'offline', 'online', 'unavailable' or 'xa')
                 * @param {string} [message] A custom status message
                 *
                 * @example _converse.api.user.status.set('dnd');
                 * @example _converse.api.user.status.set('dnd', 'In a meeting');
                 */
                async set (value, message) {
                    const data = {'status': value};
                    if (!Object.keys(_converse.STATUS_WEIGHTS).includes(value)) {
                        throw new Error(
                            'Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1'
                        );
                    }
                    if (typeof message === 'string') {
                        data.status_message = message;
                    }
                    await api.waitUntil('statusInitialized');
                    _converse.xmppstatus.save(data);
                },

                /**
                 * Set and retrieve the user's custom status message.
                 *
                 * @namespace _converse.api.user.status.message
                 * @memberOf _converse.api.user.status
                 */
                message: {
                    /**
                     * @async
                     * @method _converse.api.user.status.message.get
                     * @returns {string} The status message
                     * @example const message = _converse.api.user.status.message.get()
                     */
                    async get () {
                        await api.waitUntil('statusInitialized');
                        return _converse.xmppstatus.get('status_message');
                    },
                    /**
                     * @async
                     * @method _converse.api.user.status.message.set
                     * @param {string} status The status message
                     * @example _converse.api.user.status.message.set('In a meeting');
                     */
                    async set (status) {
                        await api.waitUntil('statusInitialized');
                        _converse.xmppstatus.save({ status_message: status });
                    }
                }
            }
        });
    }
});
