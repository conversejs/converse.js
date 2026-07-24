declare const SocialPost_base: typeof CustomElement & (new (...args: any[]) => import("@lit-labs/signals").SignalWatcherApi);
/**
 * A post's detail view. It shows one focused item and its direct replies, plus a
 * compact ancestor chain above. Tapping a reply focuses it (its reply count is
 * the affordance), so each level is one view. The focused item is the post itself
 * when `focused` is null, else a comment within the thread.
 *
 * `SignalWatcher` auto-tracks the `collectionSignal` over the comment feed's
 * messages, so the tree re-renders when a comment is fetched, posted, or pushed
 * live. The reply tree is rebuilt from the flat collection each render (cheap: a
 * thread is bounded), so an arriving reply re-parents without extra bookkeeping.
 */
export default class SocialPost extends SocialPost_base {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        focused: {
            type: ObjectConstructor;
        };
        _submitting: {
            type: BooleanConstructor;
            state: boolean;
        };
    };
    /** @type {import('@converse/headless').PubSubMessage} */
    model: import("@converse/headless").PubSubMessage;
    /** @type {import('@converse/headless').PubSubMessage} */
    focused: import("@converse/headless").PubSubMessage;
    /** @type {import('@converse/headless').PubSubFeed} */
    feed: import("@converse/headless").PubSubFeed;
    comments: import("signal-polyfill").Signal.State<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[]>;
    childFeed: any;
    childComments: import("signal-polyfill").Signal.State<import("@converse/skeletor").Model<import("@converse/skeletor").ModelAttributes>[]>;
    _submitting: boolean;
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1> | "";
    /**
     * @param {Map<string, unknown>} changed
     */
    updated(changed: Map<string, unknown>): void;
    /**
     * Resolve the focused item's replies source. In the flat model this is null
     * (its replies are in the post's own thread, filtered by the tree). For a
     * Libervia comment that advertises its own replies node, this fetches and
     * tracks that child feed so its top-level items render as the replies.
     */
    resolveChildFeed(): Promise<void>;
    /**
     * The item currently focused: the comment being viewed, or the post.
     * @returns {import('@converse/headless').PubSubMessage}
     */
    get focusItem(): import("@converse/headless").PubSubMessage;
    /**
     * Compute the drill-down view from the live thread signal in one pass: the
     * focused item's direct replies (oldest-first) and its ancestor chain
     * (root-first). Reading the signal here keeps it auto-tracked by SignalWatcher.
     * @returns {{ replies: import('@converse/headless').PubSubMessage[], ancestors: import('@converse/headless').PubSubMessage[], likeCount: number }}
     */
    getView(): {
        replies: import("@converse/headless").PubSubMessage[];
        ancestors: import("@converse/headless").PubSubMessage[];
        likeCount: number;
    };
    /** Return to the timeline (or the view beneath the thread). */
    goBack(): void;
    /**
     * Back within the thread: focus the focused item's parent, or leave the thread
     * when already at a root (the post is focused).
     */
    onBack(): void;
    /**
     * Drill into a reply, focusing it so its own replies show.
     * @param {import('@converse/headless').PubSubMessage} comment
     */
    onDrillIn(comment: import("@converse/headless").PubSubMessage): void;
    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev: KeyboardEvent): void;
    /**
     * Publish the composer's text as a reply to the focused item: a direct comment
     * on the post when it's focused, else a threaded reply to the focused comment.
     * @param {Event} [ev]
     */
    onSubmit(ev?: Event): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
export {};
//# sourceMappingURL=post.d.ts.map