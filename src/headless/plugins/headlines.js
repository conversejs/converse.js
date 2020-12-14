/**
 * @module converse-headlines
 * @copyright 2020, the Converse.js contributors
 * @description XEP-0045 Multi-User Chat Views
 */
import { _converse, api, converse } from "@converse/headless/core";
import { isHeadline, isServerMessage } from '@converse/headless/shared/parsers';
import { parseMessage } from '@converse/headless/plugins/chat/parsers';


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
                    'hidden': ['mobile', 'fullscreen'].includes(api.settings.get("view_mode")),
                    'message_type': 'headline',
                    'num_unread': 0,
                    'time_opened': this.get('time_opened') || (new Date()).getTime(),
                    'type': _converse.HEADLINES_TYPE
                }
            },

            async initialize () {
                this.set({'box_id': `box-${this.get('jid')}`});
                this.initMessages();
                await this.fetchMessages();
                /**
                 * Triggered once a {@link _converse.HeadlinesBox} has been created and initialized.
                 * @event _converse#headlinesBoxInitialized
                 * @type { _converse.HeadlinesBox }
                 * @example _converse.api.listen.on('headlinesBoxInitialized', model => { ... });
                 */
                api.trigger('headlinesBoxInitialized', this);
            }
        });

        async function onHeadlineMessage (stanza) {
            // Handler method for all incoming messages of type "headline".
            if (isHeadline(stanza) || isServerMessage(stanza)) {
                const from_jid = stanza.getAttribute('from');
                if (from_jid.includes('@') &&
                        !_converse.roster.get(from_jid) &&
                        !api.settings.get("allow_non_roster_messaging")) {
                    return;
                }
                if (stanza.querySelector('body') === null) {
                    // Avoid creating a chat box if we have nothing to show inside it.
                    return;
                }
                const chatbox = _converse.chatboxes.create({
                    'id': from_jid,
                    'jid': from_jid,
                    'type': _converse.HEADLINES_TYPE,
                    'from': from_jid
                });
                const attrs = await parseMessage(stanza, _converse);
                await chatbox.createMessage(attrs);
                api.trigger('message', {chatbox, stanza, attrs});
            }
        }


        /************************ BEGIN Event Handlers ************************/
        function registerHeadlineHandler () {
            _converse.connection.addHandler(message => (onHeadlineMessage(message) || true), null, 'message');
        }
        api.listen.on('connected', registerHeadlineHandler);
        api.listen.on('reconnected', registerHeadlineHandler);
        /************************ END Event Handlers ************************/


        /************************ BEGIN API ************************/
        Object.assign(api, {
            /**
             * The "headlines" namespace, which is used for headline-channels
             * which are read-only channels containing messages of type
             * "headline".
             *
             * @namespace api.headlines
             * @memberOf api
             */
            headlines: {
                /**
                 * Retrieves a headline-channel or all headline-channels.
                 *
                 * @method api.headlines.get
                 * @param {String|String[]} jids - e.g. 'buddy@example.com' or ['buddy1@example.com', 'buddy2@example.com']
                 * @param {Object} [attrs] - Attributes to be set on the _converse.ChatBox model.
                 * @param {Boolean} [create=false] - Whether the chat should be created if it's not found.
                 * @returns { Promise<_converse.HeadlinesBox> }
                 */
                async get (jids, attrs={}, create=false) {
                    async function _get (jid) {
                        let model = await api.chatboxes.get(jid);
                        if (!model && create) {
                            model = await api.chatboxes.create(jid, attrs, _converse.HeadlinesBox);
                        } else {
                            model = (model && model.get('type') === _converse.HEADLINES_TYPE) ? model : null;
                            if (model && Object.keys(attrs).length) {
                                model.save(attrs);
                            }
                        }
                        return model;
                    }
                    if (jids === undefined) {
                        const chats = await api.chatboxes.get();
                        return chats.filter(c => (c.get('type') === _converse.HEADLINES_TYPE));
                    } else if (typeof jids === 'string') {
                        return _get(jids);
                    }
                    return Promise.all(jids.map(jid => _get(jid)));
                }
            }
        });
        /************************ END API ************************/
    }
});
