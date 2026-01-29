/**
 * A custom element that displays a preview of the message being replied to.
 */
export default class ReplyPreview extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    initialize(): void;
    /**
     * Get the message being replied to, if any.
     * According to XEP-0461, for groupchat messages the stanza_id is used,
     * for other messages we check origin_id first, then msgid.
     * @returns {import('@converse/headless/shared/message.js').default|undefined}
     */
    getReplyToMessage(): import("@converse/headless/shared/message.js").default | undefined;
    /**
     * Cancel the reply
     */
    cancelReply(): void;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
import { CustomElement } from 'shared/components/element.js';
import { nothing } from 'lit';
//# sourceMappingURL=reply-preview.d.ts.map