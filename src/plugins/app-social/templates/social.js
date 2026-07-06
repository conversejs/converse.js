import { html } from 'lit';
import { api } from '@converse/headless';

/**
 * @param {import('../view.js').default} el
 */
export default (el) => {
    if (!api.connection.get()?.connected) {
        return html`<div class="social-feed__empty"></div>`;
    }
    // A post's detail view (its comment thread) takes over the whole app when open.
    if (el.open_post) {
        return html`<converse-social-post class="social-feed-container" .model=${el.open_post}></converse-social-post>`;
    }
    // The user's own microblog feed (omitting `jid` defaults to the own bare JID).
    return html`<converse-social-feed class="social-feed-container"></converse-social-feed>`;
};
