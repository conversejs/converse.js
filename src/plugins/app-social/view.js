import { api, _converse } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplSocial from './templates/social.js';

import './compose.js';
import './message.js';
import './onboarding.js';
import './feed.js';
import './post.js';
import './placeholder.js';
import './styles/social.scss';

class SocialApp extends CustomElement {
    static get properties() {
        return {
            // The post whose detail view (comment thread) is open, or null for
            // the timeline. An internal reactive state — setting it swaps views.
            open_post: { type: Object, state: true },
        };
    }

    constructor() {
        super();
        this.open_post = null;
    }

    initialize() {
        // Re-render when the connection state changes so that, after a page
        // reload while the Social app is active, the feed mounts once we're
        // connected (the template only renders it when connected). Mirrors the
        // chat app. `listenTo` auto-deregisters when the element is dismounted.
        this.listenTo(_converse, 'connected', () => this.requestUpdate());
        this.listenTo(_converse, 'reconnected', () => this.requestUpdate());
        this.listenTo(_converse, 'disconnected', () => this.requestUpdate());

        // A post's "Comments" button (in the timeline) opens its detail view;
        // the detail's back button closes it. Both bubble up to here.
        this.addEventListener('postselected', (ev) => (this.open_post = /** @type {CustomEvent} */ (ev).detail.post));
        this.addEventListener('closepost', () => (this.open_post = null));
    }

    render() {
        return tplSocial(this);
    }
}

api.elements.define('converse-app-social', SocialApp);

export default SocialApp;
