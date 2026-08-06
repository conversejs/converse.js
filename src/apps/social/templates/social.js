import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { api } from '@converse/headless';

/**
 * The themed backdrop the reading column sits on, so that the app's margins
 * carry the theme rather than a flat fill (in the cyberpunk theme, the moving
 * grid). Same guard as the controlbox uses for the login form's backdrop:
 * `converse-app-social` paints the plain colour underneath, so with
 * `show_background` off nothing changes.
 */
function tplBackground() {
    const show_bg = api.settings.get('show_background') && api.settings.get('view_mode') === 'fullscreen';
    return show_bg ? html`<converse-bg></converse-bg>` : '';
}

/**
 * @param {import('../view.js').default} el
 */
export default (el) => {
    if (!api.connection.get()?.connected) {
        return html`<div class="social-feed__empty"></div>`;
    }
    // Resolving a deep-linked post from the URL: show a spinner until it lands.
    if (el._resolving) {
        return html`<div class="social-feed__empty"><converse-spinner></converse-spinner></div>`;
    }
    // A post's detail view (its comment thread) takes over the whole app when
    // open (including over a profile), so back returns to the profile beneath it.
    if (el.open_post) {
        return html`${tplBackground()}<converse-social-post
                class="social-feed-container"
                .model=${el.open_post}
                .focused=${el.open_comment}
            ></converse-social-post>`;
    }
    // An author's profile (or a followed community feed) takes over the timeline
    // when open. Keyed on JID+node so navigating to a different profile/feed
    // remounts; the active tab is passed in so switching it doesn't remount.
    if (el.open_profile) {
        return html`${tplBackground()}${keyed(
            `${el.open_profile}|${el.profile_node}`,
            html`<converse-social-profile
                class="social-feed-container"
                jid=${el.open_profile}
                node=${el.profile_node}
                tab=${el.profile_tab}
            ></converse-social-profile>`,
        )}`;
    }
    // The user's own microblog feed (omitting `jid` defaults to the own bare JID).
    // `filter` is owned by SocialApp so the hashtag view is routable.
    return html`${tplBackground()}<converse-social-feed
            class="social-feed-container"
            .filter=${el.filter}
        ></converse-social-feed>`;
};
