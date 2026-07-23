/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, converse, PubSubMessage } from '@converse/headless';
import log from '@converse/log';
import { __ } from 'i18n';
import { ObservableElement } from 'shared/components/observable.js';
import 'shared/modals/image.js';
import tplMessage from './templates/message.js';

const { Strophe } = converse.env;

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
            // When set, suppress the "via <feed>" source line. Passed by the feed
            // profile view, where every post is from the feed on show, so naming
            // it on each row would just be noise (see getSourceFeed).
            hidesource: { type: Boolean },
            _reposting: { type: Boolean, state: true },
            _liking: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        this.compact = false;
        this.hidesource = false;
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
     * Open the author's profile view when their avatar or name is clicked.
     * Bubbles a `profileselected` event up to the Social app, which swaps the
     * timeline for the profile view.
     * @param {MouseEvent} [ev]
     */
    showProfile(ev) {
        ev?.preventDefault?.();
        const jid = this.model.getAuthorJID();
        if (!jid) return;
        // A profile is a person/feed keyed by bare JID. A post's `publisher` can
        // be a full JID (Movim stamps `edhelas@movim.eu/atomtopubsub`), so drop
        // the resource, or the profile won't match the bare-JID follow record.
        this.dispatchEvent(
            new CustomEvent('profileselected', {
                bubbles: true,
                composed: true,
                detail: { jid: Strophe.getBareJidFromJid(jid) },
            }),
        );
    }

    /**
     * Open the community/topic feed this post arrived through (its pubsub node's
     * read-only profile), distinct from the author's own profile. Only relevant
     * when {@link PubSubMessage#getSourceFeed} is non-null (a news/topic node, not
     * a personal microblog).
     * @param {MouseEvent} [ev]
     */
    showSourceFeed(ev) {
        ev?.preventDefault?.();
        const source = this.model.getSourceFeed();
        if (!source) return;

        this.dispatchEvent(
            new CustomEvent('profileselected', {
                bubbles: true,
                composed: true,
                detail: { jid: source.jid, node: source.node },
            }),
        );
    }

    /**
     * Route clicks on `xmpp:` links in the post body to the in-app profile view.
     * We use these links for @ mentions.
     * @param {MouseEvent} ev
     */
    onBodyClicked(ev) {
        const anchor = /** @type {HTMLElement} */ (ev.target)?.closest?.('a[href^="xmpp:"]');
        if (!anchor) return;

        ev.preventDefault();
        // An XMPP URI is `xmpp:jid`, optionally with a `?query` part (RFC 5122).
        const jid = anchor.getAttribute('href').slice('xmpp:'.length).split('?')[0];
        if (!jid) return;

        this.dispatchEvent(
            new CustomEvent('profileselected', {
                bubbles: true,
                composed: true,
                detail: { jid: Strophe.getBareJidFromJid(jid) },
            }),
        );
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
