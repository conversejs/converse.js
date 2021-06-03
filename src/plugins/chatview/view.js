import 'plugins/chatview/heading.js';
import 'plugins/chatview/bottom-panel.js';
import { html, render } from 'lit';
import BaseChatView from 'shared/chat/baseview.js';
import tpl_chat from './templates/chat.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';

const u = converse.env.utils;
const { dayjs } = converse.env;

/**
 * The View of an open/ongoing chat conversation.
 * @class
 * @namespace _converse.ChatBoxView
 * @memberOf _converse
 */
export default class ChatView extends BaseChatView {
    length = 200
    className = 'chatbox hidden'

    async initialize () {
        const jid = this.getAttribute('jid');
        _converse.chatboxviews.add(jid, this);

        this.model = _converse.chatboxes.get(jid);
        this.initDebounced();

        this.listenTo(_converse, 'windowStateChanged', this.onWindowStateChanged);
        this.listenTo(this.model, 'change:hidden', () => !this.model.get('hidden') && this.afterShown());
        this.listenTo(this.model, 'change:status', this.onStatusMessageChanged);
        this.render();

        // Need to be registered after render has been called.
        this.listenTo(this.model, 'change:show_help_messages', this.renderHelpMessages);

        await this.model.messages.fetched;
        !this.model.get('hidden') && this.afterShown()
        /**
         * Triggered once the {@link _converse.ChatBoxView} has been initialized
         * @event _converse#chatBoxViewInitialized
         * @type { _converse.HeadlinesBoxView }
         * @example _converse.api.listen.on('chatBoxViewInitialized', view => { ... });
         */
        api.trigger('chatBoxViewInitialized', this);
    }

    render () {
        const result = tpl_chat(Object.assign(
            this.model.toJSON(), { 'markScrolled': ev => this.markScrolled(ev) })
        );
        render(result, this);
        this.help_container = this.querySelector('.chat-content__help');
        return this;
    }

    renderHelpMessages () {
        render(
            html`
                <converse-chat-help
                    .model=${this.model}
                    .messages=${this.getHelpMessages()}
                    ?hidden=${!this.model.get('show_help_messages')}
                    type="info"
                    chat_type="${this.model.get('type')}"
                ></converse-chat-help>
            `,
            this.help_container
        );
    }

    getHelpMessages () { // eslint-disable-line class-methods-use-this
        return [
            `<strong>/clear</strong>: ${__('Remove messages')}`,
            `<strong>/close</strong>: ${__('Close this chat')}`,
            `<strong>/me</strong>: ${__('Write in the third person')}`,
            `<strong>/help</strong>: ${__('Show this menu')}`
        ];
    }

    showControlBox () {
        // Used in mobile view, to navigate back to the controlbox
        _converse.chatboxviews.get('controlbox')?.show();
        this.hide();
    }

    /**
     * Given a message element, determine wether it should be
     * marked as a followup message to the previous element.
     *
     * Also determine whether the element following it is a
     * followup message or not.
     *
     * Followup messages are subsequent ones written by the same
     * author with no other conversation elements in between and
     * which were posted within 10 minutes of one another.
     * @private
     * @method _converse.ChatBoxView#markFollowups
     * @param { HTMLElement } el - The message element
     */
    markFollowups (el) { // eslint-disable-line class-methods-use-this
        const from = el.getAttribute('data-from');
        const previous_el = el.previousElementSibling;
        const date = dayjs(el.getAttribute('data-isodate'));
        const next_el = el.nextElementSibling;

        if (
            !u.hasClass('chat-msg--action', el) &&
            !u.hasClass('chat-msg--action', previous_el) &&
            !u.hasClass('chat-info', el) &&
            !u.hasClass('chat-info', previous_el) &&
            previous_el.getAttribute('data-from') === from &&
            date.isBefore(dayjs(previous_el.getAttribute('data-isodate')).add(10, 'minutes')) &&
            el.getAttribute('data-encrypted') === previous_el.getAttribute('data-encrypted')
        ) {
            u.addClass('chat-msg--followup', el);
        }
        if (!next_el) {
            return;
        }

        if (
            !u.hasClass('chat-msg--action', el) &&
            u.hasClass('chat-info', el) &&
            next_el.getAttribute('data-from') === from &&
            dayjs(next_el.getAttribute('data-isodate')).isBefore(date.add(10, 'minutes')) &&
            el.getAttribute('data-encrypted') === next_el.getAttribute('data-encrypted')
        ) {
            u.addClass('chat-msg--followup', next_el);
        } else {
            u.removeClass('chat-msg--followup', next_el);
        }
    }

    /**
     * Closes this chat
     * @private
     * @method _converse.ChatBoxView#close
     */
    close (ev) {
        ev?.preventDefault?.();
        if (_converse.router.history.getFragment() === 'converse/chat?jid=' + this.model.get('jid')) {
            _converse.router.navigate('');
        }
        return this.model.close(ev);
    }

    afterShown () {
        this.model.clearUnreadMsgCounter();
        this.model.setChatState(_converse.ACTIVE);
        this.scrollDown();
        this.maybeFocus();
    }
}

api.elements.define('converse-chat', ChatView);
