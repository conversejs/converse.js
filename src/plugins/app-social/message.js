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
    }

    render() {
        return tplMessage(this);
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
