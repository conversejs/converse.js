import MessageForm from 'plugins/chatview/message-form.js';
import tplMUCMessageForm from './templates/message-form.js';
import { _converse, api, converse } from "@converse/headless";
import { getAutoCompleteListItem } from './utils.js';


export default class MUCMessageForm extends MessageForm {

    async initialize() {
        super.initialize();
        await this.model.initialized;
        this.initMentionAutoComplete();
    }

    render () {
        return tplMUCMessageForm(
            Object.assign(this.model.toJSON(), {
                'hint_value': this.querySelector('.spoiler-hint')?.value,
                'message_value': this.querySelector('.chat-textarea')?.value,
                'onChange': ev => this.model.set({'draft': ev.target.value}),
                'onDrop': ev => this.onDrop(ev),
                'onKeyDown': ev => this.onKeyDown(ev),
                'onKeyUp': ev => this.onKeyUp(ev),
                'onPaste': ev => this.onPaste(ev),
                'scrolled': this.model.ui.get('scrolled'),
                'viewUnreadMessages': ev => this.viewUnreadMessages(ev)
            }));
    }

    shouldAutoComplete () {
        const entered = this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED;
        return entered && !(this.model.features.get('moderated') && this.model.getOwnRole() === 'visitor');
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

    getAutoCompleteList () {
        return this.model.getAllKnownNicknames().map(nick => ({ 'label': nick, 'value': `@${nick}` }));
    }

    /**
     * @param {Event} ev
     */
    onKeyDown (ev) {
        if (this.shouldAutoComplete() && this.mention_auto_complete.onKeyDown(ev)) {
            return;
        }
        super.onKeyDown(ev);
    }

    /**
     * @param {Event} ev
     */
    onKeyUp (ev) {
        if (this.shouldAutoComplete()) this.mention_auto_complete.evaluate(ev);
        super.onKeyUp(ev);
    }
}

api.elements.define('converse-muc-message-form', MUCMessageForm);
