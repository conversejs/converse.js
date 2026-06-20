import { html } from 'lit';
import { api } from '@converse/headless';

export default () => {
    if (!api.connection.get()?.connected) {
        return html`<div class="social-feed__empty"></div>`;
    }
    // The user's own microblog feed (omitting `jid` defaults to the own bare JID).
    return html`<converse-social-feed class="social-feed-container"></converse-social-feed>`;
};
