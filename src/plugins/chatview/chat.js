import { _converse, api, constants } from '@converse/headless';
import 'plugins/chatview/heading.js';
import 'plugins/chatview/bottom-panel.js';
import BaseChatView from 'shared/chat/baseview.js';
import { __ } from 'i18n';
import DragResizable from 'plugins/dragresize/mixin.js';
import tplChat from './templates/chat.js';

const { ACTIVE } = constants;

/**
 * The view of an open/ongoing chat conversation.
 */
export default class ChatView extends DragResizable(BaseChatView) {
    length = 200;

    async initialize() {
        const { chatboxviews, chatboxes } = _converse.state;
        chatboxviews.add(this.jid, this);
        this.model = chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:hidden', () => !this.model.get('hidden') && this.afterShown());
        this.listenTo(this.model, 'change:show_help_messages', () => this.requestUpdate());

        document.addEventListener('visibilitychange', () => this.onWindowStateChanged());

        await this.model.messages.fetched;
        !this.model.get('hidden') && this.afterShown();
        /**
         * Triggered once the {@link ChatView} has been initialized
         * @event _converse#chatBoxViewInitialized
         * @type {ChatView}
         * @example _converse.api.listen.on('chatBoxViewInitialized', view => { ... });
         */
        api.trigger('chatBoxViewInitialized', this);
    }

    render() {
        return tplChat(this);
    }

    getHelpMessages() {
        // eslint-disable-line class-methods-use-this
        return [
            `<strong>/clear</strong>: ${__('Remove messages')}`,
            `<strong>/close</strong>: ${__('Close this chat')}`,
            `<strong>/me</strong>: ${__('Write in the third person')}`,
            `<strong>/help</strong>: ${__('Show this menu')}`,
        ];
    }

    afterShown() {
        this.model.setChatState(ACTIVE);
        this.model.clearUnreadMsgCounter();
        this.maybeFocus();
    }
};

api.elements.define('converse-chat', ChatView);
