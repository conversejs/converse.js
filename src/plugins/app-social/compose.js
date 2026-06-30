/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, PubSubFeed } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import './scan.js';
import tplCompose from './templates/compose.js';

/**
 * A minimal compose box for publishing a microblog post to the user's own feed.
 * Reuses the chat textarea's Enter-to-send convention.
 */
export default class SocialCompose extends CustomElement {
    static get properties() {
        return {
            model: { type: PubSubFeed },
        };
    }

    render() {
        return tplCompose(this);
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev) {
        if (ev.key === 'Enter' && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
            ev.preventDefault();
            this.onSubmit(ev);
        }
    }

    /**
     * @param {Event} [ev]
     */
    async onSubmit(ev) {
        ev?.preventDefault?.();
        const textarea = /** @type {HTMLTextAreaElement} */ (this.querySelector('.social-compose__textarea'));
        const text = textarea.value.trim();
        if (!text) return;

        textarea.setAttribute('disabled', 'disabled');
        try {
            await this.model.publishPost(text);
            textarea.value = '';
        } finally {
            textarea.removeAttribute('disabled');
            textarea.focus();
        }
    }
}

api.elements.define('converse-social-compose', SocialCompose);
