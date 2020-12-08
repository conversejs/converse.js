import tpl_chatbox from 'templates/chatbox.js';
import { __ } from 'i18n';
import { _converse, api } from '@converse/headless/core';
import { render } from 'lit-html';

const HeadlinesBoxViewMixin = {
    className: 'chatbox headlines hidden',

    events: {
        'click .close-chatbox-button': 'close',
        'click .toggle-chatbox-button': 'minimize',
        'keypress textarea.chat-textarea': 'onKeyDown'
    },

    async initialize () {
        const jid = this.getAttribute('jid');
        _converse.chatboxviews.add(jid, this);

        this.model = _converse.chatboxes.get(jid);
        this.initDebounced();

        api.listen.on('windowStateChanged', this.onWindowStateChanged);

        this.model.disable_mam = true; // Don't do MAM queries for this box
        this.listenTo(this.model, 'change:hidden', m => (m.get('hidden') ? this.hide() : this.show()));
        this.listenTo(this.model, 'destroy', this.remove);
        this.listenTo(this.model, 'show', this.show);

        this.render();

        // Need to be registered after render has been called.
        this.listenTo(this.model.messages, 'add', this.onMessageAdded);
        this.listenTo(this.model.messages, 'remove', this.renderChatHistory);
        this.listenTo(this.model.messages, 'rendered', this.maybeScrollDown);
        this.listenTo(this.model.messages, 'reset', this.renderChatHistory);

        await this.model.messages.fetched;
        this.insertIntoDOM();
        this.model.maybeShow();
        this.scrollDown();
        /**
         * Triggered once the {@link _converse.HeadlinesBoxView} has been initialized
         * @event _converse#headlinesBoxViewInitialized
         * @type { _converse.HeadlinesBoxView }
         * @example _converse.api.listen.on('headlinesBoxViewInitialized', view => { ... });
         */
        api.trigger('headlinesBoxViewInitialized', this);
    },

    render () {
        this.el.setAttribute('id', this.model.get('box_id'));
        const result = tpl_chatbox(
            Object.assign(this.model.toJSON(), {
                info_close: '',
                label_personal_message: '',
                show_send_button: false,
                show_toolbar: false,
                unread_msgs: ''
            })
        );
        render(result, this.el);
        this.content = this.el.querySelector('.chat-content');
        this.msgs_container = this.el.querySelector('.chat-content__messages');
        this.renderChatContent();
        this.renderHeading();
        return this;
    },

    getNotifications () {
        // Override method in ChatBox. We don't show notifications for
        // headlines boxes.
        return [];
    },

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
    },

    // Override to avoid the methods in converse-chatview
    'renderMessageForm': function renderMessageForm () {},
    'afterShown': function afterShown () {}
};

export default HeadlinesBoxViewMixin;
