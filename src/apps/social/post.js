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
        this.comments?.get(); // track the collection signal
        const items = this.feed ? this.feed.comments : [];
        const list = this.feed ? this.feed.getComments() : [];
        const { roots, by_id } = buildCommentTree(list);
        const focused_id = this.focused?.get('id');
        const nodes = focused_id ? (by_id.get(focused_id)?.replies ?? []) : roots;
        const replies = nodes.map((n) => n.comment);
        const ancestors = focused_id ? getAncestors(by_id, focused_id).map((n) => n.comment) : [];

        // The focused item's live like count (post-level likes, or the comment's),
        // deduped by liker. Computed from the thread rather than the post's cached
        // summary, which the detail view doesn't fetch.
        const { post, byComment } = computeThreadCounts(items);
        const likeCount = focused_id ? (byComment.get(focused_id)?.like_count ?? 0) : post.like_count;
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
