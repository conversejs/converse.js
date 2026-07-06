/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, log } from '@converse/headless';
import { SignalWatcher } from '@lit-labs/signals';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import { collectionSignal } from 'shared/signals.js';
import tplPost from './templates/post.js';

/**
 * A post's detail view: the post itself plus its comment thread (XEP-0277 §
 * Comments) and a box to add a comment. Opened from a post's "Comments" button
 * in the timeline; the back button returns to the timeline.
 *
 * `SignalWatcher` auto-tracks the `collectionSignal` over the comment feed's
 * messages, so the thread re-renders when a comment is fetched, posted, or
 * pushed live.
 */
export default class SocialPost extends SignalWatcher(CustomElement) {
    static get properties() {
        return {
            model: { type: Object },
            _submitting: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        /** @type {import('@converse/headless').PubSubMessage} */
        this.model = null;
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
        // Backfill the thread from the server (the node may not exist yet, which
        // the feed treats as an empty thread).
        this.feed.fetchComments();
    }

    /**
     * The thread's comments, oldest-first (chronological, like a chat). The
     * underlying collection is newest-first, so reverse a snapshot. Reading the
     * signal here keeps it auto-tracked by `SignalWatcher`.
     * @returns {import('@converse/headless').PubSubMessage[]}
     */
    get threadComments() {
        const msgs = /** @type {import('@converse/headless').PubSubMessage[]} */ (this.comments?.get() ?? []);
        return [...msgs].reverse();
    }

    render() {
        if (!this.model) return '';
        return tplPost(this);
    }

    /** Return to the timeline. */
    goBack() {
        this.dispatchEvent(new CustomEvent('closepost', { bubbles: true, composed: true }));
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
            await api.microblog.comments.add(this.model, text);
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
