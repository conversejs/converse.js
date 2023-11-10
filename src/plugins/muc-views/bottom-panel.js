import 'shared/autocomplete/index.js';
import BottomPanel from 'plugins/chatview/bottom-panel.js';
import tplMUCBottomPanel from './templates/muc-bottom-panel.js';
import { _converse, api, converse } from "@converse/headless";

import './styles/muc-bottom-panel.scss';


export default class MUCBottomPanel extends BottomPanel {

    async initialize () {
        await super.initialize();
        this.listenTo(this.model, 'change:hidden_occupants', () => this.requestUpdate());
        this.listenTo(this.model, 'change:num_unread_general', () => this.requestUpdate())
        this.listenTo(this.model.features, 'change:moderated', () => this.requestUpdate());
        this.listenTo(this.model.occupants, 'add', this.renderIfOwnOccupant)
        this.listenTo(this.model.occupants, 'change:role', this.renderIfOwnOccupant);
        this.listenTo(this.model.session, 'change:connection_status', () => this.requestUpdate());
    }

    render () {
        if (!this.model) return '';
        const entered = this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED;
        const can_edit = entered && !(this.model.features.get('moderated') && this.model.getOwnRole() === 'visitor');
        return tplMUCBottomPanel({
            can_edit, entered,
            'model': this.model,
            'is_groupchat': true,
            'viewUnreadMessages': ev => this.viewUnreadMessages(ev)
        });
    }

    renderIfOwnOccupant (o) {
        (o.get('jid') === _converse.bare_jid) && this.requestUpdate();
    }

    sendButtonClicked (ev) {
        if (ev.delegateTarget?.dataset.action === 'sendMessage') {
            const form = /** @type {HTMLFormElement} */(this.querySelector('converse-muc-message-form'));
            form?.onFormSubmitted(ev);
        }
    }
}

api.elements.define('converse-muc-bottom-panel', MUCBottomPanel);
