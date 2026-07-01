import { api, _converse } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplSocial from './templates/social.js';

import './compose.js';
import './message.js';
import './onboarding.js';
import './feed.js';
import './placeholder.js';
import './styles/social.scss';

class SocialApp extends CustomElement {
    initialize() {
        // Re-render when the connection state changes so that, after a page
        // reload while the Social app is active, the feed mounts once we're
        // connected (the template only renders it when connected). Mirrors the
        // chat app. `listenTo` auto-deregisters when the element is dismounted.
        this.listenTo(_converse, 'connected', () => this.requestUpdate());
        this.listenTo(_converse, 'reconnected', () => this.requestUpdate());
        this.listenTo(_converse, 'disconnected', () => this.requestUpdate());
    }

    render() {
        return tplSocial();
    }
}

api.elements.define('converse-app-social', SocialApp);
