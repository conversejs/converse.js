/**
 * @module converse-reaction-picker
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */

/**
 * @typedef {import('@converse/headless/types/shared/message').default} BaseMessage
 * @typedef {import('@converse/headless/types/shared/types').ChatBoxOrMUC} ChatBoxOrMUC
 */
import { CustomElement } from 'shared/components/element.js';
import { api, u, _converse, EmojiPicker } from '@converse/headless';
import { __ } from 'i18n';
import tplReactionPicker from './templates/reaction-picker.js';
import { sendReaction } from './utils.js';
import 'shared/components/dropdown.js';
import 'shared/chat/emoji-picker.js';
import 'shared/chat/styles/emoji.scss';
import './reaction-picker.scss';

export default class ReactionPicker extends CustomElement {
    static get properties() {
        return {
            'model': { type: Object },
            'dropup': { type: Boolean },
            'shifted': { type: Boolean },
            'opened': { type: Boolean },
        };
    }

    /** @type {DOMRect|null} */
    #anchor_rect = null;

    constructor() {
        super();
        /** @type {BaseMessage|null} */
        this.model = null;
        this.picker_id = u.getUniqueId('reaction-picker');
        this.dropup = false;
        this.shifted = false;
        this.opened = false;
        this.onClickOutside =
            /** @param {MouseEvent} ev */
            (ev) => {
                const click_target = /** @type {Node} */ (ev.target);
                if (!this.contains(click_target)) {
                    this.close();
                }
            };
    }

    /**
     * Render the reaction picker UI
     * @returns {import('lit').TemplateResult|''}
     */
    render() {
        return this.opened ? tplReactionPicker(this) : '';
    }

    updated(changed) {
        super.updated(changed);
        if (changed.has('opened')) {
            if (this.opened) {
                requestAnimationFrame(() => {
                    this.positionPicker();
                    document.addEventListener('click', this.onClickOutside);
                });
            } else {
                document.removeEventListener('click', this.onClickOutside);
            }
        }
    }

    /**
     * @param {MouseEvent} ev - The click event that triggered opening
     */
    async open(ev) {
        const btn = /** @type {HTMLElement} */ (ev.currentTarget ?? ev.target);
        this.#anchor_rect = btn?.getBoundingClientRect() ?? null;
        await api.emojis.initialize();
        this.opened = true;
    }

    close() {
        if (!this.opened) return;
        this.#anchor_rect = null;
        this.opened = false;
    }

    positionPicker() {
        if (!this.opened) return;

        const offset_parent = /** @type {HTMLElement} */ (this.offsetParent ?? this.parentElement);
        if (!offset_parent) return;

        // Use the anchor button rect if provided, otherwise fall back to this element's rect.
        const anchor = this.#anchor_rect ?? this.getBoundingClientRect();

        const dropup = window.innerHeight - anchor.bottom < 150;
        if (dropup !== this.dropup) {
            this.dropup = dropup;
            // Wait for Lit to re-render with the updated dropup class before applying
            // inline styles, to avoid a one-frame inconsistency.
            this.updateComplete.then(() => this.#applyPickerStyles(offset_parent, anchor, dropup));
            return;
        }

        this.#applyPickerStyles(offset_parent, anchor, dropup);
    }

    /**
     * Writes positioning styles onto the inner picker element.
     * Only updates a style property when its value actually changes,
     * avoiding unnecessary style recalculations.
     * @param {HTMLElement} offset_parent
     * @param {DOMRect} anchor
     * @param {boolean} dropup
     */
    #applyPickerStyles(offset_parent, anchor, dropup) {
        const picker = /** @type {HTMLElement} */ (this.querySelector('.reaction-picker'));
        if (!picker) return;

        // Convert anchor viewport coordinates to offset-parent-relative coordinates.
        const parent_rect = offset_parent.getBoundingClientRect();
        const right = parent_rect.right - anchor.right;

        /** @param {string} prop @param {string} val */
        const set = (prop, val) => {
            if (picker.style[prop] !== val) picker.style[prop] = val;
        };

        set('position', 'absolute');
        set('left', 'auto');
        set('right', `${right}px`);

        if (dropup) {
            const bottom = parent_rect.bottom - anchor.top;
            set('top', 'auto');
            set('bottom', `${bottom}px`);
        } else {
            const top = anchor.bottom - parent_rect.top;
            set('bottom', 'auto');
            set('top', `${top}px`);
        }
    }

    /**
     * @returns {string[]|undefined}
     */
    get allowed_emojis() {
        /** @type {ChatBoxOrMUC|undefined} */
        const chatbox = this.model?.collection?.chatbox;
        return chatbox?.get('allowed_reactions');
    }

    /**
     * Initialize the emoji picker for this chat if it doesn't exist
     * @returns {Promise<void>}
     */
    async initEmojiPicker() {
        /** @type {ChatBoxOrMUC|undefined} */
        const chatbox = this.model?.collection?.chatbox;
        if (!chatbox) return;
        if (!chatbox.emoji_picker) {
            await api.emojis.initialize();

            const bare_jid = _converse.session.get('bare_jid');
            const id = `converse.emoji-${bare_jid}-${chatbox.get('jid')}`;
            chatbox.emoji_picker = new EmojiPicker({ id });
            u.initStorage(chatbox.emoji_picker, id);
            await new Promise((resolve) => chatbox.emoji_picker.fetch({ 'success': resolve, 'error': resolve }));

            this.requestUpdate();
        }
    }

    /**
     * @param {string} emoji - The selected emoji
     */
    onEmojiSelected(emoji) {
        if (!this.model) return;
        sendReaction(this.model, emoji);
        this.close();
    }
}

api.elements.define('converse-reaction-picker', ReactionPicker);
