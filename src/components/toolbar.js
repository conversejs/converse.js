import "./emoji-picker.js";
import { CustomElement } from './element.js';
import { __ } from '../i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";
import { html } from 'lit-element';
import { until } from 'lit-html/directives/until.js';

const Strophe = converse.env.Strophe


export class ChatToolbar extends CustomElement {

    static get properties () {
        return {
            chatview: { type: Object }, // Used by getToolbarButtons hooks
            composing_spoiler: { type: Boolean },
            hidden_occupants: { type: Boolean },
            is_groupchat: { type: Boolean },
            message_limit: { type: Number },
            model: { type: Object },
            show_call_button: { type: Boolean },
            show_emoji_button: { type: Boolean },
            show_occupants_toggle: { type: Boolean },
            show_send_button: { type: Boolean },
            show_spoiler_button: { type: Boolean },
            show_toolbar: { type: Boolean }
        }
    }

    render () {
        const i18n_send_message = __('Send the message');
        return html`
            ${ this.show_toolbar ? html`<span class="toolbar-buttons">${until(this.getButtons(), '')}</span>` : '' }
            ${ this.show_send_button ? html`<button type="submit" class="btn send-button fa fa-paper-plane" title="${ i18n_send_message }"></button>` : '' }
        `;
    }

    getButtons () {
        const buttons = [];

        if (this.show_emoji_button) {
            buttons.push(html`<converse-emoji-dropdown .chatview=${this.chatview}></converse-dropdown>`);
        }

        if (this.show_call_button) {
            const i18n_start_call = __('Start a call');
            buttons.push(html`
                <button class="toggle-call" @click=${this.toggleCall} title="${i18n_start_call}">
                    <converse-icon class="fa fa-phone" path-prefix="/dist" size="1em"></converse-icon>
                </button>`
            );
        }
        const i18n_chars_remaining = __('Message characters remaining');
        const message_limit = api.settings.get('message_limit');
        if (message_limit) {
            buttons.push(html`<span class="right message-limit" title="${i18n_chars_remaining}">${this.message_limit}</span>`);
        }

        if (this.show_spoiler_button) {
            buttons.push(this.getSpoilerButton());
        }

        const http_upload_promise = api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain);
        buttons.push(html`${until(http_upload_promise.then(is_supported => this.getHTTPUploadButton(is_supported)),'')}`);

        if (this.show_occupants_toggle) {
            const i18n_hide_occupants = __('Hide participants');
            const i18n_show_occupants = __('Show participants');
            buttons.push(html`
                <button class="toggle_occupants right"
                        title="${this.hidden_occupants ? i18n_show_occupants : i18n_hide_occupants}"
                        @click=${this.toggleOccupants}>
                    <converse-icon class="fa ${this.hidden_occupants ? `fa-angle-double-left` : `fa-angle-double-right`}"
                             path-prefix="${api.settings.get('assets_path')}" size="1em"></converse-icon>
                </button>`
            );
        }

        /**
         * *Hook* which allows plugins to add more buttons to a chat's toolbar
         * @event _converse#getToolbarButtons
         */
        return _converse.api.hook('getToolbarButtons', this, buttons);
    }

    getHTTPUploadButton (is_supported) {
        if (is_supported) {
            const i18n_choose_file =  __('Choose a file to send')
            return html`
                <button title="${i18n_choose_file}" @click=${this.toggleFileUpload}>
                    <converse-icon class="fa fa-paperclip"
                        path-prefix="${api.settings.get('assets_path')}"
                        size="1em"></converse-icon>
                </button>
                <input type="file" @change=${this.onFileSelection} class="fileupload" multiple="" style="display:none"/>`;
        } else {
            return '';
        }
    }

    getSpoilerButton () {
        const model = this.model;
        if (!this.is_groupchat && model.presence.resources.length === 0) {
            return;
        }

        let i18n_toggle_spoiler;
        if (this.composing_spoiler) {
            i18n_toggle_spoiler = __("Click to write as a normal (non-spoiler) message");
        } else {
            i18n_toggle_spoiler = __("Click to write your message as a spoiler");
        }
        const markup = html`
            <button class="toggle-compose-spoiler"
                    title="${i18n_toggle_spoiler}"
                    @click=${this.toggleComposeSpoilerMessage}>
                <converse-icon class="fa ${this.composing_spoiler ? 'fa-eye-slash' : 'fa-eye'}"
                         path-prefix="${api.settings.get('assets_path')}"
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
