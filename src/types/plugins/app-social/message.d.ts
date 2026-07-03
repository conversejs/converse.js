/**
 * Renders a single microblog post. The `SignalWatcher`-driven feed list passes
 * each post down; this component re-renders when a post's display-affecting
 * attributes (its Atom text constructs, author name, avatar) change.
 */
export default class SocialMessage extends CustomElement {
    static get properties(): {
        model: {
            type: typeof PubSubMessage;
        };
        _reposting: {
            type: BooleanConstructor;
            state: boolean;
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
     * Repost (repeat) this post into our own feed (XEP-0277 § Repeating a Post).
     * The button is disabled while the repost is in flight, so a double-click
     * can't publish a duplicate item.
     */
    onRepost(): Promise<void>;
    _reposting: boolean;
}
import { CustomElement } from 'shared/components/element.js';
import { PubSubMessage } from '@converse/headless';
//# sourceMappingURL=message.d.ts.map