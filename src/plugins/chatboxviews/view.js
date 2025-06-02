import { api, _converse } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplChats from './templates/chats.js';


class ConverseChats extends CustomElement {

    initialize () {
        this.model = _converse.state.chatboxes;
        this.listenTo(this.model, 'add', () => this.requestUpdate());
        this.listenTo(this.model, 'change:closed', () => this.requestUpdate());
        this.listenTo(this.model, 'change:hidden', () => this.requestUpdate());
        this.listenTo(this.model, 'change:jid', () => this.requestUpdate());
        this.listenTo(this.model, 'destroy', () => this.requestUpdate());

        // Use listenTo instead of api.listen.to so that event handlers
        // automatically get deregistered when the component is dismounted
        this.listenTo(_converse, 'connected', () => this.requestUpdate());
        this.listenTo(_converse, 'reconnected', () => this.requestUpdate());
        this.listenTo(_converse, 'disconnected', () => this.requestUpdate());

        const settings = api.settings.get();
        this.listenTo(settings, 'change:view_mode', () => this.requestUpdate())
        this.listenTo(settings, 'change:singleton', () => this.requestUpdate())

        const body = document.querySelector('body');
        body.classList.add(`converse-${api.settings.get('view_mode')}`);

        /**
         * Triggered once the ChatBoxViews view-colleciton has been initialized
         * @event _converse#chatBoxViewsInitialized
         * @example _converse.api.listen.on('chatBoxViewsInitialized', () => { ... });
         */
        api.trigger('chatBoxViewsInitialized');
    }

    render () {
        return tplChats();
    }
}

api.elements.define('converse-chats', ConverseChats);
