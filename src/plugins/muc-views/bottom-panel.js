import 'shared/autocomplete/index.js';
import BottomPanel from 'plugins/chatview/bottom-panel.js';
import tplMUCBottomPanel from './templates/muc-bottom-panel.js';
import { _converse, api } from "@converse/headless";

import './styles/muc-bottom-panel.scss';


export default class MUCBottomPanel extends BottomPanel {

    async initialize () {
        await super.initialize();
        this.listenTo(this.model, 'change:hidden_occupants', () => this.requestUpdate());
        this.listenTo(this.model, 'change:num_unread_general', () => this.requestUpdate())
        this.listenTo(this.model.features, 'change:moderated', () => this.requestUpdate());
        this.listenTo(this.model.occupants, 'add', this.renderIfOwnOccupant);
        this.listenTo(this.model.occupants, 'change:role', this.renderIfOwnOccupant);
        this.listenTo(this.model.session, 'change:connection_status', () => this.requestUpdate());
    }

    render () {
        if (!this.model) return '';
        return tplMUCBottomPanel(this);
    }

    renderIfOwnOccupant (o) {
        const bare_jid = _converse.session.get('bare_jid');
        (o.get('jid') === bare_jid) && this.requestUpdate();
    }

    sendButtonClicked (ev) {
        if (ev.delegateTarget?.dataset.action === 'sendMessage') {
            const form = /** @type {HTMLFormElement} */(this.querySelector('converse-muc-message-form'));
            form?.onFormSubmitted(ev);
        }
    }
}

api.elements.define('converse-muc-bottom-panel', MUCBottomPanel);
