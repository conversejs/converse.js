/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, log, buildCommentTree, computeThreadCounts, getAncestors } from '@converse/headless';
import { SignalWatcher } from '@lit-labs/signals';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import { collectionSignal } from 'shared/signals.js';
import tplPost from './templates/post.js';

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
export default class SocialPost extends SignalWatcher(CustomElement) {
    static get properties() {
        return {
            model: { type: Object },
            focused: { type: Object }, // The focused comment, or null to focus the post.
            _submitting: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        /** @type {import('@converse/headless').PubSubMessage} */
        this.model = null;
        /** @type {import('@converse/headless').PubSubMessage} */
        this.focused = null;
        /** @type {import('@converse/headless').PubSubFeed} */
        this.feed = null;
        this.comments = null;
        // When the focused comment advertises its own replies node (Libervia), the
        // child feed holding its replies, plus a signal to react to it.
        this.childFeed = null;
        this.childComments = null;
        this._submitting = false;
    }

    async initialize() {
        try {
            this.feed = await api.microblog.comments.feed(this.model);
        } catch (e) {
            log.error(e);
            return;
        }
        if (!this.feed) return;
        this.comments = collectionSignal(this.feed.messages);
        this.requestUpdate();
        // Backfill the thread and denormalise per-comment counts (the node may not
        // exist yet, which the feed treats as an empty thread).
        api.microblog.comments.fetch(this.model);
    }

    render() {
        if (!this.model) return '';
        return tplPost(this);
    }

    /**
     * @param {Map<string, unknown>} changed
     */
    updated(changed) {
        if (changed.has('focused')) this.resolveChildFeed();
    }

    /**
     * Resolve the focused item's replies source. In the flat model this is null
     * (its replies are in the post's own thread, filtered by the tree). For a
     * Libervia comment that advertises its own replies node, this fetches and
     * tracks that child feed so its top-level items render as the replies.
     */
    async resolveChildFeed() {
        const focused = this.focused;
        this.childFeed = null;
        this.childComments = null;
        if (!focused) {
            this.requestUpdate();
            return;
        }
        try {
            const child = await api.microblog.comments.replies(focused);
            if (this.focused !== focused) return; // superseded by a newer focus
            this.childFeed = child;
            this.childComments = child ? collectionSignal(child.messages) : null;
        } catch (e) {
            log.error(e);
        }
        this.requestUpdate();
    }

    /**
     * The item currently focused: the comment being viewed, or the post.
     * @returns {import('@converse/headless').PubSubMessage}
     */
    get focusItem() {
        return this.focused || this.model;
    }

    /**
     * Compute the drill-down view from the live thread signal in one pass: the
     * focused item's direct replies (oldest-first) and its ancestor chain
     * (root-first). Reading the signal here keeps it auto-tracked by SignalWatcher.
     * @returns {{ replies: import('@converse/headless').PubSubMessage[], ancestors: import('@converse/headless').PubSubMessage[], likeCount: number }}
     */
    getView() {
        this.comments?.get(); // track the post-thread signal
        this.childComments?.get(); // and the child feed's, when a Libervia comment is focused
        const focused_id = this.focused?.get('id');

        // Ancestors always come from the post's own thread (best-effort: a deep
        // Libervia reply isn't in it, so its chain shortens to the post).
        const { roots, by_id } = buildCommentTree(this.feed ? this.feed.getComments() : []);
        const ancestors = focused_id ? getAncestors(by_id, focused_id).map((n) => n.comment) : [];

        let replies;
        let likeCount;
        if (this.childFeed) {
            // Libervia: the focused comment's replies are the child node's top-level items.
            replies = buildCommentTree(this.childFeed.getComments()).roots.map((n) => n.comment);
            likeCount = computeThreadCounts(this.childFeed.comments).post.like_count;
        } else {
            const nodes = focused_id ? (by_id.get(focused_id)?.replies ?? []) : roots;
            replies = nodes.map((n) => n.comment);
            const { post, byComment } = computeThreadCounts(this.feed ? this.feed.comments : []);
            likeCount = focused_id ? (byComment.get(focused_id)?.like_count ?? 0) : post.like_count;
        }
        return { replies, ancestors, likeCount };
    }

    /** Return to the timeline (or the view beneath the thread). */
    goBack() {
        this.dispatchEvent(new CustomEvent('closepost', { bubbles: true, composed: true }));
    }

    /**
     * Back within the thread: focus the focused item's parent, or leave the thread
     * when already at a root (the post is focused).
     */
    onBack() {
        if (!this.focused) {
            this.goBack();
            return;
        }
        const ancestors = this.getView().ancestors;
        const parent = ancestors.length ? ancestors[ancestors.length - 1] : null;
        // A null parent focuses the post; the router (or local state) climbs one level.
        this.dispatchEvent(
            new CustomEvent('commentselected', { bubbles: true, composed: true, detail: { comment: parent } }),
        );
    }

    /**
     * Drill into a reply, focusing it so its own replies show.
     * @param {import('@converse/headless').PubSubMessage} comment
     */
    onDrillIn(comment) {
        this.dispatchEvent(new CustomEvent('commentselected', { bubbles: true, composed: true, detail: { comment } }));
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev) {
        if (ev.key === 'Enter' && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
            ev.preventDefault();
            this.onSubmit(ev);
        }
    }

    /**
     * Publish the composer's text as a reply to the focused item: a direct comment
     * on the post when it's focused, else a threaded reply to the focused comment.
     * @param {Event} [ev]
     */
    async onSubmit(ev) {
        ev?.preventDefault?.();
        const textarea = /** @type {HTMLTextAreaElement} */ (this.querySelector('.social-comment-compose__textarea'));
        const text = textarea.value.trim();
        if (!text) return;

        this._submitting = true;
        textarea.setAttribute('disabled', 'disabled');
        try {
            await api.microblog.comments.add(this.model, text, { parent: this.focused || undefined });
            textarea.value = '';
        } catch (e) {
            log.error(e);
            api.toast.show('comment-failed', { type: 'danger', body: __('Sorry, could not post your comment') });
        } finally {
            this._submitting = false;
            textarea.removeAttribute('disabled');
            textarea.focus();
        }
    }
}

api.elements.define('converse-social-post', SocialPost);
