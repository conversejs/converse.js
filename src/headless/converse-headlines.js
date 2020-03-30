/**
 * @module converse-headlines
 * @copyright 2020, the Converse.js contributors
 * @description XEP-0045 Multi-User Chat Views
 */
import converse from "@converse/headless/converse-core";
import { isString } from "lodash";

const u = converse.env.utils;


converse.plugins.add('converse-headlines', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ["converse-chat"],

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // New functions which don't exist yet can also be added.

        ChatBoxes: {
            model (attrs, options) {
                const { _converse } = this.__super__;
                if (attrs.type == _converse.HEADLINES_TYPE) {
                    return new _converse.HeadlinesBox(attrs, options);
                } else {
                    return this.__super__.model.apply(this, arguments);
                }
            },
        }
    },


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;

        /**
         * Shows headline messages
         * @class
         * @namespace _converse.HeadlinesBox
         * @memberOf _converse
         */
        _converse.HeadlinesBox = _converse.ChatBox.extend({
            defaults () {
                return {
                    'bookmarked': false,
                    'hidden': ['mobile', 'fullscreen'].includes(_converse.view_mode),
                    'message_type': 'headline',
                    'num_unread': 0,
                    'time_opened': this.get('time_opened') || (new Date()).getTime(),
                    'type': _converse.HEADLINES_TYPE
                }
            },

            initialize () {
                this.initMessages();
                this.set({'box_id': `box-${btoa(this.get('jid'))}`});
                /**
                 * Triggered once a {@link _converse.HeadlinesBox} has been created and initialized.
                 * @event _converse#headlinesBoxInitialized
                 * @type { _converse.HeadlinesBox }
                 * @example _converse.api.listen.on('headlinesBoxInitialized', model => { ... });
                 */
                _converse.api.trigger('headlinesBoxInitialized', this);
            }
        });

        async function onHeadlineMessage (message) {
            // Handler method for all incoming messages of type "headline".
            if (u.isHeadlineMessage(_converse, message)) {
                const from_jid = message.getAttribute('from');
                if (from_jid.includes('@') &&
                        !_converse.roster.get(from_jid) &&
                        !_converse.allow_non_roster_messaging) {
                    return;
                }
                if (message.querySelector('body') === null) {
                    // Avoid creating a chat box if we have nothing to show inside it.
                    return;
                }
                const chatbox = _converse.chatboxes.create({
                    'id': from_jid,
                    'jid': from_jid,
                    'type': _converse.HEADLINES_TYPE,
                    'from': from_jid
                });
                const attrs = await chatbox.getMessageAttributesFromStanza(message, message);
                await chatbox.createMessage(attrs);
                _converse.api.trigger('message', {'chatbox': chatbox, 'stanza': message});
            }
        }


        /************************ BEGIN Event Handlers ************************/
        function registerHeadlineHandler () {
            _converse.connection.addHandler(message => {
                onHeadlineMessage(message);
                return true
            }, null, 'message');
        }
        _converse.api.listen.on('connected', registerHeadlineHandler);
        _converse.api.listen.on('reconnected', registerHeadlineHandler);
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(_converse.api, {
            /**
             * The "headlines" namespace, which is used for headline-channels
             * which are read-only channels containing messages of type
             * "headline".
             *
             * @namespace _converse.api.headlines
             * @memberOf _converse.api
             */
            headlines: {
                /**
                 * Retrieves a headline-channel or all headline-channels.
                 *
                 * @method _converse.api.headlines.get
                 * @param {String|String[]} jids - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
                 * @param {Object} [attrs] - Attributes to be set on the _converse.ChatBox model.
                 * @param {Boolean} [create=false] - Whether the chat should be created if it's not found.
                 * @returns { Promise<_converse.HeadlinesBox> }
                 */
                async get (jids, attrs={}, create=false) {
                    async function _get (jid) {
                        let model = await _converse.api.chatboxes.get(jid);
                        if (!model && create) {
                            model = await _converse.api.chatboxes.create(jid, attrs, _converse.HeadlinesBox);
                        } else {
                            model = (model && model.get('type') === _converse.HEADLINES_TYPE) ? model : null;
                            if (model && Object.keys(attrs).length) {
                                model.save(attrs);
                            }
                        }
                        return model;
                    }
                    if (jids === undefined) {
                        const chats = await _converse.api.chatboxes.get();
                        return chats.filter(c => (c.get('type') === _converse.HEADLINES_TYPE));
                    } else if (isString(jids)) {
                        return _get(jids);
                    }
                    return Promise.all(jids.map(jid => _get(jid)));
                }
            }
        });
        /************************ END API ************************/
    }
});
