import 'shared/autocomplete/index.js';
import BottomPanel from 'plugins/chatview/bottom-panel.js';
import debounce from 'lodash-es/debounce';
import tpl_muc_bottom_panel from './templates/muc-bottom-panel.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { render } from 'lit';

import './styles/muc-bottom-panel.scss';


export default class MUCBottomPanel extends BottomPanel {

    events = {
        'click .hide-occupants': 'hideOccupants',
        'click .send-button': 'sendButtonClicked',
    }

    async connectedCallback () {
        // this.model gets set in the super method and we also wait there for this.model.initialized
        await super.connectedCallback();
        this.debouncedRender = debounce(this.render, 100);
        this.listenTo(this.model, 'change:hidden_occupants', this.debouncedRender);
        this.listenTo(this.model, 'change:num_unread_general', this.debouncedRender)
        this.listenTo(this.model.features, 'change:moderated', this.debouncedRender);
        this.listenTo(this.model.occupants, 'add', this.renderIfOwnOccupant)
        this.listenTo(this.model.occupants, 'change:role', this.renderIfOwnOccupant);
        this.listenTo(this.model.session, 'change:connection_status', this.debouncedRender);
        this.render();
    }

    render () {
        const entered = this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED;
        const can_edit = entered && !(this.model.features.get('moderated') && this.model.getOwnRole() === 'visitor');
        render(tpl_muc_bottom_panel({
            can_edit, entered,
            'model': this.model,
            'viewUnreadMessages': ev => this.viewUnreadMessages(ev)
        }), this);
    }

    renderIfOwnOccupant (o) {
        (o.get('jid') === _converse.bare_jid) && this.debouncedRender();
    }

    sendButtonClicked (ev) {
        this.querySelector('converse-message-form')?.onFormSubmitted(ev);
    }

    getToolbarOptions () {
        return Object.assign(super.getToolbarOptions(), {
            'is_groupchat': true,
            'label_hide_occupants': __('Hide the list of participants'),
            'show_occupants_toggle': api.settings.get('visible_toolbar_buttons').toggle_occupants
        });
    }

    hideOccupants (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.model.save({ 'hidden_occupants': true });
    }
}

api.elements.define('converse-muc-bottom-panel', MUCBottomPanel);
