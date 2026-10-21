/**
 * @module screen-reader-announcer
 * @description Component for announcing messages to screen readers
 */

import { html } from 'lit';
import { CustomElement } from './element.js';
import { api } from '@converse/headless';

/**
 * Component that provides an ARIA live region for announcements
 */
export default class ScreenReaderAnnouncer extends CustomElement {
    static get properties() {
        return {
            message: { type: String, state: true },
            priority: { type: String, state: true },
        };
    }

    constructor() {
        super();
        this.message = '';
        this.priority = 'polite';
        this._clearTimer = null;
    }

    render() {
        return html`
            <div
                role="log"
                aria-live="${this.priority}"
                aria-atomic="true"
                aria-relevant="additions text"
                class="sr-only"
                style="position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;"
            >
                ${this.message}
            </div>
        `;
    }

    /**
     * Announces a message
     * @param {string} text - Text to announce
     * @param {('polite'|'assertive')} [priority='polite'] - Announcement priority
     */
    announce(text, priority = 'polite') {
        // Clear any previous timer
        if (this._clearTimer) {
            clearTimeout(this._clearTimer);
        }

        // Clear the message first so that the change is detected
        this.message = '';
        this.priority = priority;

        // After a brief delay, set the new message
        requestAnimationFrame(() => {
            this.message = text;

            // Clear after 5 seconds
            this._clearTimer = setTimeout(() => {
                this.message = '';
            }, 5000);
        });
    }

    disconnectedCallback() {
        if (this._clearTimer) {
            clearTimeout(this._clearTimer);
        }
        super.disconnectedCallback();
    }
}

api.elements.define('converse-screen-reader-announcer', ScreenReaderAnnouncer);
