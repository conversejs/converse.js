/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, PubSubMessage } from '@converse/headless';
import log from '@converse/log';
import { __ } from 'i18n';
import { ObservableElement } from 'shared/components/observable.js';
import 'shared/modals/image.js';
import tplMessage from './templates/message.js';

/**
 * Renders a single microblog post. The `SignalWatcher`-driven feed list passes
 * each post down; this component re-renders when a post's display-affecting
 * attributes (its Atom text constructs, author name, avatar) change.
 */
export default class SocialMessage extends ObservableElement {
    static get properties() {
        return {
            ...super.properties,
            model: { type: PubSubMessage },
            // When set, render as a thread item (or the detail header): drop the
            // action buttons (comment / repost / delete), which belong to the
            // timeline.
            compact: { type: Boolean },
            _reposting: { type: Boolean, state: true },
            _liking: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        this.compact = false;
        // Fetch this post's comment/like counts once it's scrolled into view
        this.observable = /** @type {import('shared/components/types').ObservableProperty} */ ('once');
        this.observableRequireFocus = true;
        this.intersectionRatio = 0.1;
    }

    initialize() {
        this.listenTo(this.model, 'change:comment_count', () => this.requestUpdate());
        this.listenTo(this.model, 'change:content', () => this.requestUpdate());
        this.listenTo(this.model, 'change:displayName', () => this.requestUpdate());
        this.listenTo(this.model, 'change:like_count', () => this.requestUpdate());
        this.listenTo(this.model, 'change:liked_by_me', () => this.requestUpdate());
        this.listenTo(this.model, 'change:summary', () => this.requestUpdate());
        this.listenTo(this.model, 'change:title', () => this.requestUpdate());
        this.listenTo(this.model, 'contact:add', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:add', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:change', () => this.requestUpdate());
    }

    render() {
        return tplMessage(this);
    }

    /**
     * Show the author's details (or our own profile for own posts) when their
     * avatar is clicked. Uses the contact resolved on the post model.
     * @param {MouseEvent} ev
     */
    showUserModal(ev) {
        ev.preventDefault();
        const contact = this.model.contact;
        if (!contact) return;
        if (this.model.get('is_mine')) {
            api.modal.show('converse-profile-modal', { model: contact }, ev);
        } else {
            api.modal.show('converse-user-details-modal', { model: contact }, ev);
        }
    }

    /**
     * Open an inline post image in the lightbox modal when clicked.
     * @param {MouseEvent} ev
     */
    onImgClick(ev) {
        ev.preventDefault();
        const img = /** @type {HTMLImageElement} */ (ev.target);
        api.modal.show('converse-image-modal', { src: img.src, filename: img.dataset.filename }, ev);
    }

    /**
     * Notify the feed that an inline image finished loading, so it can keep the
     * scroll position stable as posts grow taller.
     */
    onImgLoad() {
        this.dispatchEvent(new CustomEvent('imageLoaded', { detail: this, bubbles: true }));
    }

    /**
     * Delete one of our own posts, after confirmation. Retracts the item from
     * the node and removes the local copy.
     */
    async onRetract() {
        const result = await api.confirm(__('Confirm'), __('Are you sure you want to delete this post?'));
        if (!result) return;
        const feed = this.model.collection?.feed;
        await feed?.retractPost(this.model.get('id'));
    }

    /**
     * Open this post's detail view (its comment thread). Bubbles a
     * `postselected` event up to the Social app, which swaps the timeline for
     * the detail view.
     */
    onComments() {
        this.dispatchEvent(
            new CustomEvent('postselected', { bubbles: true, composed: true, detail: { post: this.model } }),
        );
    }

    /**
     * Repost (repeat) this post into our own feed (XEP-0277 § Repeating a Post).
     * The button is disabled while the repost is in flight, so a double-click
     * can't publish a duplicate item.
     */
    async onRepost() {
        this._reposting = true;
        try {
            await api.microblog.repost(this.model);
        } catch (e) {
            log.error(e);
            api.toast.show('repost-failed', { type: 'danger', body: __('Sorry, could not repeat this post') });
        } finally {
            this._reposting = false;
        }
    }

    async onToggleLike() {
        if (this._liking) return;
        this._liking = true;
        const was_liked = this.model.get('liked_by_me');
        try {
            await (was_liked ? api.microblog.unlike(this.model) : api.microblog.like(this.model));
        } catch (e) {
            log.error(e);
            api.toast.show('like-failed', {
                type: 'danger',
                body: was_liked
                    ? __('Sorry, could not remove your like — your server may not allow it')
                    : __('Sorry, could not like this post'),
            });
        } finally {
            this._liking = false;
        }
    }

    /**
     * The post has been scrolled into view, lazily fetch its comment/like counts.
     * @param {IntersectionObserverEntry} _entry
     */
    onVisibilityChanged(_entry) {
        if (this.compact) return;
        api.microblog.comments.fetchSummary(this.model).catch((e) => log.error(e));
    }
}

api.elements.define('converse-social-message', SocialMessage);
