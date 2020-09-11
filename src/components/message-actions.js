import { CustomElement } from './element.js';
import { __ } from '../i18n';
import { api } from "@converse/headless/converse-core";
import { html } from 'lit-element';
import { until } from 'lit-html/directives/until.js';


class MessageActions extends CustomElement {

    static get properties () {
        return {
            chatview: { type: Object },
            model: { type: Object },
            editable: { type: Boolean },
            correcting: { type: Boolean },
            message_type: { type: String },
            is_retracted: { type: Boolean },
        }
    }

    render () {
        return html`${ until(this.renderActions(), '') }`;
    }

    static getActionsDropdownItem (o) {
        return html`
            <button class="chat-msg__action ${o.button_class}" @click=${o.handler}>
                <converse-icon class="${o.icon_class}"
                    path-prefix="${api.settings.get("assets_path")}"
                    color="var(--text-color-lighten-15-percent)"
                    size="1em"></converse-icon>
                ${o.i18n_text}
            </button>
        `;
    }

    onMessageEditButtonClicked (ev) {
        ev.preventDefault();
        this.chatview.onMessageEditButtonClicked(this.model);
    }

    onMessageRetractButtonClicked (ev) {
        ev.preventDefault();
        this.chatview.onMessageRetractButtonClicked(this.model);
    }

    async renderActions () {
        const buttons = [];
        if (this.editable) {
            buttons.push({
                'i18n_text': this.correcting ? __('Cancel Editing') : __('Edit'),
                'handler': ev => this.onMessageEditButtonClicked(ev),
                'button_class': 'chat-msg__action-edit',
                'icon_class': 'fa fa-pencil-alt',
                'name': 'edit'
            });
        }
        const may_be_moderated = this.model.get('type') === 'groupchat' && await this.model.mayBeModerated();
        const retractable = !this.is_retracted && (this.model.mayBeRetracted() || may_be_moderated);
        if (retractable) {
            buttons.push({
                'i18n_text': __('Retract'),
                'handler': ev => this.onMessageRetractButtonClicked(ev),
                'button_class': 'chat-msg__action-retract',
                'icon_class': 'fas fa-trash-alt',
                'name': 'retract'
            });
        }
        const items = buttons.map(b => MessageActions.getActionsDropdownItem(b));
        if (items.length) {
            return html`<converse-dropdown class="chat-msg__actions" .items=${ items }></converse-dropdown>`;
        } else {
            return '';
        }
    }
}

api.elements.define('converse-message-actions', MessageActions);
