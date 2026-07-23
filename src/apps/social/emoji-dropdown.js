/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * An emoji picker for the rich Social composer. It reuses the shared
 * `converse-emoji-picker`. On selection it resolves the shortname to a
 * unicode glyph and re-emits it as an `emojipicked` event for the composer
 * to insert into Lexical.
 */
import { html } from 'lit';
import { _converse, api, u, EmojiPicker } from '@converse/headless';
import { __ } from 'i18n';
import Dropdown from 'shared/components/dropdown.js';
import { shortnamesToEmojis } from 'shared/chat/utils.js';
import 'shared/chat/emoji-picker.js';

export default class SocialEmojiDropdown extends Dropdown {
    static get properties() {
        return {
            ...super.properties,
            // The model the composer is attached to. The shared picker only reads
            // `.get('jid')` off it (to tag its event, which we discard), so passing
            // the feed model keeps the picker happy without any chatbox coupling.
            model: { type: Object },
            _render_emojis: { type: Boolean, state: true },
        };
    }

    constructor() {
        super();
        this.dropdown_id = u.getUniqueId();
        this.model = null;
        /** @type {EmojiPicker|null} */
        this._state = null;
        // Lazily render the (heavy) emoji grid, only once the dropdown is first opened.
        this._render_emojis = false;
        this.addEventListener('converse:dropdown:show', () => this.onShown());
    }

    connectedCallback() {
        // Opt into the shared picker's dropdown integration: `converse-emoji-picker`
        // resolves its containing dropdown via this class (it looks for chat's
        // `converse-emoji-dropdown` tag otherwise), and on hide then disables its
        // arrow navigation and emits `emojipickerblur`, which the composer uses to
        // hand focus back to the editor.
        this.classList.add('emoji-picker__dropdown');
        super.connectedCallback();
    }

    render() {
        return html`<button
                type="button"
                class="social-rich__fmt social-rich__emoji dropdown-toggle dropdown-toggle--no-caret"
                id="${this.dropdown_id}"
                title="${__('Insert emoji')}"
                aria-label="${__('Insert emoji')}"
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

    /**
     * Lazily create and fetch the per-account emoji-picker state. It is storage-backed,
     * so the chosen category/skin-tone/query persist across opens and page loads.
     * @returns {Promise<EmojiPicker>}
     */
    async initState() {
        if (this._state) return this._state;

        await api.emojis.initialize();
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.emoji-${bare_jid}-social`;
        const state = new EmojiPicker({ id });
        u.initStorage(state, id);
        await new Promise((resolve) => state.fetch({ success: resolve, error: resolve }));

        // Never resume in the autocompleting state on load.
        state.set({ autocompleting: null, ac_position: null });
        this._state = state;
        return state;
    }

    async onShown() {
        await this.initState();
        if (!this._render_emojis) {
            this._render_emojis = true;
            await this.updateComplete;
        }
        setTimeout(() => /** @type {HTMLInputElement} */ (this.querySelector('.emoji-search'))?.focus());
    }

    /**
     * The shared picker's `emojiSelected` bubbles up to `document`, where chat's
     * message-form listens for it. Stop it here (so a social emoji never lands in an
     * open chat's textarea) and re-emit the resolved glyph for the composer.
     * @param {CustomEvent} ev
     */
    onEmojiSelected(ev) {
        ev.stopPropagation();
        // `unicode_only` yields plain strings only (the glyph, or the shortname itself
        // for a custom image emoji), so joining gives text safe to drop into Lexical.
        const text = shortnamesToEmojis(ev.detail.value, { unicode_only: true, add_title_wrapper: false }).join('');
        this.hide();
        this.dispatchEvent(new CustomEvent('emojipicked', { detail: { text }, bubbles: true, composed: true }));
    }
}

api.elements.define('converse-social-emoji-dropdown', SocialEmojiDropdown);
