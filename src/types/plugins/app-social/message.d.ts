/**
 * Renders a single microblog post.
 *
 * Uses `attrSignal` so an edit to the post's body re-renders just this
 * component (the `SignalWatcher`-driven feed list passes each post down).
 */
export default class SocialMessage extends CustomElement {
    static get properties(): {
        model: {
            type: typeof PubSubMessage;
        };
    };
    render(): import("lit-html").TemplateResult<1>;
    /**
     * Delete one of our own posts, after confirmation. Retracts the item from
     * the node and removes the local copy.
     */
    onRetract(): Promise<void>;
    /**
     * Expose the post's body as a signal for fine-grained binding in the
     * template (part of the signals reference adoption).
     * @returns {import('@lit-labs/signals').Signal.State<string>}
     */
    get bodySignal(): import("@lit-labs/signals").Signal.State<string>;
}
import { CustomElement } from 'shared/components/element.js';
import { PubSubMessage } from '@converse/headless';
//# sourceMappingURL=message.d.ts.map