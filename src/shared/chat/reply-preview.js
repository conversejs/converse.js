/**
 * @copyright 2025, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description A custom element to display a reply preview banner
 */
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { html, nothing } from 'lit';
import { __ } from 'i18n';
import tplComposerPanel from './templates/composer-panel.js';

import './styles/reply-preview.scss';

/**
 * A custom element that displays a preview of the message being replied to.
 */
export default class ReplyPreview extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
        };
    }

    constructor() {
        super();
        this.model = null;
    }

    initialize() {
        this.listenTo(this.model, 'change:reply_to_id', () => this.requestUpdate());
    }

    /**
     * Get the message being replied to, if any.
     * According to XEP-0461, for groupchat messages the stanza_id is used,
     * for other messages we check origin_id first, then msgid.
     * @returns {import('@converse/headless/types/shared/message').default|undefined}
     */
    getReplyToMessage() {
        const reply_to_id = this.model.get('reply_to_id');
        if (!reply_to_id) return undefined;

        const is_groupchat = this.model.get('message_type') === 'groupchat';
        if (is_groupchat) {
            const attr = `stanza_id ${this.model.get('jid')}`;
            return this.model.messages.models.find((m) => m.get(attr) === reply_to_id);
        } else {
            return this.model.messages.models.find(
                (m) => m.get('origin_id') === reply_to_id || m.get('msgid') === reply_to_id,
            );
        }
    }

    /**
     * Cancel the reply
     */
    cancelReply() {
        this.model.save({ reply_to_id: undefined, reply_to: undefined });
    }

    render() {
        const reply_message = this.getReplyToMessage();
        if (!reply_message) return nothing;

        const sender = reply_message.getDisplayName();
        const body = reply_message.getMessageText();
        const truncated_body = body.length > 100 ? body.slice(0, 100) + '...' : body;

        return tplComposerPanel({
            kind: 'context',
            content: html`
                <div class="reply-preview__content">
                    <span class="reply-preview__sender">${__('Replying to %1$s', sender)}</span>
                    <span class="reply-preview__text">${truncated_body}</span>
                </div>
            `,
            close: { label: __('Cancel reply'), handler: () => this.cancelReply() },
        });
    }
}

api.elements.define('converse-reply-preview', ReplyPreview);
