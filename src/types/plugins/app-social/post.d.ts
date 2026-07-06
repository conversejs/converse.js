declare const SocialPost_base: typeof CustomElement & (new (...args: any[]) => import("@lit-labs/signals").SignalWatcherApi);
/**
 * A post's detail view: the post itself plus its comment thread (XEP-0277 §
 * Comments) and a box to add a comment. Opened from a post's "Comments" button
 * in the timeline; the back button returns to the timeline.
 *
 * `SignalWatcher` auto-tracks the `collectionSignal` over the comment feed's
 * messages, so the thread re-renders when a comment is fetched, posted, or
 * pushed live.
 */
export default class SocialPost extends SocialPost_base {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        _submitting: {
            type: BooleanConstructor;
            state: boolean;
        };
    };
    /** @type {import('@converse/headless').PubSubMessage} */
    model: import("@converse/headless").PubSubMessage;
    /** @type {import('@converse/headless').PubSubFeed} */
    feed: import("@converse/headless").PubSubFeed;
    comments: import("@lit-labs/signals").Signal.State<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[]>;
    _submitting: boolean;
    initialize(): Promise<void>;
    /**
     * The thread's comments, oldest-first (chronological, like a chat). The
     * underlying collection is newest-first, so reverse a snapshot. Reading the
     * signal here keeps it auto-tracked by `SignalWatcher`.
     * @returns {import('@converse/headless').PubSubMessage[]}
     */
    get threadComments(): import("@converse/headless").PubSubMessage[];
    render(): import("lit-html").TemplateResult<1> | "";
    /** Return to the timeline. */
    goBack(): void;
    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev: KeyboardEvent): void;
    /**
     * @param {Event} [ev]
     */
    onSubmit(ev?: Event): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
export {};
//# sourceMappingURL=post.d.ts.map