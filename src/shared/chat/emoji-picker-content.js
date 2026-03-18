/**
 * @typedef {module:emoji-picker.EmojiPicker} EmojiPicker
 */
import { html } from 'lit';
import { converse, api, u } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { tplAllEmojis, tplSearchResults } from './templates/emoji-picker.js';
import { getTonedEmojis } from './utils.js';
import { FILTER_CONTAINS } from 'shared/autocomplete/utils.js';

const { sizzle } = converse.env;

export default class EmojiPickerContent extends CustomElement {
    static get properties () {
        return {
            'search_results': { type: Array },
            'current_skintone': { type: String },
            'model': { type: Object },
            'query': { type: String },
            'allowed_emojis': { type: Array },
        };
    }

    constructor () {
        super();
        this.model = null;
        this.current_skintone = null;
        this.query = null;
        this.search_results = null;
        this.allowed_emojis = null;
    }

    render () {
        const props = {
            'current_skintone': this.current_skintone,
            'insertEmoji': /** @param {MouseEvent} ev */(ev) => this.insertEmoji(ev),
            'query': this.query,
            'search_results': this.search_results,
            'shouldBeHidden': /** @param {string} shortname */(shortname) => this.shouldBeHidden(shortname),
        };
        return html` <div class="emoji-picker__lists">${tplSearchResults(props)} ${tplAllEmojis(props)}</div> `;
    }

    firstUpdated () {
        this.initIntersectionObserver();
    }

    initIntersectionObserver () {
        if (!window.IntersectionObserver) {
            return;
        }
        if (this.observer) {
            this.observer.disconnect();
        } else {
            const options = {
                root: this.querySelector('.emoji-picker__lists'),
                threshold: [0.1],
            };
            const handler = (ev) => this.setCategoryOnVisibilityChange(ev);
            this.observer = new IntersectionObserver(handler, options);
        }
        sizzle('.emoji-picker', this).forEach((a) => this.observer.observe(a));
    }

    setCategoryOnVisibilityChange (entries) {
        const selected = /** @type {EmojiPicker} */(this.parentElement).navigator.selected;
        const intersection_with_selected = entries.filter((i) => i.target.contains(selected)).pop();
        let current;
        // Choose the intersection that contains the currently selected
        // element, or otherwise the one with the largest ratio.
        if (intersection_with_selected) {
            current = intersection_with_selected;
        } else {
            current = entries.reduce((p, c) => (c.intersectionRatio >= (p?.intersectionRatio || 0) ? c : p), null);
        }
        if (current && current.isIntersecting) {
            const category = current.target.getAttribute('data-category');
            if (category !== this.model.get('current_category')) {
                /** @type {EmojiPicker} */(this.parentElement).preserve_scroll = true;
                u.safeSave(this.model, { 'current_category': category });
            }
        }
    }

    /**
     * @param {MouseEvent} ev
     */
    insertEmoji (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const target = /** @type {HTMLElement} */(ev.target);
        const emoji_el = target.nodeName === 'IMG' ? target.parentElement : target;
        /** @type EmojiPicker */(this.parentElement).selectEmoji(emoji_el.getAttribute('data-emoji'));
    }

    /**
     * Helper method for the template which decides whether an
     * emoji should be hidden.
     * It filters based on:
     * - Whether the emoji is allowed (if restrictions apply)
     * - The current skin tone
     * - The current search query
     *
     * @param {string} shortname
     * @returns {boolean}
     */
    shouldBeHidden (shortname) {
        if (this.allowed_emojis && this.allowed_emojis.length > 0) {
            const unicode = u.shortnamesToEmojis(shortname);
            if (!this.allowed_emojis.includes(unicode)) {
                return true;
            }
        }

        if (shortname.includes('_tone')) {
            if (!this.current_skintone || !shortname.includes(this.current_skintone)) {
                return true;
            }
        } else {
            if (this.current_skintone && getTonedEmojis().includes(shortname)) {
                return true;
            }
        }
        if (this.query && !FILTER_CONTAINS(shortname, this.query)) {
            return true;
        }
        return false;
    }
}

api.elements.define('converse-emoji-picker-content', EmojiPickerContent);
