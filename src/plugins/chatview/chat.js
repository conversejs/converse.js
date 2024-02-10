import 'plugins/chatview/heading.js';
import 'plugins/chatview/bottom-panel.js';
import BaseChatView from 'shared/chat/baseview.js';
import tplChat from './templates/chat.js';
import { __ } from 'i18n';
import { _converse, api } from '@converse/headless';

/**
 * The view of an open/ongoing chat conversation.
 * @class
 * @namespace _converse.ChatView
 * @memberOf _converse
 */
export default class ChatView extends BaseChatView {
    length = 200

    async initialize () {
        _converse.chatboxviews.add(this.jid, this);
        this.model = _converse.chatboxes.get(this.jid);
        this.listenTo(this.model, 'change:hidden', () => !this.model.get('hidden') && this.afterShown());
        this.listenTo(this.model, 'change:show_help_messages', () => this.requestUpdate());

        document.addEventListener('visibilitychange',  () => this.onWindowStateChanged());

        await this.model.messages.fetched;
        !this.model.get('hidden') && this.afterShown()
        /**
         * Triggered once the {@link _converse.ChatBoxView} has been initialized
         * @event _converse#chatBoxViewInitialized
         * @type { _converse.ChatBoxView }
         * @example _converse.api.listen.on('chatBoxViewInitialized', view => { ... });
         */
        api.trigger('chatBoxViewInitialized', this);
    }

    render () {
        return tplChat(Object.assign({
            'model': this.model,
            'help_messages': this.getHelpMessages(),
            'show_help_messages': this.model.get('show_help_messages'),
        }, this.model.toJSON()));
    }

    getHelpMessages () { // eslint-disable-line class-methods-use-this
        return [
            `<strong>/clear</strong>: ${__('Remove messages')}`,
            `<strong>/close</strong>: ${__('Close this chat')}`,
            `<strong>/me</strong>: ${__('Write in the third person')}`,
            `<strong>/help</strong>: ${__('Show this menu')}`
        ];
    }

    afterShown () {
        this.model.setChatState(_converse.ACTIVE);
        this.model.clearUnreadMsgCounter();
        this.maybeFocus();
    }
}

api.elements.define('converse-chat', ChatView);
