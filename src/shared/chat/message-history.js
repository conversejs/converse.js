import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { until } from 'lit/directives/until.js';
import { api, constants } from "@converse/headless";
import { CustomElement } from 'shared/components/element.js';
import { getDayIndicator } from './utils.js';
import { announceToScreenReader } from '../../utils/accessibility.js';
import { __ } from 'i18n';
import "./message";

const { KEYCODES } = constants;


export default class MessageHistory extends CustomElement {
    /**
     * @typedef {import('@converse/headless/types/plugins/chat/message').default} Message
     */

    constructor () {
        super();
        this.model = null;
        this.messages = [];
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    static get properties () {
        return {
            model: { type: Object },
            messages: { type: Array }
        }
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('keydown', this.onKeyDown);
    }

    disconnectedCallback() {
        this.removeEventListener('keydown', this.onKeyDown);
        super.disconnectedCallback();
    }

    /**
     * Handles keyboard navigation in messages
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev) {
        // Only process if the active element is a message within this history
        const activeElement = document.activeElement;
        if (!activeElement || !activeElement.matches('.chat-msg')) {
            return;
        }

        // Verify that the active message belongs to this history
        if (!this.contains(activeElement)) {
            return;
        }

        const messages = /** @type {HTMLElement[]} */ (Array.from(this.querySelectorAll('.chat-msg')));
        const currentIndex = messages.indexOf(/** @type {HTMLElement} */ (activeElement));

        if (currentIndex === -1) {
            return;
        }

        let newIndex = -1;

        switch (ev.key) {
            case KEYCODES.UP_ARROW:
            case KEYCODES.LEFT_ARROW:
                ev.preventDefault();
                newIndex = currentIndex > 0 ? currentIndex - 1 : messages.length - 1;
                break;
            
            case KEYCODES.DOWN_ARROW:
            case KEYCODES.RIGHT_ARROW:
                ev.preventDefault();
                newIndex = currentIndex < messages.length - 1 ? currentIndex + 1 : 0;
                break;
            
            case 'Home':
                ev.preventDefault();
                newIndex = 0;
                break;
            
            case 'End':
                ev.preventDefault();
                newIndex = messages.length - 1;
                break;
            
            default:
                return;
        }

        if (newIndex !== -1 && newIndex !== currentIndex) {
            this.focusMessage(messages[newIndex]);
        }
    }

    /**
     * Enfoca un mensaje y lo anuncia al lector de pantalla
     * @param {HTMLElement} messageElement
     */
    focusMessage(messageElement) {
        if (!messageElement) return;

        // Focus the message
        messageElement.focus();

        // Scroll if necessary
        messageElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest',
            inline: 'nearest'
        });

        // Announce the message to the screen reader
        const ariaLabel = messageElement.getAttribute('aria-label');
        if (ariaLabel) {
            announceToScreenReader(ariaLabel, 'polite', 300);
        }
    }

    render () {
        const msgs = this.messages;
        if (msgs.length) {
            return repeat(msgs, m => m.get('id'), m => html`${this.renderMessage(m)}`)
        } else {
            return '';
        }
    }

    /**
     * @param {(Message)} model
     */
    renderMessage (model) {
        if (model.get('dangling_retraction') || model.get('dangling_moderation') ||  model.get('is_only_key')) {
            return '';
        }
        const template_hook = model.get('template_hook')
        if (typeof template_hook === 'string') {
            const template_promise = api.hook(template_hook, model, '');
            return until(template_promise, '');
        } else {
            const template = html`<converse-chat-message
                .model_with_messages=${this.model}
                .model=${model}></converse-chat-message>`
            const day = getDayIndicator(model);
            return day ? [day, template] : template;
        }
    }
}

api.elements.define('converse-message-history', MessageHistory);
