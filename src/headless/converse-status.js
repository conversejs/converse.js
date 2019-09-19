/**
 * @module converse-status
 * @copyright The Converse.js developers
 * @license Mozilla Public License (MPLv2)
 */
import { get, isNaN, isObject, isString } from "lodash";
import { Model } from 'skeletor.js/src/model.js';
import converse from "@converse/headless/converse-core";

const { Strophe, $build, $pres } = converse.env;


converse.plugins.add('converse-status', {

    initialize () {
        const { _converse } = this;

        _converse.XMPPStatus = Model.extend({
            defaults () {
                return {"status":  _converse.default_state}
            },

            initialize () {
                this.on('change', item => {
                    if (!isObject(item.changed)) {
                        return;
                    }
                    if ('status' in item.changed || 'status_message' in item.changed) {
                        this.sendPresence(this.get('status'), this.get('status_message'));
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

            constructPresence (type, status_message) {
                let presence;
                type = isString(type) ? type : (this.get('status') || _converse.default_state);
                status_message = isString(status_message) ? status_message : this.get('status_message');
                // Most of these presence types are actually not explicitly sent,
                // but I add all of them here for reference and future proofing.
                if ((type === 'unavailable') ||
                        (type === 'probe') ||
                        (type === 'error') ||
                        (type === 'unsubscribe') ||
                        (type === 'unsubscribed') ||
                        (type === 'subscribe') ||
                        (type === 'subscribed')) {
                    presence = $pres({'type': type});
                } else if (type === 'offline') {
                    presence = $pres({'type': 'unavailable'});
                } else if (type === 'online') {
                    presence = $pres();
                } else {
                    presence = $pres().c('show').t(type).up();
                }
                if (status_message) {
                    presence.c('status').t(status_message).up();
                }
                presence.c('priority').t(isNaN(Number(_converse.priority)) ? 0 : _converse.priority).up();
                if (_converse.idle) {
                    const idle_since = new Date();
                    idle_since.setSeconds(idle_since.getSeconds() - _converse.idle_seconds);
                    presence.c('idle', {xmlns: Strophe.NS.IDLE, since: idle_since.toISOString()});
                }
                return presence;
            },

            sendPresence (type, status_message) {
                _converse.api.send(this.constructPresence(type, status_message));
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
            _converse.api.send($build(stat, {xmlns: Strophe.NS.CSI}));
            _converse.inactive = (stat === _converse.INACTIVE) ? true : false;
        };


        _converse.onUserActivity = function () {
            /* Resets counters and flags relating to CSI and auto_away/auto_xa */
            if (_converse.idle_seconds > 0) {
                _converse.idle_seconds = 0;
            }
            if (!get(_converse.connection, 'authenticated')) {
                // We can't send out any stanzas when there's no authenticated connection.
                // This can happen when the connection reconnects.
                return;
            }
            if (_converse.inactive) {
                _converse.sendCSI(_converse.ACTIVE);
            }
            if (_converse.idle) {
                _converse.idle = false;
                _converse.xmppstatus.sendPresence();
            }
            if (_converse.auto_changed_status === true) {
                _converse.auto_changed_status = false;
                // XXX: we should really remember the original state here, and
                // then set it back to that...
                _converse.xmppstatus.set('status', _converse.default_state);
            }
        };

        _converse.onEverySecond = function () {
            /* An interval handler running every second.
             * Used for CSI and the auto_away and auto_xa features.
             */
            if (!get(_converse.connection, 'authenticated')) {
                // We can't send out any stanzas when there's no authenticated connection.
                // This can happen when the connection reconnects.
                return;
            }
            const stat = _converse.xmppstatus.get('status');
            _converse.idle_seconds++;
            if (_converse.csi_waiting_time > 0 &&
                    _converse.idle_seconds > _converse.csi_waiting_time &&
                    !_converse.inactive) {
                _converse.sendCSI(_converse.INACTIVE);
            }
            if (_converse.idle_presence_timeout > 0 &&
                    _converse.idle_seconds > _converse.idle_presence_timeout &&
                    !_converse.idle) {
                _converse.idle = true;
                _converse.xmppstatus.sendPresence();
            }
            if (_converse.auto_away > 0 &&
                    _converse.idle_seconds > _converse.auto_away &&
                    stat !== 'away' && stat !== 'xa' && stat !== 'dnd') {
                _converse.auto_changed_status = true;
                _converse.xmppstatus.set('status', 'away');
            } else if (_converse.auto_xa > 0 &&
                    _converse.idle_seconds > _converse.auto_xa &&
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
                _converse.auto_away < 1 &&
                _converse.auto_xa < 1 &&
                _converse.csi_waiting_time < 1 &&
                _converse.idle_presence_timeout < 1
            ) {
                // Waiting time of less then one second means features aren't used.
                return;
            }
            _converse.idle_seconds = 0;
            _converse.auto_changed_status = false; // Was the user's status changed by Converse?
            window.addEventListener('click', _converse.onUserActivity);
            window.addEventListener('focus', _converse.onUserActivity);
            window.addEventListener('keypress', _converse.onUserActivity);
            window.addEventListener('mousemove', _converse.onUserActivity);
            const options = {'once': true, 'passive': true};
            window.addEventListener(_converse.unloadevent, _converse.onUserActivity, options);
            window.addEventListener(_converse.unloadevent, () => {
                if (_converse.session) {
                    _converse.session.save('active', false);
                }
            });
            _converse.everySecondTrigger = window.setInterval(_converse.onEverySecond, 1000);
        };


        _converse.api.listen.on('presencesInitialized', (reconnecting) => {
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
            _converse.api.trigger('statusInitialized', reconnecting);
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
        _converse.api.listen.on('clearSession', () => {
            if (_converse.shouldClearCache() && _converse.xmppstatus) {
                _converse.xmppstatus.destroy();
                delete _converse.xmppstatus;
            }
        });

        _converse.api.listen.on('connected', () => initStatus(false));
        _converse.api.listen.on('reconnected', () => initStatus(true));
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(_converse.api.user, {
            /**
             * Set and get the user's chat status, also called their *availability*.
             *
             * @namespace _converse.api.user.status
             * @memberOf _converse.api.user
             */
            status: {
                /** Return the current user's availability status.
                 *
                 * @method _converse.api.user.status.get
                 * @example _converse.api.user.status.get();
                 */
                get () {
                    return _converse.xmppstatus.get('status');
                },
                /**
                 * The user's status can be set to one of the following values:
                 *
                 * @method _converse.api.user.status.set
                 * @param {string} value The user's chat status (e.g. 'away', 'dnd', 'offline', 'online', 'unavailable' or 'xa')
                 * @param {string} [message] A custom status message
                 *
                 * @example this._converse.api.user.status.set('dnd');
                 * @example this._converse.api.user.status.set('dnd', 'In a meeting');
                 */
                set (value, message) {
                    const data = {'status': value};
                    if (!Object.keys(_converse.STATUS_WEIGHTS).includes(value)) {
                        throw new Error(
                            'Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1'
                        );
                    }
                    if (isString(message)) {
                        data.status_message = message;
                    }
                    _converse.xmppstatus.sendPresence(value);
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
                     * @method _converse.api.user.status.message.get
                     * @returns {string} The status message
                     * @example const message = _converse.api.user.status.message.get()
                     */
                    get () {
                        return _converse.xmppstatus.get('status_message');
                    },
                    /**
                     * @method _converse.api.user.status.message.set
                     * @param {string} status The status message
                     * @example _converse.api.user.status.message.set('In a meeting');
                     */
                    set (status) {
                        _converse.xmppstatus.save({ status_message: status });
                    }
                }
            }
        });
    }
});
