import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import './styles/reply-preview.scss';

/**
 * Component that displays a preview of the message being replied to,
 * shown above the message input area.
 */
class ReplyPreview extends CustomElement {
    static get properties () {
        return {
            model: { type: Object }
        };
    }

    constructor () {
        super();
        this.model = null;
    }

    initialize () {
        this.listenTo(this.model, 'change:replying_to', () => this.requestUpdate());
    }

    render () {
        const replying_to = this.model.get('replying_to');
        if (!replying_to) {
            return '';
        }

        const display_name = replying_to.getDisplayName?.() || replying_to.get('nick') || replying_to.get('from');
        const message_text = replying_to.getMessageText?.() || replying_to.get('body') || '';

        return html`
            <div class="reply-preview">
                <div class="reply-preview__content">
                    <converse-icon class="fa fa-reply" size="0.875em"></converse-icon>
                    <div class="reply-preview__text">
                        <strong class="reply-preview__author">${__('Replying to')} ${display_name}</strong>
                        <p class="reply-preview__message">${message_text}</p>
                    </div>
                </div>
                <button 
                    type="button"
                    class="reply-preview__cancel" 
                    @click=${this.cancelReply}
                    title="${__('Cancel reply')}"
                    aria-label="${__('Cancel reply')}">
                    <converse-icon class="fa fa-times" size="1em"></converse-icon>
                </button>
            </div>
        `;
    }

    cancelReply (ev) {
        ev?.preventDefault?.();
        this.model.save({
            'replying_to': undefined,
            'reply_to_id': undefined
        });
    }
}

api.elements.define('converse-reply-preview', ReplyPreview);

export default ReplyPreview;
