// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2012-2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
// Views for XEP-0313 Message Archive Management

import converse from "@converse/headless/converse-core";


const CHATROOMS_TYPE = 'chatroom';
const { Strophe, _ } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-mam-views', {

    dependencies: ['converse-disco', 'converse-mam', 'converse-chatview', 'converse-muc-views'],

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        //
        // New functions which don't exist yet can also be added.


        ChatBox: {
            fetchNewestMessages () {
                /* Fetches messages that might have been archived *after*
                 * the last archived message in our local cache.
                 */
                if (this.disable_mam) {
                    return;
                }
                const { _converse } = this.__super__;
                const most_recent_msg = u.getMostRecentMessage(this);

                if (_.isNil(most_recent_msg)) {
                    this.fetchArchivedMessages();
                } else {
                    const stanza_id = most_recent_msg.get(`stanza_id ${this.get('jid')}`);
                    if (stanza_id) {
                        this.fetchArchivedMessages({'after': stanza_id});
                    } else {
                        this.fetchArchivedMessages({'start': most_recent_msg.get('time')});
                    }
                }
            },

            async fetchArchivedMessages (options) {
                if (this.disable_mam) {
                    return;
                }
                const { _converse } = this.__super__;
                const is_groupchat = this.get('type') === CHATROOMS_TYPE;
                const mam_jid = is_groupchat ? this.get('jid') : _converse.bare_jid;
                if (!(await _converse.api.disco.supports(Strophe.NS.MAM, mam_jid))) {
                    return;
                }
                let message_handler;
                if (is_groupchat) {
                    message_handler = this.onMessage.bind(this);
                } else {
                    message_handler = _converse.chatboxes.onMessage.bind(_converse.chatboxes)
                }
                let result;
                try {
                    result = await _converse.api.archive.query(
                        Object.assign({
                            'groupchat': is_groupchat,
                            'before': '', // Page backwards from the most recent message
                            'max': _converse.archived_messages_page_size,
                            'with': this.get('jid'),
                        }, options));
                } catch (e) {
                    _converse.log(
                        "Error or timeout while trying to fetch "+
                        "archived messages", Strophe.LogLevel.ERROR);
                    _converse.log(e, Strophe.LogLevel.ERROR);
                }
                if (result.messages) {
                    result.messages.forEach(message_handler);
                }
            }
        },

        ChatBoxView: {

            render () {
                const result = this.__super__.render.apply(this, arguments);
                if (!this.disable_mam) {
                    this.content.addEventListener('scroll', _.debounce(this.onScroll.bind(this), 100));
                }
                return result;
            },

            onScroll (ev) {
                const { _converse } = this.__super__;
                if (this.content.scrollTop === 0 && this.model.messages.length) {
                    const oldest_message = this.model.messages.at(0);
                    const by_jid = this.model.get('jid');
                    const stanza_id = oldest_message.get(`stanza_id ${by_jid}`);
                    if (stanza_id) {
                        this.model.fetchArchivedMessages({
                            'before': stanza_id
                        });
                    } else {
                        this.model.fetchArchivedMessages({
                            'end': oldest_message.get('time')
                        });
                    }
                }
            }
        },

        ChatRoom: {

            initialize () {
                this.__super__.initialize.apply(this, arguments);
                this.on('change:mam_enabled', this.fetchArchivedMessagesIfNecessary, this);
                this.on('change:connection_status', this.fetchArchivedMessagesIfNecessary, this);
            },

            fetchArchivedMessagesIfNecessary () {
                if (this.get('connection_status') !== converse.ROOMSTATUS.ENTERED ||
                        !this.get('mam_enabled') ||
                        this.get('mam_initialized')) {
                    return;
                }
                this.fetchArchivedMessages();
                this.save({'mam_initialized': true});
            }
        },

        ChatRoomView: {

            renderChatArea () {
                const result = this.__super__.renderChatArea.apply(this, arguments);
                if (!this.disable_mam) {
                    this.content.addEventListener('scroll', _.debounce(this.onScroll.bind(this), 100));
                }
                return result;
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by Converse.js's plugin machinery.
         */
        const { _converse } = this;

        /* Event handlers */
        _converse.api.listen.on('afterMessagesFetched', chatbox => chatbox.fetchNewestMessages());

        _converse.api.listen.on('reconnected', () => {
            const private_chats = _converse.chatboxviews.filter(
                view => _.at(view, 'model.attributes.type')[0] === 'chatbox'
            );
            _.each(private_chats, view => view.model.fetchNewestMessages())
        });
    }
});
