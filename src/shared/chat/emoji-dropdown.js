import { html } from 'lit';
import { _converse, api, u, EmojiPicker, constants } from '@converse/headless';
import { __ } from 'i18n';
import DropdownBase from 'shared/components/dropdown.js';
import { until } from 'lit/directives/until.js';

const { CHATROOMS_TYPE } = constants;
const { initStorage } = u;

export default class EmojiDropdown extends DropdownBase {
    static get properties() {
        return {
            icon_classes: { type: String },
            items: { type: Array },
            model: { type: Object },
        };
    }

    constructor() {
        super();
        this.id = u.getUniqueId();

        // This is an optimization, we lazily render the emoji picker, otherwise tests slow to a crawl.
        this.render_emojis = false;
        this.model = null;
        this.addEventListener('shown.bs.dropdown', () => this.onShown());
    }

    initModel() {
        if (!this.init_promise) {
            this.init_promise = (async () => {
                await api.emojis.initialize();
                const chatbox = this.model;
                if (!chatbox.emoji_picker) {
                    const bare_jid = _converse.session.get('bare_jid');
                    const id = `converse.emoji-${bare_jid}-${chatbox.get('jid')}`;
                    chatbox.emoji_picker = new EmojiPicker({ id });
                    initStorage(chatbox.emoji_picker, id);
                    await new Promise((resolve) =>
                        chatbox.emoji_picker.fetch({ 'success': resolve, 'error': resolve }),
                    );
                    // We never want still be in the autocompleting state upon page load
                    chatbox.emoji_picker.set({ 'autocompleting': null, 'ac_position': null });
                }
            })();
        }
        return this.init_promise;
    }

    render() {
        const is_groupchat = this.model.get('type') === CHATROOMS_TYPE;
        const color = is_groupchat ? '--muc-color' : '--chat-color';

        return html` <button
                class="btn dropdown-toggle dropdown-toggle--no-caret toggle-emojis"
                type="button"
                id="${this.id}"
                title="${__('Insert emojis')}"
                data-bs-toggle="dropdown"
                aria-haspopup="true"
                aria-expanded="false"
            >
                <converse-icon
                    color="var(${color})"
                    class="fa fa-smile "
                    path-prefix="${api.settings.get('assets_path')}"
                    size="1em"
                ></converse-icon>
            </button>
            <ul class="dropdown-menu" aria-labelledby="${this.id}">
                <li>
                    ${until(
                        this.initModel().then(
                            () =>
                                html` <converse-emoji-picker
                                    .state=${this.model.emoji_picker}
                                    .model=${this.model}
                                    @emojiSelected=${() => this.dropdown.hide()}
                                    ?render_emojis=${this.render_emojis}
                                    current_category="${this.model.emoji_picker.get('current_category') || ''}"
                                    current_skintone="${this.model.emoji_picker.get('current_skintone') || ''}"
                                    query="${this.model.emoji_picker.get('query') || ''}"
                                ></converse-emoji-picker>`,
                        ),
                        '',
                    )}
                </li>
            </ul>`;
    }

    connectedCallback() {
        super.connectedCallback();
        this.render_emojis = false;
    }

    async onShown() {
        await this.initModel();
        if (!this.render_emojis) {
            // Trigger an update so that emojis are rendered
            this.render_emojis = true;
            this.requestUpdate();
            await this.updateComplete;
        }
        setTimeout(() => /** @type {HTMLInputElement} */ (this.querySelector('.emoji-search'))?.focus());
    }
}

api.elements.define('converse-emoji-dropdown', EmojiDropdown);
