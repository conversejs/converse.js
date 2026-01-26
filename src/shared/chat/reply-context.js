import { html, nothing } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';

/**
 * Component that displays reply context on messages,
 * showing which message is being replied to.
 */
class ReplyContext extends CustomElement {
    static get properties () {
        return {
            message: { type: Object }
        };
    }

    constructor () {
        super();
        this.message = null;
    }

    render () {
        if (!this.message) {
            return nothing;
        }
        const reply_to_id = this.message.get('reply_to_id');
        if (!reply_to_id) {
            return nothing;
        }

        const replied_message = this.getRepliedMessage();
        if (!replied_message) {
            return this.renderFallback();
        }

        const display_name = replied_message.getDisplayName?.() || replied_message.get('nick') || replied_message.get('from');
        const message_text = replied_message.getMessageText?.() || replied_message.get('body') || '';

        return html`
            <div 
                class="reply-context" 
                @click=${this.scrollToMessage}
                role="button"
                tabindex="0"
                @keydown=${this.handleKeyDown}
                title="${__('Click to see original message')}"
                aria-label="${__('Reply to message from %1$s', display_name)}">
                <converse-icon class="fa fa-reply" size="0.75em"></converse-icon>
                <span class="reply-context__author">${display_name}</span>
                <p class="reply-context__message">${message_text}</p>
            </div>
        `;
    }

    renderFallback () {
        return html`
            <div class="reply-context reply-context--not-found">
                <converse-icon class="fa fa-reply" size="0.75em"></converse-icon>
                <span class="reply-context__message">${__('Original message not found')}</span>
            </div>
        `;
    }

    getRepliedMessage () {
        const reply_to_id = this.message.get('reply_to_id');
        if (!reply_to_id || !this.message.collection) {
            return null;
        }

        // Try to find by the reply_to_id in the collection
        return this.message.collection.get(reply_to_id) || 
               this.message.collection.findWhere({ 'msgid': reply_to_id }) ||
               this.message.collection.findWhere({ 'origin_id': reply_to_id });
    }

    handleKeyDown (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            this.scrollToMessage();
        }
    }

    scrollToMessage () {
        const msg = this.getRepliedMessage();
        if (!msg) {
            return;
        }

        const msgid = msg.get('msgid');
        const el = document.querySelector(`[data-msgid="${msgid}"]`);
        
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlighted');
            setTimeout(() => el.classList.remove('highlighted'), 2000);
        }
    }
}

api.elements.define('converse-reply-context', ReplyContext);

export default ReplyContext;
