import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { _converse, api, converse } from '@converse/headless';
import './emoji-picker.js';
import 'shared/chat/message-limit.js';
import tplToolbar from './templates/toolbar.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';

import './styles/toolbar.scss';

const Strophe = converse.env.Strophe


export class ChatToolbar extends CustomElement {

    static get properties () {
        return {
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

    constructor () {
        super();
        this.model = null;
        this.is_groupchat = null;
        this.hidden_occupants = false;
        this.show_send_button = false;
        this.show_spoiler_button = false;
        this.show_call_button = false;
        this.show_emoji_button = false;
    }

    connectedCallback () {
        super.connectedCallback();
        this.listenTo(this.model, 'change:composing_spoiler', () => this.requestUpdate());
    }

    render () {
        return tplToolbar(this);
    }

    firstUpdated () {
        /**
         * Triggered once the toolbar has been rendered
         * @event _converse#renderToolbar
         * @type { ChatToolbar }
         * @example _converse.api.listen.on('renderToolbar', this => { ... });
         */
        api.trigger('renderToolbar', this);
    }

    getButtons () {
        const buttons = [];

        if (this.show_emoji_button) {
            buttons.push(
                html`<converse-emoji-dropdown .model=${this.model}></converse-emoji-dropdown>`
            );
        }

        if (this.show_call_button) {
            const color = this.is_groupchat ? '--muc-color' : '--chat-color';
            const i18n_start_call = __('Start a call');
            buttons.push(html`
                <button type="button"
                        class="btn toggle-call"
                        @click=${this.toggleCall}
                        title="${i18n_start_call}">
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

        const domain = _converse.session.get('domain');
        const http_upload_promise = api.disco.supports(Strophe.NS.HTTPUPLOAD, domain);
        buttons.push(html`${until(http_upload_promise.then(is_supported => this.getHTTPUploadButton(!!is_supported)),'')}`);

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

    /**
     * @param {boolean} is_supported
     */
    getHTTPUploadButton (is_supported) {
        if (is_supported) {
            const i18n_choose_file =  __('Choose a file to send')
            return html`
                <button type="button"
                        class="btn"
                        title="${i18n_choose_file}"
                        @click=${this.toggleFileUpload}>
                    <converse-icon
                        class="fa fa-paperclip"
                        size="1em"></converse-icon>
                </button>
                <input type="file"
                    @change=${this.onFileSelection}
                    class="fileupload"
                    multiple=""
                    style="display:none"/>`;
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
        if (model.get('composing_spoiler')) {
            i18n_toggle_spoiler = __("Click to write as a normal (non-spoiler) message");
        } else {
            i18n_toggle_spoiler = __("Click to write your message as a spoiler");
        }
        const color = this.is_groupchat ? '--muc-color' : '--chat-color';
        const markup = html`
            <button type="button"
                    class="btn toggle-compose-spoiler"
                    title="${i18n_toggle_spoiler}"
                    @click=${this.toggleComposeSpoilerMessage}>
                <converse-icon
                    color="var(${color})"
                    class="fa ${model.get('composing_spoiler') ? 'fa-eye-slash' : 'fa-eye'}"
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

    /** @param {MouseEvent} ev */
    toggleFileUpload (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        /** @type {HTMLInputElement} */(this.querySelector('.fileupload')).click();
    }

    /** @param {InputEvent} ev */
    onFileSelection (ev) {
        this.model.sendFiles(/** @type {HTMLInputElement} */(ev.target).files);
    }

    /** @param {MouseEvent} ev */
    toggleComposeSpoilerMessage (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.model.set('composing_spoiler', !this.model.get('composing_spoiler'));
    }

    /** @param {MouseEvent} ev */
    toggleCall (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        /**
         * When a call button (i.e. with class .toggle-call) on a chatbox has been clicked.
         * @event _converse#callButtonClicked
         * @type { object }
         * @property { Strophe.Connection } connection - The XMPP Connection object
         * @property { _converse.ChatBox | _converse.ChatRoom } model
         * @example _converse.api.listen.on('callButtonClicked', (connection, model) => { ... });
         */
        api.trigger('callButtonClicked', {
            connection: api.connection.get(),
            model: this.model
        });
    }
}

api.elements.define('converse-chat-toolbar', ChatToolbar);
