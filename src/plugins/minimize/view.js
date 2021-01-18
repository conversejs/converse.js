import tpl_chats_panel from './templates/chats-panel.js';
import { ElementView } from '@converse/skeletor/src/element.js';
import { _converse, api } from '@converse/headless/core';
import { render } from 'lit-html';


class MinimizedChats extends ElementView {

    async initialize () {
        this.model = _converse.chatboxes;
        await this.initToggle();
        this.render();
        this.listenTo(this.minchats, 'change:collapsed', this.render)
        this.listenTo(this.model, 'add', this.render)
        this.listenTo(this.model, 'change:fullname', this.render)
        this.listenTo(this.model, 'change:jid', this.render)
        this.listenTo(this.model, 'change:minimized', this.render)
        this.listenTo(this.model, 'change:name', this.render)
        this.listenTo(this.model, 'change:num_unread', this.render)
        this.listenTo(this.model, 'remove', this.render)
    }

    render () {
        const chats = this.model.where({'minimized': true});
        const num_unread = chats.reduce((acc, chat) => (acc + chat.get('num_unread')), 0);
        const num_minimized = chats.reduce((acc, chat) => (acc + (chat.get('minimized') ? 1 : 0)), 0);
        const collapsed = this.minchats.get('collapsed');
        const data = { chats, num_unread, num_minimized, collapsed };
        data.toggle = ev => this.toggle(ev);
        render(tpl_chats_panel(data), this);
    }

    async initToggle () {
        const id = `converse.minchatstoggle-${_converse.bare_jid}`;
        this.minchats = new _converse.MinimizedChatsToggle({id});
        this.minchats.browserStorage = _converse.createStore(id);
        await new Promise(resolve => this.minchats.fetch({'success': resolve, 'error': resolve}));
    }

    toggle (ev) {
        ev?.preventDefault();
        this.minchats.save({'collapsed': !this.minchats.get('collapsed')});
    }
}

api.elements.define('converse-minimized-chats', MinimizedChats);
