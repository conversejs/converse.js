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

        ChatBoxView: {

            render () {
                const result = this.__super__.render.apply(this, arguments);
                if (!this.disable_mam) {
                    this.content.addEventListener('scroll', _.debounce(this.onScroll.bind(this), 100));
                }
                return result;
            },

            fetchNewestMessages () {
                /* Fetches messages that might have been archived *after*
                 * the last archived message in our local cache.
                 */
                if (this.disable_mam) { return; }
                const { _converse } = this.__super__,
                      most_recent_msg = u.getMostRecentMessage(this.model);

                if (_.isNil(most_recent_msg)) {
                    this.fetchArchivedMessages();
                } else {
                    const stanza_id = most_recent_msg.get(`stanza_id ${this.model.get('jid')}`);
                    if (stanza_id) {
                        this.fetchArchivedMessages({'after': stanza_id});
                    } else {
                        this.fetchArchivedMessages({'start': most_recent_msg.get('time')});
                    }
                }
            },

            fetchArchivedMessagesIfNecessary () {
                /* Check if archived messages should be fetched, and if so, do so. */
                if (this.disable_mam || this.model.get('mam_initialized')) {
                    return;
                }
                const { _converse } = this.__super__;
                _converse.api.disco.supports(Strophe.NS.MAM, _converse.bare_jid).then(
                    (result) => { // Success
                        if (result.length) {
                            this.fetchArchivedMessages();
                        }
                        this.model.save({'mam_initialized': true});
                    },
                    () => { // Error
                        _converse.log(
                            "Error or timeout while checking for MAM support",
                            Strophe.LogLevel.ERROR
                        );
                    }
                ).catch((msg) => {
                    this.clearSpinner();
                    _converse.log(msg, Strophe.LogLevel.FATAL);
                });
            },

            async fetchArchivedMessages (options) {
                const { _converse } = this.__super__;
                if (this.disable_mam) { return; }

                const is_groupchat = this.model.get('type') === CHATROOMS_TYPE;

                let mam_jid, message_handler;
                if (is_groupchat) {
                    mam_jid = this.model.get('jid');
                    message_handler = this.model.onMessage.bind(this.model);
                } else {
                    mam_jid = _converse.bare_jid;
                    message_handler = _converse.chatboxes.onMessage.bind(_converse.chatboxes)
                }

                const supported = await _converse.api.disco.supports(Strophe.NS.MAM, mam_jid);
                if (!supported.length) {
                    return;
                }
                this.addSpinner();
                _converse.api.archive.query(
                    Object.assign({
                        'groupchat': is_groupchat,
                        'before': '', // Page backwards from the most recent message
                        'max': _converse.archived_messages_page_size,
                        'with': this.model.get('jid'),
                    }, options),

                    messages => { // Success
                        this.clearSpinner();
                        _.each(messages, message_handler);
                    },
                    e => { // Error
                        this.clearSpinner();
                        _converse.log(
                            "Error or timeout while trying to fetch "+
                            "archived messages", Strophe.LogLevel.ERROR);
                        _converse.log(e, Strophe.LogLevel.ERROR);
                    }
                );
            },

            onScroll (ev) {
                const { _converse } = this.__super__;
                if (this.content.scrollTop === 0 && this.model.messages.length) {
                    const oldest_message = this.model.messages.at(0);
                    const by_jid = this.model.get('jid');
                    const stanza_id = oldest_message.get(`stanza_id ${by_jid}`);
                    if (stanza_id) {
                        this.fetchArchivedMessages({'before': stanza_id});
                    } else {
                        this.fetchArchivedMessages({
                            'end': oldest_message.get('time')
                        });
                    }
                }
            },
        },

        ChatRoomView: {

            initialize () {
                const { _converse } = this.__super__;
                this.__super__.initialize.apply(this, arguments);
                this.model.on('change:mam_enabled', this.fetchArchivedMessagesIfNecessary, this);
                this.model.on('change:connection_status', this.fetchArchivedMessagesIfNecessary, this);
            },

            renderChatArea () {
                const result = this.__super__.renderChatArea.apply(this, arguments);
                if (!this.disable_mam) {
                    this.content.addEventListener('scroll', _.debounce(this.onScroll.bind(this), 100));
                }
                return result;
            },

            fetchArchivedMessagesIfNecessary () {
                if (this.model.get('connection_status') !== converse.ROOMSTATUS.ENTERED ||
                    !this.model.get('mam_enabled') ||
                    this.model.get('mam_initialized')) {

                    return;
                }
                this.fetchArchivedMessages();
                this.model.save({'mam_initialized': true});
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by Converse.js's plugin machinery.
         */
        const { _converse } = this;

        /* Event handlers */
        _converse.api.listen.on('afterMessagesFetched', view => view.fetchNewestMessages());

        _converse.api.listen.on('reconnected', () => {
            const private_chats = _converse.chatboxviews.filter(
                view => _.at(view, 'model.attributes.type')[0] === 'chatbox'
            );
            _.each(private_chats, (view) => view.fetchNewestMessages())
        });
    }
});
