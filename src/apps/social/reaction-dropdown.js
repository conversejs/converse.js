/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * The "add reaction" picker for a Social post or comment. Reuses the shared
 * `converse-emoji-picker` plumbing from {@link SocialEmojiDropdown} (its
 * per-account, storage-backed state and glyph resolution), only swapping the
 * trigger button for a reaction affordance. On selection it re-emits the chosen
 * glyph as an `emojipicked` event (inherited), which the message component turns
 * into a `react()` call.
 */
import { html } from 'lit';
import { api } from '@converse/headless';
import { __ } from 'i18n';
import SocialEmojiDropdown from './emoji-dropdown.js';

export default class SocialReactionDropdown extends SocialEmojiDropdown {
    render() {
        return html`<button
                type="button"
                class="social-post__action social-post__action--react dropdown-toggle dropdown-toggle--no-caret"
                id="${this.dropdown_id}"
                title="${__('Add reaction')}"
                aria-label="${__('Add reaction')}"
                aria-haspopup="true"
                aria-expanded="false"
                @mousedown=${(/** @type {MouseEvent} */ ev) => ev.preventDefault()}
            >
                <converse-icon size="1em" class="fa fa-smile"></converse-icon>
            </button>
            <ul class="dropdown-menu" aria-labelledby="${this.dropdown_id}">
                <li>
                    ${this._state
                        ? html`<converse-emoji-picker
                              .state=${this._state}
                              .model=${this.model}
                              ?render_emojis=${this._render_emojis}
                              @emojiSelected=${(/** @type {CustomEvent} */ ev) => this.onEmojiSelected(ev)}
                              current_category="${this._state.get('current_category') || ''}"
                              current_skintone="${this._state.get('current_skintone') || ''}"
                              query="${this._state.get('query') || ''}"
                          ></converse-emoji-picker>`
                        : ''}
                </li>
            </ul>`;
    }
}

api.elements.define('converse-social-reaction-dropdown', SocialReactionDropdown);
