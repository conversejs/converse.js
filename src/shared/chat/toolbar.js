import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { _converse, api, converse } from '@converse/headless';
import './attachment-menu.js';
import './emoji-picker.js';
import 'shared/chat/message-limit.js';
import tplToolbar from './templates/toolbar.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';

import './styles/toolbar.scss';

const Strophe = converse.env.Strophe;

export class ChatToolbar extends CustomElement {
    static get properties() {
        return {
            hidden_occupants: { type: Boolean },
            is_groupchat: { type: Boolean },
            message_limit: { type: Number },
            model: { type: Object },
            show_emoji_button: { type: Boolean },
            show_send_button: { type: Boolean },
            show_spoiler_button: { type: Boolean },
        };
    }

    constructor() {
        super();
        this.model = null;
        this.is_groupchat = null;
        this.hidden_occupants = false;
        this.show_send_button = false;
        this.show_spoiler_button = false;
        this.show_emoji_button = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.listenTo(this.model, 'change:composing_spoiler', () => this.requestUpdate());
    }

    render() {
        return tplToolbar(this);
    }

    firstUpdated() {
        /**
         * Triggered once the toolbar has been rendered
         * @event _converse#renderToolbar
         * @type { ChatToolbar }
         * @example _converse.api.listen.on('renderToolbar', this => { ... });
         */
        api.trigger('renderToolbar', this);
    }

    getButtons() {
        const buttons = [];

        if (this.show_emoji_button) {
            buttons.push(html`<converse-emoji-dropdown .model=${this.model}></converse-emoji-dropdown>`);
        }

        if (this.show_spoiler_button) {
            buttons.push(this.getSpoilerButton());
        }

        // The paperclip, which draws itself only once there is something to attach.
        buttons.push(html`<converse-attachment-menu .model=${this.model}></converse-attachment-menu>`);

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

    getSpoilerButton() {
        const model = this.model;
        if (!this.is_groupchat && !model.presence?.resources.length) {
            return;
        }

        let i18n_toggle_spoiler;
        if (model.get('composing_spoiler')) {
            i18n_toggle_spoiler = __('Click to write as a normal (non-spoiler) message');
        } else {
            i18n_toggle_spoiler = __('Click to write your message as a spoiler');
        }
        const color = this.is_groupchat ? '--muc-color' : '--chat-color';
        const markup = html` <button
            type="button"
            class="btn toggle-compose-spoiler"
            title="${i18n_toggle_spoiler}"
            @click=${this.toggleComposeSpoilerMessage}
        >
            <converse-icon
                color="var(${color})"
                class="fa ${model.get('composing_spoiler') ? 'fa-eye-slash' : 'fa-eye'}"
                size="1em"
            ></converse-icon>
        </button>`;

        if (this.is_groupchat) {
            return markup;
        } else {
            const contact_jid = model.get('jid');
            const spoilers_promise = Promise.all(
                model.presence.resources.map((r) =>
                    api.disco.supports(Strophe.NS.SPOILER, `${contact_jid}/${r.get('name')}`),
                ),
            ).then((results) => results.reduce(/** @param {boolean} acc */ (acc, val) => acc && val, true));
            return html`${until(
                spoilers_promise.then(() => markup),
                '',
            )}`;
        }
    }

    /** @param {MouseEvent} ev */
    toggleComposeSpoilerMessage(ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.model.set('composing_spoiler', !this.model.get('composing_spoiler'));
    }
}

api.elements.define('converse-chat-toolbar', ChatToolbar);
