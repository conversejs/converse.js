import { _converse, api, u } from '@converse/headless';
import { CustomElement } from 'shared/components/element';
import MinimizedChatsToggle from './toggle.js';
import tplToggle from './templates/toggle.js';


export default class MinimizedChats extends CustomElement {

    async initialize () {
        this.model = _converse.state.chatboxes;
        await this.initToggle();
        this.listenTo(this.minchats, 'change:collapsed', () => this.requestUpdate())
        this.listenTo(this.model, 'add', () => this.requestUpdate())
        this.listenTo(this.model, 'change:fullname', () => this.requestUpdate())
        this.listenTo(this.model, 'change:jid', () => this.requestUpdate())
        this.listenTo(this.model, 'change:hidden', () => this.requestUpdate())
        this.listenTo(this.model, 'change:name', () => this.requestUpdate())
        this.listenTo(this.model, 'change:num_unread', () => this.requestUpdate())
        this.listenTo(this.model, 'remove', () => this.requestUpdate())

        this.listenTo(_converse, 'connected', () => this.requestUpdate());
        this.listenTo(_converse, 'reconnected', () => this.requestUpdate());
        this.listenTo(_converse, 'disconnected', () => this.requestUpdate());
    }

    render () {
        return tplToggle(this);
    }

    async initToggle () {
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.minchatstoggle-${bare_jid}`;
        this.minchats = new MinimizedChatsToggle({id});
        u.initStorage(this.minchats, id, 'session');
        await new Promise(resolve => this.minchats.fetch({'success': resolve, 'error': resolve}));
    }

    /**
     * @param {Event} [ev]
     */
    toggle (ev) {
        ev?.preventDefault();
        this.minchats.save({'collapsed': !this.minchats.get('collapsed')});
    }
}

api.elements.define('converse-minimized-chats', MinimizedChats);
