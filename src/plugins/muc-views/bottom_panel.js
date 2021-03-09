import BottomPanel from 'plugins/chatview/bottom_panel.js';
import debounce from 'lodash/debounce';
import tpl_muc_bottom_panel from './templates/muc-bottom-panel.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { getAutoCompleteListItem, parseMessageForMUCCommands } from './utils.js';
import { render } from 'lit-html';


export default class MUCBottomPanel extends BottomPanel {

    events = {
        'click .hide-occupants': 'hideOccupants',
        'click .send-button': 'onFormSubmitted',
    }

    async connectedCallback () {
        // this.model gets set in the super method and we also wait there for this.model.initialized
        await super.connectedCallback();
        this.debouncedRender = debounce(this.render, 100);
        this.listenTo(this.model, 'change:composing_spoiler', this.renderMessageForm);
        this.listenTo(this.model, 'change:hidden_occupants', this.debouncedRender);
        this.listenTo(this.model.features, 'change:moderated', this.debouncedRender);
        this.listenTo(this.model.occupants, 'add', this.renderIfOwnOccupant)
        this.listenTo(this.model.occupants, 'change:role', this.renderIfOwnOccupant);
        this.listenTo(this.model.session, 'change:connection_status', this.debouncedRender);
        this.render();
    }

    render () {
        const entered = this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED;
        const can_edit = entered && !(this.model.features.get('moderated') && this.model.getOwnRole() === 'visitor');
        render(tpl_muc_bottom_panel({ can_edit, entered, 'model': this.model }), this);
        if (entered && can_edit) {
            this.renderMessageForm();
            this.initMentionAutoComplete();
        }
    }

    renderIfOwnOccupant (o) {
        (o.get('jid') === _converse.bare_jid) && this.debouncedRender();
    }

    getToolbarOptions () {
        return Object.assign(super.getToolbarOptions(), {
            'is_groupchat': true,
            'label_hide_occupants': __('Hide the list of participants'),
            'show_occupants_toggle': api.settings.get('visible_toolbar_buttons').toggle_occupants
        });
    }

    getAutoCompleteList () {
        return this.model.getAllKnownNicknames().map(nick => ({ 'label': nick, 'value': `@${nick}` }));
    }

    initMentionAutoComplete () {
        this.mention_auto_complete = new _converse.AutoComplete(this, {
            'auto_first': true,
            'auto_evaluate': false,
            'min_chars': api.settings.get('muc_mention_autocomplete_min_chars'),
            'match_current_word': true,
            'list': () => this.getAutoCompleteList(),
            'filter':
                api.settings.get('muc_mention_autocomplete_filter') == 'contains'
                    ? _converse.FILTER_CONTAINS
                    : _converse.FILTER_STARTSWITH,
            'ac_triggers': ['Tab', '@'],
            'include_triggers': [],
            'item': getAutoCompleteListItem
        });
        this.mention_auto_complete.on('suggestion-box-selectcomplete', () => (this.auto_completing = false));
    }

    /**
     * Hide the right sidebar containing the chat occupants.
     * @private
     * @method _converse.ChatRoomView#hideOccupants
     */
    hideOccupants (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.model.save({ 'hidden_occupants': true });
        _converse.chatboxviews.get(this.getAttribute('jid'))?.scrollDown();
    }

    onKeyDown (ev) {
        if (this.mention_auto_complete.onKeyDown(ev)) {
            return;
        }
        super.onKeyDown(ev);
    }

    onKeyUp (ev) {
        this.mention_auto_complete.evaluate(ev);
        super.onKeyUp(ev);
    }

    parseMessageForCommands (text) {
        return parseMessageForMUCCommands(this.model, text);
    }
}

api.elements.define('converse-muc-bottom-panel', MUCBottomPanel);
