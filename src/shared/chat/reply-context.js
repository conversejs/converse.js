/**
 * @copyright 2025, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description A custom element to display reply context for a message
 */
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { html, nothing } from 'lit';
import { __ } from 'i18n';

/**
 * A custom element that displays the context of the message being replied to.
 */
export default class ReplyContext extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
            model_with_messages: { type: Object },
        };
    }

    constructor() {
        super();
        this.model = null;
        this.model_with_messages = null;
    }

    /**
     * Get the message being replied to, if this message is a reply.
     * According to XEP-0461, for groupchat messages the stanza_id is used,
     * for other messages we check origin_id first, then msgid.
     * @returns {import('@converse/headless/shared/message.js').default|undefined}
     */
    getRepliedMessage() {
        const reply_to_id = this.model.get('reply_to_id');
        if (!reply_to_id) return undefined;

        const message_type = this.model.get('type');
        if (message_type === 'groupchat') {
            // For groupchat, the reply_to_id is a stanza_id
            // We need to find a message where the stanza_id matches
            const muc_jid = this.model_with_messages?.get('jid');
            if (muc_jid) {
                return this.model_with_messages.messages.models.find(
                    (m) => m.get(`stanza_id ${muc_jid}`) === reply_to_id
                );
            }
        }
        // For non-groupchat, check origin_id first, then msgid (per XEP-0359)
        return this.model_with_messages.messages.models.find(
            (m) => m.get('origin_id') === reply_to_id || m.get('msgid') === reply_to_id
        );
    }

    /**
     * Scroll to and highlight the replied message
     * @param {MouseEvent} ev
     */
    scrollToRepliedMessage(ev) {
        ev?.preventDefault();
        const replied_message = this.getRepliedMessage();
        if (!replied_message) return;

        const msgid = replied_message.get('msgid');
        const el = this.closest('.chatbox')?.querySelector(`[data-msgid="${msgid}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add highlight effect
            el.classList.add('chat-msg--highlighted');
            setTimeout(() => el.classList.remove('chat-msg--highlighted'), 2000);
        }
    }

    render() {
        // Don't render if message is retracted
        if (this.model.isRetracted()) {
            return nothing;
        }

        const reply_to_id = this.model.get('reply_to_id');
        if (!reply_to_id) return nothing;

        const replied_message = this.getRepliedMessage();
        if (!replied_message) {
            // If the replied message is not found, show a generic reference
            return html`
                <div class="chat-msg__reply-context chat-msg__reply-context--unavailable" @click=${(ev) => this.scrollToRepliedMessage(ev)}>
                    <converse-icon class="fa fa-reply" size="0.9em"></converse-icon>
                    <span class="chat-msg__reply-text">${__('Replying to a message')}</span>
                </div>
            `;
        }

        const sender = replied_message.getDisplayName();
        const body = replied_message.getMessageText();
        const truncated_body = body && body.length > 80 ? body.slice(0, 80) + '...' : body;

        return html`
            <div class="chat-msg__reply-context" @click=${(ev) => this.scrollToRepliedMessage(ev)}>
                <converse-icon class="fa fa-reply" size="0.9em"></converse-icon>
                <span class="chat-msg__reply-sender">${sender}</span>
                <span class="chat-msg__reply-text">${truncated_body || __('(empty message)')}</span>
            </div>
        `;
    }
}

api.elements.define('converse-reply-context', ReplyContext);
