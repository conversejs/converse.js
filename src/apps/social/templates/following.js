import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { __ } from 'i18n';

/**
 * One followed feed: avatar, label and the address it lives at, click to open it.
 * The label is the follow's title / feed name; the subtitle is the server JID.
 * Our own list adds an Unfollow button; another account's rows are read-only.
 * @param {import('../following.js').default} el
 * @param {{ jid: string, node: string, profile: import('@converse/headless').MicroblogProfile, label: string }} entry
 */
function tplRow(el, { jid, node, profile, label }) {
    return html`<li
        class="social-following__item"
        role="button"
        tabindex="0"
        @click=${() => el.onSelect(jid, node)}
        @keydown=${(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), el.onSelect(jid, node))}
    >
        <converse-avatar
            .model=${profile}
            class="avatar social-following__avatar"
            name="${label}"
            nonce=${profile.vcard?.get('vcard_updated')}
            height="40"
            width="40"
        ></converse-avatar>
        <span class="social-following__identity">
            <span class="social-following__name">${label}</span>
            <span class="social-following__jid">${jid}</span>
        </span>
        ${el.isOwn
            ? html`<button
                  type="button"
                  class="btn btn-secondary social-following__unfollow"
                  @click=${(ev) => el.onUnfollow(ev, jid, node)}
              >
                  ${__('Unfollow')}
              </button>`
            : ''}
    </li>`;
}

/**
 * The following list: a spinner while another account's list loads, a graceful
 * notice when it can't be read, the rows, or an empty state.
 * @param {import('../following.js').default} el
 */
export default (el) => {
    const entries = el.entries;
    if (entries.length) {
        return html`<ul class="social-following__list">
            ${repeat(
                entries,
                (entry) => entry.jid,
                (entry) => tplRow(el, entry),
            )}
        </ul>`;
    }
    if (!el.isOwn && !el._loaded) {
        return html`<p class="social-feed__empty"><converse-spinner></converse-spinner></p>`;
    }
    if (!el.isOwn && el._error) {
        return html`<p class="social-feed__empty social-following__unavailable">
            <converse-icon size="1.2em" class="fa fa-lock"></converse-icon>
            ${__("You can't see who %1$s follows.", el.owner.getDisplayName())}
        </p>`;
    }
    return html`<p class="social-feed__empty">
        ${el.isOwn
            ? __("You aren't following anyone yet.")
            : __("%1$s isn't following anyone.", el.owner.getDisplayName())}
    </p>`;
};
