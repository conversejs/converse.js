import "./emoji-picker-content.js";
import './emoji-dropdown.js';
import DOMNavigator from "shared/dom-navigator";
import debounce from 'lodash-es/debounce';
import { CustomElement } from 'shared/components/element.js';
import { KEYCODES } from '@converse/headless/shared/constants.js';
import { _converse, api, converse } from "@converse/headless/core";
import { getTonedEmojis } from './utils.js';
import { tpl_emoji_picker } from "./templates/emoji-picker.js";

import './styles/emoji.scss';

const u = converse.env.utils;


export default class EmojiPicker extends CustomElement {

    static get properties () {
        return {
            'chatview': { type: Object },
            'current_category': { type: String, 'reflect': true },
            'current_skintone': { type: String, 'reflect': true },
            'model': { type: Object },
            'query': { type: String, 'reflect': true },
            // This is an optimization, we lazily render the emoji picker, otherwise tests slow to a crawl.
            'render_emojis': { type: Boolean },
        }
    }

    firstUpdated () {
        super.firstUpdated();
        this.listenTo(this.model, 'change', o => this.onModelChanged(o.changed));
        this.initArrowNavigation();
    }

    constructor () {
        super();
        this.query = '';
        this._search_results = [];
        this.debouncedFilter = debounce(input => this.model.set({'query': input.value}), 250);
    }

    get search_results () {
        return this._search_results;
    }

    set search_results (value) {
        this._search_results = value;
        this.requestUpdate();
    }

    render () {
        return tpl_emoji_picker({
            'chatview': this.chatview,
            'current_category': this.current_category,
            'current_skintone': this.current_skintone,
            'model': this.model,
            'onCategoryPicked': ev => this.chooseCategory(ev),
            'onSearchInputBlurred': ev => this.chatview.emitFocused(ev),
            'onSearchInputFocus': ev => this.onSearchInputFocus(ev),
            'onSearchInputKeyDown': ev => this.onSearchInputKeyDown(ev),
            'onSkintonePicked': ev => this.chooseSkinTone(ev),
            'query': this.query,
            'search_results': this.search_results,
            'render_emojis': this.render_emojis,
            'sn2Emoji': shortname => u.shortnamesToEmojis(this.getTonedShortname(shortname))
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
        if (heading) {
            // +4 due to 2px padding on list elements
            el.scrollTop = heading.offsetTop - heading.offsetHeight*3 + 4;
        }
    }

    updateSearchResults (changed) {
        const old_query = changed.get('query');
        const contains = _converse.FILTER_CONTAINS;
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
        this.onGlobalKeyDown = ev => this._onGlobalKeyDown(ev);
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

    _onGlobalKeyDown (ev) {
        if (!this.navigator) {
            return;
        }
        if (ev.keyCode === KEYCODES.ENTER && u.isVisible(this)) {
            this.onEnterPressed(ev);
        } else if (ev.keyCode === KEYCODES.DOWN_ARROW &&
                !this.navigator.enabled &&
                u.isVisible(this)) {
            this.enableArrowNavigation(ev);
        } else if (ev.keyCode === KEYCODES.ESCAPE) {
            this.disableArrowNavigation();
            setTimeout(() => this.chatview.querySelector('.chat-textarea').focus(), 50);
        }
    }

    setCategoryForElement (el) {
        const old_category = this.current_category;
        const category = el?.getAttribute('data-category') || old_category;
        if (old_category !== category) {
            this.model.save({'current_category': category});
        }
    }

    insertIntoTextArea (value) {
        const autocompleting = this.model.get('autocompleting');
        const ac_position = this.model.get('ac_position');
        this.model.set({'autocompleting': null, 'query': '', 'ac_position': null});
        this.disableArrowNavigation();
        const jid = this.chatview.model.get('jid');
        const options = {
            'bubbles': true,
            'detail': { value, autocompleting, ac_position, jid }
        };
        this.dispatchEvent(new CustomEvent("emojiSelected", options));
    }

    chooseSkinTone (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target.nodeName === 'IMG' ? ev.target.parentElement : ev.target;
        const skintone = target.getAttribute("data-skintone").trim();
        if (this.current_skintone === skintone) {
            this.model.save({'current_skintone': ''});
        } else {
            this.model.save({'current_skintone': skintone});
        }
    }

    chooseCategory (ev) {
        ev.preventDefault && ev.preventDefault();
        ev.stopPropagation && ev.stopPropagation();
        const el = ev.target.matches('li') ? ev.target : u.ancestor(ev.target, 'li');
        this.setCategoryForElement(el);
        this.navigator.select(el);
        !this.navigator.enabled && this.navigator.enable();
    }

    onSearchInputKeyDown (ev) {
        if (ev.keyCode === KEYCODES.TAB) {
            if (ev.target.value) {
                ev.preventDefault();
                const match = converse.emojis.shortnames.find(sn => _converse.FILTER_CONTAINS(sn, ev.target.value));
                match && this.model.set({'query': match});
            } else if (!this.navigator.enabled) {
                this.enableArrowNavigation(ev);
            }
        } else if (ev.keyCode === KEYCODES.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        } else if (
            ev.keyCode !== KEYCODES.ENTER &&
            ev.keyCode !== KEYCODES.DOWN_ARROW
        ) {
            this.debouncedFilter(ev.target);
        }
    }

    onEnterPressed (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (converse.emojis.shortnames.includes(ev.target.value)) {
            this.insertIntoTextArea(ev.target.value);
        } else if (this.search_results.length === 1) {
            this.insertIntoTextArea(this.search_results[0].sn);
        } else if (this.navigator.selected && this.navigator.selected.matches('.insert-emoji')) {
            this.insertIntoTextArea(this.navigator.selected.getAttribute('data-emoji'));
        } else if (this.navigator.selected && this.navigator.selected.matches('.emoji-category')) {
            this.chooseCategory({'target': this.navigator.selected});
        }
    }

    onSearchInputFocus (ev) {
        this.chatview.emitBlurred(ev);
        this.disableArrowNavigation();
    }

    getTonedShortname (shortname) {
        if (getTonedEmojis().includes(shortname) && this.current_skintone) {
            return `${shortname.slice(0, shortname.length-1)}_${this.current_skintone}:`
        }
        return shortname;
    }

    initArrowNavigation () {
        if (!this.navigator) {
            const default_selector = 'li:not(.hidden):not(.emoji-skintone), .emoji-search';
            const options = {
                'jump_to_picked': '.emoji-category',
                'jump_to_picked_selector': '.emoji-category.picked',
                'jump_to_picked_direction': DOMNavigator.DIRECTION.down,
                'picked_selector': '.picked',
                'scroll_container': this.querySelector('.emoji-picker__lists'),
                'getSelector': direction => {
                    if (direction === DOMNavigator.DIRECTION.down) {
                        const c = this.navigator.selected && this.navigator.selected.getAttribute('data-category');
                        return c ? `ul[data-category="${c}"] li:not(.hidden):not(.emoji-skintone), .emoji-search` : default_selector;
                    } else {
                        return default_selector;
                    }
                },
                'onSelected': el => {
                    el.matches('.insert-emoji') && this.setCategoryForElement(el.parentElement);
                    el.matches('.insert-emoji, .emoji-category') && el.firstElementChild.focus();
                    el.matches('.emoji-search') && el.focus();
                }
            };
            this.navigator = new DOMNavigator(this, options);
        }
    }

    disableArrowNavigation () {
        this.navigator?.disable();
    }

    enableArrowNavigation (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.disableArrowNavigation();
        this.navigator.enable();
        this.navigator.handleKeydown(ev);
    }
}

api.elements.define('converse-emoji-picker', EmojiPicker);
