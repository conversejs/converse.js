/**
 * @module emoji-picker
 * @typedef {module:dom-navigator.DOMNavigatorOptions} DOMNavigatorOptions
 * @typedef {module:dom-navigator.DOMNavigatorDirection} DOMNavigatorDirection
 */
import debounce from 'lodash-es/debounce';
import { api, converse, u, constants } from "@converse/headless";
import DOMNavigator from "shared/dom-navigator";
import { CustomElement } from 'shared/components/element.js';
import { FILTER_CONTAINS } from "shared/autocomplete/utils.js";
import { getTonedEmojis } from './utils.js';
import { tplEmojiPicker } from "./templates/emoji-picker.js";
import "./emoji-picker-content.js";
import './emoji-dropdown.js';

import './styles/emoji.scss';

const { KEYCODES } = constants;


export default class EmojiPicker extends CustomElement {

    static get properties () {
        return {
            current_category: { type: String, 'reflect': true },
            current_skintone: { type: String, 'reflect': true },
            model: { type: Object },
            query: { type: String, 'reflect': true },
            state: { type: Object },
            // This is an optimization, we lazily render the emoji picker, otherwise tests slow to a crawl.
            render_emojis: { type: Boolean },
        }
    }

    constructor () {
        super();
        this.state = null;
        this.model = null;
        this.query = '';
        this.render_emojis = null;
        this._search_results = [];

        this.debouncedFilter = debounce(
            /** @param {HTMLInputElement} input */(input) => this.state.set({'query': input.value}),
            250
        );
    }

    initialize() {
        super.initialize();
        this.dropdown = this.closest('converse-emoji-dropdown');
    }

    firstUpdated (changed) {
        super.firstUpdated(changed);
        this.listenTo(this.state, 'change', o => this.onModelChanged(o.changed));
        this.initArrowNavigation();
    }

    get search_results () {
        return this._search_results;
    }

    set search_results (value) {
        this._search_results = value;
        this.requestUpdate();
    }

    render () {
        return tplEmojiPicker(this, {
            current_category: this.current_category,
            current_skintone: this.current_skintone,
            onCategoryPicked: ev => this.chooseCategory(ev),
            onSearchInputFocus: () => this.disableArrowNavigation(),
            onSearchInputKeyDown: ev => this.onSearchInputKeyDown(ev),
            onSkintonePicked: ev => this.chooseSkinTone(ev),
            query: this.query,
            search_results: this.search_results,
            render_emojis: this.render_emojis,
            sn2Emoji: /** @param {string} sn */(sn) => u.shortnamesToEmojis(this.getTonedShortname(sn))
        });
    }

    updated (changed) {
        changed.has('query') && this.updateSearchResults(changed);
        changed.has('current_category') && this.setScrollPosition();
    }

    onModelChanged (changed) {
        if ('current_category' in changed) this.current_category = changed.current_category;
        if ('current_skintone' in changed) this.current_skintone = changed.current_skintone;
        if ('query' in changed) this.query = changed.query;
    }

    setScrollPosition () {
        if (this.preserve_scroll) {
            this.preserve_scroll = false;
            return;
        }
        const el = this.querySelector('.emoji-lists__container--browse');
        const heading = this.querySelector(`#emoji-picker-${this.current_category}`);
        if (heading instanceof HTMLElement) {
            // +4 due to 2px padding on list elements
            el.scrollTop = heading.offsetTop - heading.offsetHeight*3 + 4;
        }
    }

    updateSearchResults (changed) {
        const old_query = changed.get('query');
        const contains = FILTER_CONTAINS;
        if (this.query) {
            if (this.query === old_query) {
                return this.search_results;
            } else if (old_query && this.query.includes(old_query)) {
                this.search_results = this.search_results.filter(e => contains(e.sn, this.query));
            } else {
                this.search_results = converse.emojis.list.filter(e => contains(e.sn, this.query));
            }
        } else if (this.search_results.length) {
            // Avoid re-rendering by only setting to new empty array if it wasn't empty before
            this.search_results = [];
        }
    }

    registerEvents () {
        this.onGlobalKeyDown = ev => this.#onGlobalKeyDown(ev);
        this.dropdown.addEventListener('hide.bs.dropdown', () => this.onDropdownHide());
        const body = document.querySelector('body');
        body.addEventListener('keydown', this.onGlobalKeyDown);
    }

    connectedCallback () {
        super.connectedCallback();
        this.registerEvents();
    }

    disconnectedCallback() {
        const body = document.querySelector('body');
        body.removeEventListener('keydown', this.onGlobalKeyDown);
        this.disableArrowNavigation();
        super.disconnectedCallback();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    #onGlobalKeyDown (ev) {
        if (!this.navigator) return;

        if (ev.keyCode === KEYCODES.ENTER && u.isVisible(this)) {
            this.onEnterPressed(ev);
        } else if (ev.keyCode === KEYCODES.DOWN_ARROW &&
                !this.navigator.enabled &&
                u.isVisible(this)) {
            this.enableArrowNavigation(ev);
        }
    }

    onDropdownHide() {
        this.disableArrowNavigation();
        this.dispatchEvent(new CustomEvent('emojipickerblur', {bubbles: true}));
    }

    /**
     * @param {HTMLElement} el
     */
    setCategoryForElement (el) {
        const old_category = this.current_category;
        const category = el?.getAttribute('data-category') || old_category;
        if (old_category !== category) {
            this.state.save({'current_category': category});
        }
    }

    /**
     * @param {string} value
     */
    insertIntoTextArea (value) {
        const autocompleting = this.state.get('autocompleting');
        const ac_position = this.state.get('ac_position');
        this.state.set({'autocompleting': null, 'query': '', 'ac_position': null});
        this.disableArrowNavigation();
        const jid = this.model.get('jid');
        const options = {
            'bubbles': true,
            'detail': { value, autocompleting, ac_position, jid }
        };
        this.dispatchEvent(new CustomEvent("emojiSelected", options));
    }

    /**
     * @param {MouseEvent} ev
     */
    chooseSkinTone (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const target = /** @type {Element} */(ev.target);
        const el = target.nodeName === 'IMG' ? target.parentElement : target;
        const skintone = el.getAttribute("data-skintone").trim();
        if (this.current_skintone === skintone) {
            this.state.save({'current_skintone': ''});
        } else {
            this.state.save({'current_skintone': skintone});
        }
    }

    /**
     * @param {MouseEvent} ev
     */
    chooseCategory (ev) {
        ev.preventDefault && ev.preventDefault();
        ev.stopPropagation && ev.stopPropagation();
        const target = /** @type {Element} */(ev.target ?? ev.relatedTarget);
        const el = target.matches('li') ? target : u.ancestor(target, 'li');
        this.setCategoryForElement(el);
        this.navigator.select(el);
        !this.navigator.enabled && this.navigator.enable();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onSearchInputKeyDown (ev) {
        const target = /** @type {HTMLInputElement} */(ev.target);
        if (ev.keyCode === KEYCODES.TAB) {
            if (target.value) {
                ev.preventDefault();
                const match = converse.emojis.shortnames.find(sn => FILTER_CONTAINS(sn, target.value));
                match && this.state.set({'query': match});
            } else if (!this.navigator.enabled) {
                this.enableArrowNavigation(ev);
            }
        } else if (ev.keyCode === KEYCODES.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        } else if (
            ev.keyCode !== KEYCODES.ENTER &&
            ev.keyCode !== KEYCODES.DOWN_ARROW
        ) {
            this.debouncedFilter(target);
        }
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onEnterPressed (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const target = /** @type {HTMLInputElement} */(ev.target);
        if (converse.emojis.shortnames.includes(target.value)) {
            this.insertIntoTextArea(target.value);
        } else if (this.search_results.length === 1) {
            this.insertIntoTextArea(this.search_results[0].sn);
        } else if (this.navigator.selected && this.navigator.selected.matches('.insert-emoji')) {
            this.insertIntoTextArea(this.navigator.selected.getAttribute('data-emoji'));
        } else if (this.navigator.selected && this.navigator.selected.matches('.emoji-category')) {
            this.chooseCategory(new MouseEvent('click', {relatedTarget: this.navigator.selected}));
        }
    }

    /**
     * @param {string} shortname
     */
    getTonedShortname (shortname) {
        if (getTonedEmojis().includes(shortname) && this.current_skintone) {
            return `${shortname.slice(0, shortname.length-1)}_${this.current_skintone}:`
        }
        return shortname;
    }

    initArrowNavigation () {
        if (!this.navigator) {
            const default_selector = 'li:not(.hidden):not(.emoji-skintone), .emoji-search';
            const options = /** @type DOMNavigatorOptions */({
                jump_to_picked: '.emoji-category',
                jump_to_picked_selector: '.emoji-category.picked',
                jump_to_picked_direction: DOMNavigator.DIRECTION.down,
                picked_selector: '.picked',
                scroll_container: this.querySelector('.emoji-picker__lists'),
                getSelector: /** @param {keyof(DOMNavigatorDirection)} dir */(dir) => {
                    if (dir === DOMNavigator.DIRECTION.down) {
                        const c = this.navigator.selected && this.navigator.selected.getAttribute('data-category');
                        return c ? `ul[data-category="${c}"] li:not(.hidden):not(.emoji-skintone), .emoji-search` : default_selector;
                    } else {
                        return default_selector;
                    }
                },
                onSelected: /** @param {HTMLElement} el */(el) => {
                    if (el.matches('.insert-emoji')) this.setCategoryForElement(el.parentElement);
                    if (el.matches('.insert-emoji, .emoji-category')) {
                        /** @type {HTMLInputElement} */(el.firstElementChild).focus();
                    }
                    if (el.matches('.emoji-search')) el.focus();
                }
            });
            this.navigator = new DOMNavigator(this, options);
        }
    }

    disableArrowNavigation () {
        this.navigator?.disable();
    }

    /**
     * @param {KeyboardEvent} ev
     */
    enableArrowNavigation (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.disableArrowNavigation();
        this.navigator.enable();
        this.navigator.handleKeydown(ev);
    }
}

api.elements.define('converse-emoji-picker', EmojiPicker);
