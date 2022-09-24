import MinimizedChatsToggle from './toggle.js';
import tpl_chats_panel from './templates/chats-panel.js';
import { CustomElement } from 'shared/components/element';
import { _converse, api } from '@converse/headless/core';
import { initStorage } from '@converse/headless/utils/storage.js';


export default class MinimizedChats extends CustomElement {

    async initialize () {
        this.model = _converse.chatboxes;
        await this.initToggle();
        this.listenTo(this.minchats, 'change:collapsed', () => this.requestUpdate())
        this.listenTo(this.model, 'add', () => this.requestUpdate())
        this.listenTo(this.model, 'change:fullname', () => this.requestUpdate())
        this.listenTo(this.model, 'change:jid', () => this.requestUpdate())
        this.listenTo(this.model, 'change:minimized', () => this.requestUpdate())
        this.listenTo(this.model, 'change:name', () => this.requestUpdate())
        this.listenTo(this.model, 'change:num_unread', () => this.requestUpdate())
        this.listenTo(this.model, 'remove', () => this.requestUpdate())

        this.listenTo(_converse, 'connected', () => this.requestUpdate());
        this.listenTo(_converse, 'reconnected', () => this.requestUpdate());
        this.listenTo(_converse, 'disconnected', () => this.requestUpdate());
    }

    render () {
        const chats = this.model.where({'minimized': true});
        const num_unread = chats.reduce((acc, chat) => (acc + chat.get('num_unread')), 0);
        const num_minimized = chats.reduce((acc, chat) => (acc + (chat.get('minimized') ? 1 : 0)), 0);
        const collapsed = this.minchats.get('collapsed');
        const data = { chats, num_unread, num_minimized, collapsed };
        data.toggle = ev => this.toggle(ev);
        return tpl_chats_panel(data);
    }

    async initToggle () {
        const id = `converse.minchatstoggle-${_converse.bare_jid}`;
        this.minchats = new MinimizedChatsToggle({id});
        initStorage(this.minchats, id, 'session');
        await new Promise(resolve => this.minchats.fetch({'success': resolve, 'error': resolve}));
    }

    toggle (ev) {
        ev?.preventDefault();
        this.minchats.save({'collapsed': !this.minchats.get('collapsed')});
    }
}

api.elements.define('converse-minimized-chats', MinimizedChats);
