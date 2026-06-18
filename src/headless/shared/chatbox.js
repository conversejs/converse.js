import { Model } from '@converse/skeletor';
import api from './api/index.js';
import { isUniView } from '../utils/session.js';
import _converse from './_converse.js';
import converse from './api/public.js';
import log from '@converse/log';
import ModelWithMessages from './model-with-messages.js';

const { u } = converse.env;

/**
 * Base class for all chat boxes. Provides common methods.
 */
export default class ChatBoxBase extends ModelWithMessages(Model) {
    async initialize() {
        await super.initialize();
        const jid = this.get('jid');
        if (!jid) {
            // XXX: The `validate` method will prevent this model
            // from being persisted if there's no jid, but that gets
            // called after model instantiation, so we have to deal
            // with invalid models here also.
            // This happens when the controlbox is in browser storage,
            // but we're in embedded mode.
            return;
        }
        this.set({ 'box_id': `box-${jid}` });
    }

    validate(attrs) {
        if (!attrs.jid) {
            return 'Ignored ChatBox without JID';
        }
        const room_jids = api.settings.get('auto_join_rooms').map((s) => (s instanceof Object ? s.jid : s));
        const auto_join = api.settings.get('auto_join_private_chats').concat(room_jids);
        if (
            api.settings.get('singleton') &&
            !auto_join.includes(attrs.jid) &&
            !api.settings.get('auto_join_on_invite')
        ) {
            const msg = `${attrs.jid} is not allowed because singleton is true and it's not being auto_joined`;
            log.warn(msg);
            return msg;
        }
    }

    /**
     * @param {boolean} force
     */
    maybeShow(force) {
        if (isUniView()) {
            const filter = (c) => !c.get('hidden') && c.get('jid') !== this.get('jid') && c.get('id') !== 'controlbox';
            const other_chats = _converse.state.chatboxes.filter(filter);
            if (force || other_chats.length === 0) {
                // We only have one chat visible at any one time.
                // So before opening a chat, we make sure all other chats are hidden.
                other_chats.forEach((c) => u.safeSave(c, { hidden: true }));
                u.safeSave(this, { hidden: false, closed: false });
                this.trigger('show');
            }
            return this;
        }
        // Overlayed view mode
        u.safeSave(this, { hidden: false, closed: false });
        this.trigger('show');
        return this;
    }

    async shouldDestroyOnClose() {
        /**
         * *Hook* which allows plugins to determine whether a chat should be destroyed when it's closed.
         * For example, used by the converse-dragresize plugin to prevent resized chats
         * from being destroyed, thereby losing the resize dimensions.
         * @event _converse#shouldDestroyOnClose
         * @param {ChatBoxBase} chatbox
         * @param {boolean} should_destroy
         */
        return await api.hook('shouldDestroyOnClose', this, true);
    }

    /**
     * @param {Object} [_ev]
     */
    async close(_ev) {
        if (await this.shouldDestroyOnClose()) {
            try {
                await new Promise((success, reject) => {
                    return this.destroy({
                        success,
                        error: (_m, e) => reject(e),
                    });
                });
            } catch (e) {
                log.debug(e);
            }
        } else {
            u.safeSave(this, { closed: true });
        }

        if (api.settings.get('clear_messages_on_reconnection')) {
            await this.clearMessages();
        }
        /**
         * Triggered once a chatbox has been closed.
         * @event _converse#chatBoxClosed
         * @type {ChatBoxBase}
         * @example _converse.api.listen.on('chatBoxClosed', chat => { ... });
         */
        api.trigger('chatBoxClosed', this);
    }

    announceReconnection() {
        /**
         * Triggered whenever a `ChatBox` instance has reconnected after an outage
         * @event _converse#onChatReconnected
         * @type {ChatBoxBase}
         * @example _converse.api.listen.on('onChatReconnected', chat => { ... });
         */
        api.trigger('chatReconnected', this);
    }

    async onReconnection() {
        if (api.settings.get('clear_messages_on_reconnection')) {
            await this.clearMessages();
        }
        this.announceReconnection();
    }
}
