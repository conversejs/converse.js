import BaseChatView from 'shared/chatview.js';
import tpl_chatbox from 'templates/chatbox.js';
import tpl_chat_head from './templates/chat-head.js';
import { __ } from 'i18n';
import { _converse, api } from '@converse/headless/core';
import { render } from 'lit-html';


class HeadlinesView extends BaseChatView {
    events = {
        'click .close-chatbox-button': 'close',
        'click .toggle-chatbox-button': 'minimize',
        'keypress textarea.chat-textarea': 'onKeyDown'
    }

    async initialize () {
        const jid = this.getAttribute('jid');
        _converse.chatboxviews.add(jid, this);

        this.model = _converse.chatboxes.get(jid);
        this.initDebounced();

        api.listen.on('windowStateChanged', this.onWindowStateChanged);

        this.model.disable_mam = true; // Don't do MAM queries for this box
        this.listenTo(this.model, 'change:hidden', () => this.afterShown());
        this.listenTo(this.model, 'destroy', this.remove);
        this.listenTo(this.model, 'show', this.show);

        this.render();

        // Need to be registered after render has been called.
        this.listenTo(this.model.messages, 'add', this.onMessageAdded);
        this.listenTo(this.model.messages, 'remove', this.renderChatHistory);
        this.listenTo(this.model.messages, 'rendered', this.maybeScrollDown);
        this.listenTo(this.model.messages, 'reset', this.renderChatHistory);

        await this.model.messages.fetched;
        this.model.maybeShow();
        this.scrollDown();
        /**
         * Triggered once the {@link _converse.HeadlinesBoxView} has been initialized
         * @event _converse#headlinesBoxViewInitialized
         * @type { _converse.HeadlinesBoxView }
         * @example _converse.api.listen.on('headlinesBoxViewInitialized', view => { ... });
         */
        api.trigger('headlinesBoxViewInitialized', this);
    }

    render () {
        this.setAttribute('id', this.model.get('box_id'));
        const result = tpl_chatbox(
            Object.assign(this.model.toJSON(), {
                info_close: '',
                label_personal_message: '',
                show_send_button: false,
                show_toolbar: false,
                unread_msgs: ''
            })
        );
        render(result, this);
        this.content = this.querySelector('.chat-content');
        this.msgs_container = this.querySelector('.chat-content__messages');
        this.renderChatContent();
        this.renderHeading();
        return this;
    }

    async close (ev) {
        ev?.preventDefault?.();
        if (_converse.router.history.getFragment() === 'converse/chat?jid=' + this.model.get('jid')) {
            _converse.router.navigate('');
        }
        await this.model.close(ev);
        api.trigger('chatBoxClosed', this);
        return this;
    }


    getNotifications () { // eslint-disable-line class-methods-use-this
        // Override method in ChatBox. We don't show notifications for
        // headlines boxes.
        return [];
    }

    async generateHeadingTemplate () {
        const heading_btns = await this.getHeadingButtons();
        const standalone_btns = heading_btns.filter(b => b.standalone);
        const dropdown_btns = heading_btns.filter(b => !b.standalone);
        return tpl_chat_head(
            Object.assign(this.model.toJSON(), {
                'display_name': this.model.getDisplayName(),
                'dropdown_btns': dropdown_btns.map(b => this.getHeadingDropdownItem(b)),
                'standalone_btns': standalone_btns.map(b => this.getHeadingStandaloneButton(b))
            })
        );
    }

    /**
     * Returns a list of objects which represent buttons for the headlines header.
     * @async
     * @emits _converse#getHeadingButtons
     * @private
     * @method _converse.HeadlinesBoxView#getHeadingButtons
     */
    getHeadingButtons () {
        const buttons = [];
        if (!api.settings.get('singleton')) {
            buttons.push({
                'a_class': 'close-chatbox-button',
                'handler': ev => this.close(ev),
                'i18n_text': __('Close'),
                'i18n_title': __('Close these announcements'),
                'icon_class': 'fa-times',
                'name': 'close',
                'standalone': api.settings.get('view_mode') === 'overlayed'
            });
        }
        return _converse.api.hook('getHeadingButtons', this, buttons);
    }

    // Override to avoid the methods in converse-chatview
    renderMessageForm () { // eslint-disable-line class-methods-use-this
        return;
    }

    afterShown () { // eslint-disable-line class-methods-use-this
        return;
    }
}

api.elements.define('converse-headlines', HeadlinesView);
