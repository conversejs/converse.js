import BaseChatView from 'shared/chat/baseview.js';
import tpl_headlines from './templates/headlines.js';
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

        this.model.disable_mam = true; // Don't do MAM queries for this box
        this.listenTo(this.model, 'change:hidden', () => this.afterShown());
        this.listenTo(this.model, 'destroy', this.remove);
        this.listenTo(this.model, 'show', this.show);
        this.listenTo(_converse, 'windowStateChanged', this.onWindowStateChanged);

        this.render();

        // Need to be registered after render has been called.
        this.listenTo(this.model.messages, 'add', this.onMessageAdded);
        this.listenTo(this.model.messages, 'remove', this.renderChatHistory);
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
        const result = tpl_headlines(
            Object.assign(this.model.toJSON(), {
                show_send_button: false,
                show_toolbar: false,
            })
        );
        render(result, this);
        this.content = this.querySelector('.chat-content');
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

    afterShown () { // eslint-disable-line class-methods-use-this
        return;
    }
}

api.elements.define('converse-headlines', HeadlinesView);
