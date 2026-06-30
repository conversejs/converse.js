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
     * Show the author's details (or our own profile for own posts) when their
     * avatar is clicked. Uses the contact resolved on the post model.
     * @param {MouseEvent} ev
     */
    showUserModal(ev: MouseEvent): void;
    /**
     * Open an inline post image in the lightbox modal when clicked.
     * @param {MouseEvent} ev
     */
    onImgClick(ev: MouseEvent): void;
    /**
     * Notify the feed that an inline image finished loading, so it can keep the
     * scroll position stable as posts grow taller.
     */
    onImgLoad(): void;
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