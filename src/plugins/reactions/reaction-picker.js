/**
 * @module converse-reaction-picker
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */

import { CustomElement } from 'shared/components/element.js';
import { api, u, EmojiPicker } from '@converse/headless';
import { __ } from 'i18n';
import tplReactionPicker from '../../templates/reaction-picker.js';
import { default as BootstrapDropdown } from "bootstrap/js/src/dropdown.js";
import { sendReaction } from './utils.js';
import 'shared/components/dropdown.js';
import 'shared/chat/emoji-picker.js';
import 'shared/chat/styles/emoji.scss';
import './reaction-picker.scss';

export default class ReactionPicker extends CustomElement {

    static get properties () {
        return {
            'model': { type: Object },
            'emoji_picker_state': { type: Object },
            'dropup': { type: Boolean },
            'shifted': { type: Boolean },
            'closing': { type: Boolean }
        };
    }

    constructor () {
        super();
        this.model = null;
        this.emoji_picker_state = null;
        this.picker_id = u.getUniqueId('reaction-picker');
        this.dropup = false;
        this.shifted = false;
        this.closing = false;
        this.onClickOutside = this.onClickOutside.bind(this);
    }

    firstUpdated () {
        requestAnimationFrame(() => {
            const picker = /** @type {HTMLElement} */ (this.querySelector('.reaction-picker'));
            if (!picker) return;
            
            const hostRect = this.getBoundingClientRect();
            
            const threshold = 150; 
            const windowHeight = window.innerHeight || document.documentElement.clientHeight;
            
            let needsUpdate = false;

            const spaceBelow = windowHeight - hostRect.bottom;
            
            if (spaceBelow < threshold) {
                if (!this.dropup) {
                    this.dropup = true;
                    needsUpdate = true;
                }
            } else {
                 if (this.dropup) {
                    this.dropup = false;
                    needsUpdate = true;
                }
            }
            
            picker.style.position = 'absolute';
            picker.style.right = '0';
            picker.style.left = 'auto';
            
            if (this.dropup) {
                picker.style.top = 'auto';
                picker.style.bottom = '100%';
            } else {
                picker.style.bottom = 'auto';
                picker.style.top = '100%';
            }

            if (needsUpdate) {
                this.requestUpdate();
            }
        });
    }

    connectedCallback () {
        super.connectedCallback();
        setTimeout(() => document.addEventListener('click', this.onClickOutside), 0);
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        document.removeEventListener('click', this.onClickOutside);
    }

    onClickOutside (ev) {
        const click_target = /** @type {Node} */(ev.target);
        if (!this.contains(click_target)) {
            this.close();
        }
    }

    close () {
        if (this.closing) return;
        this.closing = true;
        const picker = this.querySelector('.reaction-picker');
        if (picker) {
            picker.addEventListener('animationend', () => {
                this.dispatchEvent(new CustomEvent('closePicker', { bubbles: true, composed: true }));
            }, { once: true });
        } else {
            this.dispatchEvent(new CustomEvent('closePicker', { bubbles: true, composed: true }));
        }
    }

    get allowed_emojis () {
        return this.model?.collection?.chatbox?.get('allowed_reactions');
    }


    /**
     * Render the reaction picker UI
     * @returns {Object} Lit HTML template
     */
    render () {
        const popular_emojis = api.settings.get('popular_reactions');
        
        return tplReactionPicker({
            picker_id: this.picker_id,
            dropup: this.dropup,
            shifted: this.shifted,
            closing: this.closing,
            allowed_emojis: this.allowed_emojis,
            popular_emojis,
            emoji_picker_state: this.emoji_picker_state,
            model: this.model,
            onEmojiSelected: (emoji) => this.onEmojiSelected(emoji),
            initEmojiPicker: () => this.initEmojiPicker()
        });
    }

    async initEmojiPicker () {
        if (!this.emoji_picker_state) {
            await api.emojis.initialize();
            
            const id = u.getUniqueId('emoji-picker');
            this.emoji_picker_state = new EmojiPicker({ id });
            
            u.initStorage(this.emoji_picker_state, id);
            
            await new Promise(resolve => this.emoji_picker_state.fetch({'success': resolve, 'error': resolve}));
            
            this.requestUpdate();
        }
    }

    onEmojiSelected (emoji) {
        sendReaction(this.model, emoji);
        this.close();
        
        const drop_down = this.querySelector('.dropdown-menu');
        if (drop_down && drop_down.classList.contains('show')) {
            const drop_down_btn = /** @type {HTMLElement} */ (this.querySelector('.dropdown-toggle'));
            if (drop_down_btn) {
                const drop_down_instance = BootstrapDropdown.getInstance(drop_down_btn);
                if (drop_down_instance) {
                    drop_down_instance.hide();
                }
            }
        }
    }
}

api.elements.define('converse-reaction-picker', ReactionPicker);
