import tpl_background_logo from '../../templates/background_logo.js';
import tpl_chats from './templates/chats.js';
import { CustomElement } from 'shared/components/element.js';
import { api, _converse } from '@converse/headless/core';
import { getAppSettings } from '@converse/headless/shared/settings/utils.js';
import { render } from 'lit';


class ConverseChats extends CustomElement {

    initialize () {
        this.model = _converse.chatboxes;
        this.listenTo(this.model, 'add', () => this.requestUpdate());
        this.listenTo(this.model, 'change:closed', () => this.requestUpdate());
        this.listenTo(this.model, 'change:hidden', () => this.requestUpdate());
        this.listenTo(this.model, 'change:jid', () => this.requestUpdate());
        this.listenTo(this.model, 'change:minimized', () => this.requestUpdate());
        this.listenTo(this.model, 'destroy', () => this.requestUpdate());

        // Use listenTo instead of api.listen.to so that event handlers
        // automatically get deregistered when the component is dismounted
        this.listenTo(_converse, 'connected', () => this.requestUpdate());
        this.listenTo(_converse, 'reconnected', () => this.requestUpdate());
        this.listenTo(_converse, 'disconnected', () => this.requestUpdate());

        const settings = getAppSettings();
        this.listenTo(settings, 'change:view_mode', () => this.requestUpdate())
        this.listenTo(settings, 'change:singleton', () => this.requestUpdate())

        const bg = document.getElementById('conversejs-bg');
        if (bg && !bg.innerHTML.trim()) {
            render(tpl_background_logo(), bg);
        }
        const body = document.querySelector('body');
        body.classList.add(`converse-${api.settings.get('view_mode')}`);

        /**
         * Triggered once the _converse.ChatBoxViews view-colleciton has been initialized
         * @event _converse#chatBoxViewsInitialized
         * @example _converse.api.listen.on('chatBoxViewsInitialized', () => { ... });
         */
        api.trigger('chatBoxViewsInitialized');
    }

    render () { // eslint-disable-line class-methods-use-this
        return tpl_chats();
    }
}

api.elements.define('converse-chats', ConverseChats);
