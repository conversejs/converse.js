/**
 * A custom element that displays the context of the message being replied to.
 */
export default class ReplyContext extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        model_with_messages: {
            type: ObjectConstructor;
        };
    };
    model: any;
    model_with_messages: any;
    /**
     * Get the message being replied to, if this message is a reply.
     * @returns {import('@converse/headless/types/shared/message').default|undefined}
     */
    getRepliedMessage(): import("@converse/headless/types/shared/message").default | undefined;
    /**
     * Scroll to and highlight the replied message
     * @param {MouseEvent} ev
     */
    scrollToRepliedMessage(ev: MouseEvent): void;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
import { CustomElement } from 'shared/components/element.js';
import { nothing } from 'lit';
//# sourceMappingURL=reply-context.d.ts.map