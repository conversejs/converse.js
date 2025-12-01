/**
 * @module converse-reaction-picker
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description
 * LitElement custom component for the reaction picker UI
 * Displays popular emojis for quick selection and a dropdown for full emoji picker
 * 
 * Features:
 * - Quick access to popular emojis (👍, ❤️, 😂, 😮)
 * - Full emoji picker dropdown with search and categories
 * - Lazy-loads emoji picker for better performance
 * - Dispatches 'reactionSelected' event when emoji is chosen
 */

import { CustomElement } from 'shared/components/element.js';
import { html } from 'lit';
import { api, u, EmojiPicker } from '@converse/headless';
import { __ } from 'i18n';
import 'shared/components/dropdown.js'; // Ensure dropdown styles/scripts are loaded
import 'shared/chat/emoji-picker.js'; // Ensure emoji picker component is loaded
import 'shared/chat/styles/emoji.scss'; // Import emoji picker styles
import './reaction-picker.scss';

/**
 * Popular emojis shown in the quick picker
 * These are the most commonly used reactions across messaging platforms
 */
const POPULAR_EMOJIS = [
    ':thumbsup:',  // 👍
    ':heart:',     // ❤️
    ':joy:',       // 😂
    ':open_mouth:' // 😮
];

/**
 * ReactionPicker Component
 * @extends CustomElement
 * @fires reactionSelected - Dispatched when user selects an emoji
 */
export default class ReactionPicker extends CustomElement {

    /**
     * Define reactive properties for the component
     * @returns {Object} Property definitions
     * 
     * Properties:
     * - target: The button element that triggered the picker (for positioning)
     * - model: The message model being reacted to
     * - emoji_picker_state: State model for the full emoji picker
     */
    static get properties () {
        return {
            'target': { type: Object },
            'model': { type: Object },
            'emoji_picker_state': { type: Object },
            'allowed_emojis': { type: Array }
        };
    }

    /**
     * Initialize component with default values
     */
    constructor () {
        super();
        this.target = null;
        this.model = null;
        this.emoji_picker_state = null;
        this.picker_id = u.getUniqueId('reaction-picker');
        this.allowed_emojis = null;
    }

    /**
     * Render the reaction picker UI
     * @returns {Object} Lit HTML template
     * 
     * UI Structure:
     * - Popular emojis row (quick selection)
     * - Plus button with dropdown (full emoji picker)
     */
    render () {
        const anchor_name = `--reaction-anchor-${this.picker_id}`;
        const is_own_message = this.model?.get('sender') === 'me';
        
        // Don't show reaction picker on own messages
        if (is_own_message) {
            return '';
        }

        const popular_emojis = this.allowed_emojis ? 
            POPULAR_EMOJIS.filter(sn => this.allowed_emojis.includes(u.shortnamesToEmojis(sn))) : 
            POPULAR_EMOJIS;

        return html`
            <div class="reaction-picker popular">
                <!-- Popular emojis for quick selection -->
                ${popular_emojis.map(sn => html`
                    <button class="reaction-item" @click=${() => this.onEmojiSelected(sn)}>
                        ${u.shortnamesToEmojis(sn)}
                    </button>
                `)}
                
                <!-- Full emoji picker dropdown -->
                <div class="dropdown">
                    <button class="reaction-item more dropdown-toggle" 
                            type="button" 
                            id="${this.picker_id}-dropdown" 
                            style="anchor-name: ${anchor_name}"
                            data-bs-toggle="dropdown" 
                            aria-expanded="false"
                            @click=${this.initEmojiPicker}>
                        <converse-icon class="fas fa-plus" size="1em"></converse-icon>
                    </button>
                    <ul class="dropdown-menu" aria-labelledby="${this.picker_id}-dropdown" style="position-anchor: ${anchor_name}">
                        <li>
                            <!-- Lazy-loaded emoji picker component -->
                            ${this.emoji_picker_state ? html`
                                <converse-emoji-picker
                                    .state=${this.emoji_picker_state}
                                    .model=${this.model.collection.chatbox}
                                    .allowed_emojis=${this.allowed_emojis}
                                    @emojiSelected=${(ev) => this.onEmojiSelected(ev.detail.value)}
                                    ?render_emojis=${true}
                                    current_category="${this.emoji_picker_state.get('current_category') || ''}"
                                    current_skintone="${this.emoji_picker_state.get('current_skintone') || ''}"
                                    query="${this.emoji_picker_state.get('query') || ''}"
                                ></converse-emoji-picker>
                            ` : ''}
                        </li>
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Initialize the full emoji picker (lazy-loaded)
     * Only loads emoji data when user opens the dropdown
     * This improves initial performance
     * 
     * @async
     * @returns {Promise<void>}
     */
    async initEmojiPicker () {
        if (!this.emoji_picker_state) {
            // Initialize emoji data from API
            await api.emojis.initialize();
            
            // Create emoji picker state model
            const id = u.getUniqueId('emoji-picker');
            this.emoji_picker_state = new EmojiPicker({ id });
            
            // Initialize local storage for picker preferences
            u.initStorage(this.emoji_picker_state, id);
            
            // Fetch emoji data (categories, recent emojis, etc.)
            await new Promise(resolve => this.emoji_picker_state.fetch({'success': resolve, 'error': resolve}));
            
            // Trigger re-render to show the picker
            this.requestUpdate();
        }
    }

    /**
     * Handle emoji selection
     * Dispatches custom event and closes the dropdown
     * 
     * @param {string} emoji - The selected emoji (can be unicode or shortname)
     * @fires reactionSelected
     */
    onEmojiSelected (emoji) {
        // Dispatch event for parent component to handle
        this.dispatchEvent(new CustomEvent('reactionSelected', {
            detail: { emoji },
            bubbles: true,   // Allow event to bubble up
            composed: true   // Cross shadow DOM boundary
        }));
        
        // Close Bootstrap dropdown programmatically
        const dropdown = this.querySelector('.dropdown-menu');
        if (dropdown && dropdown.classList.contains('show')) {
            const dropdownBtn = /** @type {HTMLElement} */ (this.querySelector('.dropdown-toggle'));
            if (dropdownBtn) {
                // Use Bootstrap 5 API to properly hide dropdown
                const bootstrap = window.bootstrap;
                if (bootstrap && bootstrap.Dropdown) {
                    const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownBtn);
                    if (dropdownInstance) {
                        dropdownInstance.hide();
                    }
                }
            }
        }
    }
}

api.elements.define('converse-reaction-picker', ReactionPicker);
