/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, PubSubMessage } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import 'shared/modals/image.js';
import tplMessage from './templates/message.js';

/**
 * Renders a single microblog post. The `SignalWatcher`-driven feed list passes
 * each post down; this component re-renders when a post's display-affecting
 * attributes (its Atom text constructs, author name, avatar) change.
 */
export default class SocialMessage extends CustomElement {
    static get properties() {
        return {
            model: { type: PubSubMessage },
        };
    }

    initialize() {
        // Re-render this post when its display-affecting attributes change. The
        // post body is the three Atom text constructs, kept distinct.
        this.listenTo(this.model, 'change:title', () => this.requestUpdate());
        this.listenTo(this.model, 'change:summary', () => this.requestUpdate());
        this.listenTo(this.model, 'change:content', () => this.requestUpdate());
        this.listenTo(this.model, 'change:displayName', () => this.requestUpdate());
        // The author's vCard (avatar) and contact resolve asynchronously; re-render
        // so the avatar appears once its vCard loads, and the profile link appears
        // once an existing contact resolves.
        this.listenTo(this.model, 'vcard:add', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:change', () => this.requestUpdate());
        this.listenTo(this.model, 'contact:add', () => this.requestUpdate());
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
}

api.elements.define('converse-social-message', SocialMessage);
