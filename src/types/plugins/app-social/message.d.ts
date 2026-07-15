/**
 * Renders a single microblog post. The `SignalWatcher`-driven feed list passes
 * each post down; this component re-renders when a post's display-affecting
 * attributes (its Atom text constructs, author name, avatar) change.
 */
export default class SocialMessage extends ObservableElement {
    static get properties(): {
        model: {
            type: typeof PubSubMessage;
        };
        compact: {
            type: BooleanConstructor;
        };
        hidesource: {
            type: BooleanConstructor;
        };
        _reposting: {
            type: BooleanConstructor;
            state: boolean;
        };
        _liking: {
            type: BooleanConstructor;
            state: boolean;
        };
        observable: {
            type: StringConstructor;
        };
        intersectionRatio: {
            type: NumberConstructor;
        };
    };
    compact: boolean;
    hidesource: boolean;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * Open the author's profile view when their avatar or name is clicked.
     * Bubbles a `profileselected` event up to the Social app, which swaps the
     * timeline for the profile view.
     * @param {MouseEvent} [ev]
     */
    showProfile(ev?: MouseEvent): void;
    /**
     * Open the community/topic feed this post arrived through (its pubsub node's
     * read-only profile), distinct from the author's own profile. Only relevant
     * when {@link PubSubMessage#getSourceFeed} is non-null (a news/topic node, not
     * a personal microblog).
     * @param {MouseEvent} [ev]
     */
    showSourceFeed(ev?: MouseEvent): void;
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
     * Open this post's detail view (its comment thread). Bubbles a
     * `postselected` event up to the Social app, which swaps the timeline for
     * the detail view.
     */
    onComments(): void;
    /**
     * Repost (repeat) this post into our own feed (XEP-0277 § Repeating a Post).
     * The button is disabled while the repost is in flight, so a double-click
     * can't publish a duplicate item.
     */
    onRepost(): Promise<void>;
    _reposting: boolean;
    onToggleLike(): Promise<void>;
    _liking: boolean;
}
import { ObservableElement } from 'shared/components/observable.js';
import { PubSubMessage } from '@converse/headless';
//# sourceMappingURL=message.d.ts.map