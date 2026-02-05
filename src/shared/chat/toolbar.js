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
            show_location_button: { type: Boolean },
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
        this.show_location_button = false;
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

        if (this.show_spoiler_button) {
            buttons.push(this.getSpoilerButton());
        }

        if (this.show_location_button) {
            buttons.push(this.getLocationButton());
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

    getLocationButton () {
        const color = this.is_groupchat ? '--muc-color' : '--chat-color';
        const i18n_send_location = __("Insert current location");
        return html`
            <button type="button"
                    class="btn toggle-location"
                    title="${i18n_send_location}"
                    @click=${this.insertLocation}>
                <converse-icon
                    color="var(${color})"
                    class="fa fa-globe"
                    size="1em"></converse-icon>
            </button>`;
    }

    /** @param {MouseEvent} ev */
    async insertLocation (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();

        if (!navigator.geolocation) {
            alert(__("Geolocation is not supported by your browser"));
            return;
        }

        const i18n_getting_location = __("Getting location...");
        const button = /** @type {HTMLButtonElement} */ (ev?.currentTarget);
        if (button) {
            button.disabled = true;
            button.title = i18n_getting_location;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const geoUri = `geo:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
                
                // Insert into textarea instead of sending directly
                const textarea = /** @type {HTMLTextAreaElement} */ (
                    this.querySelector('textarea.chat-textarea') ||
                    this.closest('converse-message-form')?.querySelector('textarea.chat-textarea')
                );
                if (textarea) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    textarea.value = text.substring(0, start) + geoUri + text.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + geoUri.length;
                    textarea.focus();
                    // Trigger input event so the model updates
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                if (button) {
                    button.disabled = false;
                    button.title = __("Insert current location");
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                let message;
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = __("Location permission denied");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = __("Location unavailable");
                        break;
                    case error.TIMEOUT:
                        message = __("Location request timed out");
                        break;
                    default:
                        message = __("Could not get location");
                }
                alert(message);
                if (button) {
                    button.disabled = false;
                    button.title = __("Insert current location");
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
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
