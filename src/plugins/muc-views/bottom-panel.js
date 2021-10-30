import 'shared/autocomplete/index.js';
import BottomPanel from 'plugins/chatview/bottom-panel.js';
import tpl_muc_bottom_panel from './templates/muc-bottom-panel.js';
import { _converse, api, converse } from "@converse/headless/core";
import { render } from 'lit';

import './styles/muc-bottom-panel.scss';


export default class MUCBottomPanel extends BottomPanel {

    events = {
        'click .hide-occupants': 'hideOccupants',
        'click .send-button': 'sendButtonClicked',
    }

    async initialize () {
        await super.initialize();
        this.listenTo(this.model, 'change:hidden_occupants', this.debouncedRender);
        this.listenTo(this.model, 'change:num_unread_general', this.debouncedRender)
        this.listenTo(this.model.features, 'change:moderated', this.debouncedRender);
        this.listenTo(this.model.occupants, 'add', this.renderIfOwnOccupant)
        this.listenTo(this.model.occupants, 'change:role', this.renderIfOwnOccupant);
        this.listenTo(this.model.session, 'change:connection_status', this.debouncedRender);
    }

    render () {
        const entered = this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED;
        const can_edit = entered && !(this.model.features.get('moderated') && this.model.getOwnRole() === 'visitor');
        render(tpl_muc_bottom_panel({
            can_edit, entered,
            'model': this.model,
            'is_groupchat': true,
            'viewUnreadMessages': ev => this.viewUnreadMessages(ev)
        }), this);
    }

    renderIfOwnOccupant (o) {
        (o.get('jid') === _converse.bare_jid) && this.debouncedRender();
    }

    sendButtonClicked (ev) {
        this.querySelector('converse-muc-message-form')?.onFormSubmitted(ev);
    }

    hideOccupants (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.model.save({ 'hidden_occupants': true });
    }
}

api.elements.define('converse-muc-bottom-panel', MUCBottomPanel);
