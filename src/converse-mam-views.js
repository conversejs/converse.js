// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2012-2019, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/**
 * @module converse-mam-views
 * @description
 * Views for XEP-0313 Message Archive Management
 */
import converse from "@converse/headless/converse-core";
import { debounce } from 'lodash'


converse.plugins.add('converse-mam-views', {

    dependencies: ['converse-mam', 'converse-chatview', 'converse-muc-views'],

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
                    this.content.addEventListener('scroll', debounce(this.onScroll.bind(this), 100));
                }
                return result;
            },

            async onScroll () {
                if (this.content.scrollTop === 0 && this.model.messages.length) {
                    const oldest_message = this.model.getOldestMessage();
                    if (oldest_message) {
                        const by_jid = this.model.get('jid');
                        const stanza_id = oldest_message && oldest_message.get(`stanza_id ${by_jid}`);
                        this.addSpinner();
                        if (stanza_id) {
                            await this.model.fetchArchivedMessages({
                                'before': stanza_id
                            });
                        } else {
                            await this.model.fetchArchivedMessages({
                                'end': oldest_message.get('time')
                            });
                        }
                        this.clearSpinner();
                    }
                }
            }
        },

        ChatRoomView: {
            renderChatArea () {
                const result = this.__super__.renderChatArea.apply(this, arguments);
                if (!this.disable_mam) {
                    this.content.addEventListener('scroll', debounce(this.onScroll.bind(this), 100));
                }
                return result;
            }
        }
    }
});
