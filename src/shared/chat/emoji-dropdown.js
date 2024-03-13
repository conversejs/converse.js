import DropdownBase from "shared/components/dropdown.js";
import EmojiPicker from "@converse/headless/plugins/emoji/picker";
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless";
import { html } from "lit";
import { initStorage } from '@converse/headless/utils/storage.js';
import { until } from 'lit/directives/until.js';
import { CHATROOMS_TYPE } from "@converse/headless/shared/constants.js";

const u = converse.env.utils;


export default class EmojiDropdown extends DropdownBase {

    static get properties() {
        return {
            chatview: { type: Object },
            icon_classes: { type: String },
            items: { type: Array }
        };
    }

    constructor () {
        super();
        // This is an optimization, we lazily render the emoji picker, otherwise tests slow to a crawl.
        this.render_emojis = false;
        this.chatview = null;
    }

    initModel () {
        if (!this.init_promise) {
            this.init_promise = (async () => {
                await api.emojis.initialize()
                const bare_jid = _converse.session.get('bare_jid');
                const id = `converse.emoji-${bare_jid}-${this.chatview.model.get('jid')}`;
                this.model = new EmojiPicker({ id });
                initStorage(this.model, id);
                await new Promise(resolve => this.model.fetch({'success': resolve, 'error': resolve}));
                // We never want still be in the autocompleting state upon page load
                this.model.set({'autocompleting': null, 'ac_position': null});
            })();
        }
        return this.init_promise;
    }

    render() {
        const is_groupchat = this.chatview.model.get('type') === CHATROOMS_TYPE;
        const color = is_groupchat ? '--muc-toolbar-btn-color' : '--chat-toolbar-btn-color';
        return html`
            <div class="dropup">
                <button class="toggle-emojis"
                        title="${__('Insert emojis')}"
                        data-toggle="dropdown"
                        aria-haspopup="true"
                        aria-expanded="false">
                    <converse-icon
                        color="var(${color})"
                        class="fa fa-smile "
                        path-prefix="${api.settings.get('assets_path')}"
                        size="1em"></converse-icon>
                </button>
                <div class="dropdown-menu">
                    ${until(this.initModel().then(() => html`
                        <converse-emoji-picker
                                .chatview=${this.chatview}
                                .model=${this.model}
                                @emojiSelected=${() => this.hideMenu()}
                                ?render_emojis=${this.render_emojis}
                                current_category="${this.model.get('current_category') || ''}"
                                current_skintone="${this.model.get('current_skintone') || ''}"
                                query="${this.model.get('query') || ''}"
                        ></converse-emoji-picker>`), '')}
                </div>
            </div>`;
    }

    connectedCallback () {
        super.connectedCallback();
        this.render_emojis = false;
    }

    toggleMenu (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        if (u.hasClass('show', this.menu)) {
            if (u.ancestor(ev.target, '.toggle-emojis')) {
                this.hideMenu();
            }
        } else {
            this.showMenu();
        }
    }

    async showMenu () {
        await this.initModel();
        if (!this.render_emojis) {
            // Trigger an update so that emojis are rendered
            this.render_emojis = true;
            this.requestUpdate();
            await this.updateComplete;
        }
        super.showMenu();
        setTimeout(() => /** @type {HTMLInputElement} */(this.querySelector('.emoji-search'))?.focus());
    }
}

api.elements.define('converse-emoji-dropdown', EmojiDropdown);
