/**
 * @module converse-reactions
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { html } from 'lit';
import { _converse, api, u, EmojiPicker } from '@converse/headless';
import DropdownBase from 'shared/components/dropdownbase.js';
import 'shared/components/icons.js';
import 'shared/chat/emoji-picker.js';
import 'shared/chat/styles/emoji.scss';

export default class EmojiPickerDropdown extends DropdownBase {
    static get properties() {
        return {
            message_model: { type: Object },
        };
    }

    constructor() {
        super();
        this.message_model = null;
    }

    get chatbox() {
        return this.message_model?.collection?.chatbox;
    }

    get allowed_emojis() {
        return this.chatbox?.get('allowed_reactions');
    }

    render() {
        return html`
            <button class="reaction-item more dropdown-toggle" type="button" aria-haspopup="true" aria-expanded="false">
                <converse-icon class="fas fa-plus" size="1em"></converse-icon>
            </button>
            <ul class="dropdown-menu">
                <li>
                    ${this.chatbox?.emoji_picker
                        ? html`
                              <converse-emoji-picker
                                  .state=${this.chatbox.emoji_picker}
                                  .model=${this.chatbox}
                                  .allowed_emojis=${this.allowed_emojis}
                                  @emojiSelected=${(ev) => {
                                      ev.stopPropagation();
                                      this.dispatchEvent(
                                          new CustomEvent('emoji-picker-selected', {
                                              detail: { emoji: ev.detail.value },
                                              bubbles: true,
                                              composed: true,
                                          }),
                                      );
                                  }}
                                  ?render_emojis=${true}
                                  current_category="${this.chatbox.emoji_picker.get('current_category') || ''}"
                                  current_skintone="${this.chatbox.emoji_picker.get('current_skintone') || ''}"
                                  query="${this.chatbox.emoji_picker.get('query') || ''}"
                              ></converse-emoji-picker>
                          `
                        : ''}
                </li>
            </ul>
        `;
    }

    firstUpdated() {
        this.menu = /** @type {HTMLElement} */ (this.querySelector('.dropdown-menu'));
        this.button = /** @type {HTMLButtonElement} */ (/** @type {unknown} */ (this.querySelector('button')));
        this._onButtonClick = async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            await this.#initPicker();
            await this.updateComplete;
            this.toggle();
        };
        this.button.addEventListener('click', this._onButtonClick);
    }

    updated(changed) {
        super.updated(changed);
        this.menu = /** @type {HTMLElement} */ (this.querySelector('.dropdown-menu'));
        this.button = /** @type {HTMLButtonElement} */ (/** @type {unknown} */ (this.querySelector('button')));
    }

    async #initPicker() {
        const chatbox = this.chatbox;
        if (!chatbox || chatbox.emoji_picker) return;
        await api.emojis.initialize();
        const bare_jid = _converse.session.get('bare_jid');
        const id = `converse.emoji-${bare_jid}-${chatbox.get('jid')}`;
        chatbox.emoji_picker = new EmojiPicker({ id });
        u.initStorage(chatbox.emoji_picker, id);
        await new Promise((resolve) => chatbox.emoji_picker.fetch({ success: resolve, error: resolve }));
        this.requestUpdate();
    }
}

api.elements.define('converse-emoji-picker-dropdown', EmojiPickerDropdown);

