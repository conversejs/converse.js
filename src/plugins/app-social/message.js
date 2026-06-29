/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, PubSubMessage } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import { attrSignal } from 'shared/signals.js';
import tplMessage from './templates/message.js';

/**
 * Renders a single microblog post.
 *
 * Uses `attrSignal` so an edit to the post's body re-renders just this
 * component (the `SignalWatcher`-driven feed list passes each post down).
 */
export default class SocialMessage extends CustomElement {
    static get properties() {
        return {
            model: { type: PubSubMessage },
        };
    }

    initialize() {
        // Re-render this post when its display-affecting attributes change.
        this.listenTo(this.model, 'change:body', () => this.requestUpdate());
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
     * Expose the post's body as a signal for fine-grained binding in the
     * template (part of the signals reference adoption).
     * @returns {import('@lit-labs/signals').Signal.State<string>}
     */
    get bodySignal() {
        return attrSignal(this.model, 'body');
    }
}

api.elements.define('converse-social-message', SocialMessage);
