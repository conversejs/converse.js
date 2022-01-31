import './emoji-picker.js';
import 'shared/chat/message-limit.js';
import tpl_toolbar from './templates/toolbar.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';
import { html } from 'lit';
import { until } from 'lit/directives/until.js';

import './styles/toolbar.scss';

const Strophe = converse.env.Strophe


export class ChatToolbar extends CustomElement {

    static get properties () {
        return {
            composing_spoiler: { type: Boolean },
            hidden_occupants: { type: Boolean },
            is_groupchat: { type: Boolean },
            message_limit: { type: Number },
            model: { type: Object },
            show_call_button: { type: Boolean },
            show_emoji_button: { type: Boolean },
            show_send_button: { type: Boolean },
            show_spoiler_button: { type: Boolean },
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.listenTo(this.model, 'change:composing_spoiler', this.requestUpdate);
    }

    render () {
        return tpl_toolbar(this);
    }

    firstUpdated () {
        /**
         * Triggered once the _converse.ChatBoxView's toolbar has been rendered
         * @event _converse#renderToolbar
         * @type { _converse.ChatBoxView }
         * @example _converse.api.listen.on('renderToolbar', this => { ... });
         */
        api.trigger('renderToolbar', this);
    }

    getButtons () {
        const buttons = [];

        if (this.show_emoji_button) {
            const chatview = _converse.chatboxviews.get(this.model.get('jid'));
            buttons.push(html`<converse-emoji-dropdown .chatview=${chatview}></converse-emoji-dropdown>`);
        }

        if (this.show_call_button) {
            const color = this.is_groupchat ? '--muc-toolbar-btn-color' : '--chat-toolbar-btn-color';
            const i18n_start_call = __('Start a call');
            buttons.push(html`
                <button class="toggle-call" @click=${this.toggleCall} title="${i18n_start_call}">
                    <converse-icon color="var(${color})" class="fa fa-phone" size="1em"></converse-icon>
                </button>`
            );
        }

        const message_limit = api.settings.get('message_limit');
        if (message_limit) {
            buttons.push(html`
                <converse-message-limit-indicator .model=${this.model} class="right">
                </converse-message-limit-indicator>`
            );
        }

        if (this.show_spoiler_button) {
            buttons.push(this.getSpoilerButton());
        }

        const http_upload_promise = api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain);
        buttons.push(html`${until(http_upload_promise.then(is_supported => this.getHTTPUploadButton(is_supported)),'')}`);

        if (this.is_groupchat && api.settings.get('visible_toolbar_buttons')?.toggle_occupants) {
            const i18n_hide_occupants = __('Hide participants');
            const i18n_show_occupants = __('Show participants');
            buttons.push(html`
                <button class="toggle_occupants right"
                        title="${this.hidden_occupants ? i18n_show_occupants : i18n_hide_occupants}"
                        @click=${this.toggleOccupants}>
                    <converse-icon
                        color="var(--muc-toolbar-btn-color)"
                        class="fa ${this.hidden_occupants ? `fa-angle-double-left` : `fa-angle-double-right`}"
                        size="1em"></converse-icon>
                </button>`
            );
        }

        /**
         * *Hook* which allows plugins to add more buttons to a chat's toolbar
         * @event _converse#getToolbarButtons
         * @example
         *  api.listen.on('getToolbarButtons', (toolbar_el, buttons) {
         *      buttons.push(html`
         *          <button @click=${() => alert('Foo!')}>Foo</button>`
         *      );
         *      return buttons;
         *  }
         */
        return _converse.api.hook('getToolbarButtons', this, buttons);
    }

    getHTTPUploadButton (is_supported) {
        if (is_supported) {
            const i18n_choose_file =  __('Choose a file to send')
            const color = this.is_groupchat ? '--muc-toolbar-btn-color' : '--chat-toolbar-btn-color';
            return html`
                <button title="${i18n_choose_file}" @click=${this.toggleFileUpload}>
                    <converse-icon
                        color="var(${color})"
                        class="fa fa-paperclip"
                        size="1em"></converse-icon>
                </button>
                <input type="file" @change=${this.onFileSelection} class="fileupload" multiple="" style="display:none"/>`;
        } else {
            return '';
        }
    }

    getSpoilerButton () {
        const model = this.model;
        if (!this.is_groupchat && !model.presence?.resources.length) {
            return;
        }

        let i18n_toggle_spoiler;
        if (this.composing_spoiler) {
            i18n_toggle_spoiler = __("Click to write as a normal (non-spoiler) message");
        } else {
            i18n_toggle_spoiler = __("Click to write your message as a spoiler");
        }
        const color = this.is_groupchat ? '--muc-toolbar-btn-color' : '--chat-toolbar-btn-color';
        const markup = html`
            <button class="toggle-compose-spoiler"
                    title="${i18n_toggle_spoiler}"
                    @click=${this.toggleComposeSpoilerMessage}>
                <converse-icon
                    color="var(${color})"
                    class="fa ${this.composing_spoiler ? 'fa-eye-slash' : 'fa-eye'}"
                    size="1em"></converse-icon>
            </button>`;

        if (this.is_groupchat) {
            return markup;
        } else {
            const contact_jid = model.get('jid');
            const spoilers_promise = Promise.all(
                model.presence.resources.map(
                    r => api.disco.supports(Strophe.NS.SPOILER, `${contact_jid}/${r.get('name')}`)
                )).then(results => results.reduce((acc, val) => (acc && val), true));
            return html`${until(spoilers_promise.then(() => markup), '')}`;
        }
    }

    toggleFileUpload (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.querySelector('.fileupload').click();
    }

    onFileSelection (evt) {
        this.model.sendFiles(evt.target.files);
    }

    toggleComposeSpoilerMessage (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.model.set('composing_spoiler', !this.model.get('composing_spoiler'));
    }

    toggleOccupants (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.model.save({'hidden_occupants': !this.model.get('hidden_occupants')});
    }

    toggleCall (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        /**
         * When a call button (i.e. with class .toggle-call) on a chatbox has been clicked.
         * @event _converse#callButtonClicked
         * @type { object }
         * @property { Strophe.Connection } _converse.connection - The XMPP Connection object
         * @property { _converse.ChatBox | _converse.ChatRoom } _converse.connection - The XMPP Connection object
         * @example _converse.api.listen.on('callButtonClicked', (connection, model) => { ... });
         */
        api.trigger('callButtonClicked', {
            connection: _converse.connection,
            model: this.model
        });
    }
}

window.customElements.define('converse-chat-toolbar', ChatToolbar);
