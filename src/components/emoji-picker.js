import DOMNavigator from "../dom-navigator";
import sizzle from 'sizzle';
import tpl_emoji_picker from "../templates/emoji_picker.js";
import { CustomElement } from './element.js';
import { _converse, converse } from "@converse/headless/converse-core";
import { debounce, find } from "lodash-es";

const u = converse.env.utils;


export class EmojiPicker extends CustomElement {

    static get properties () {
        return {
            'chatview': { type: Object },
            'current_category': { type: String },
            'current_skintone': { type: String },
            'model': { type: Object },
            'query': { type: String },
        }
    }

    constructor () {
        super();
        this.debouncedFilter = debounce(input => this.model.set({'query': input.value}), 500);
        this.preserve_scroll = false;
        this._search_results = [];
        this.onGlobalKeyDown = ev => this._onGlobalKeyDown(ev);
        const body = document.querySelector('body');
        body.addEventListener('keydown', this.onGlobalKeyDown);
    }

    render () {
        return tpl_emoji_picker({
            'current_category': this.current_category,
            'current_skintone': this.current_skintone,
            'onCategoryPicked': ev => this.chooseCategory(ev),
            'onEmojiPicked': ev => this.insertEmoji(ev),
            'onSearchInputBlurred': ev => this.chatview.emitFocused(ev),
            'onSearchInputFocus': ev => this.onSearchInputFocus(ev),
            'onSearchInputKeyDown': ev => this.onKeyDown(ev),
            'onSkintonePicked': ev => this.chooseSkinTone(ev),
            'query': this.query,
            'search_results': this.search_results,
            'shouldBeHidden': shortname => this.shouldBeHidden(shortname),
            'transformCategory': shortname => u.shortnamesToEmojis(this.getTonedShortname(shortname))
        });
    }

    firstUpdated () {
        this.initArrowNavigation();
        this.initIntersectionObserver();
    }

    updated (changed) {
        if (changed.has('current_category') && !this.preserve_scroll) {
            this.setScrollPosition();
        }
    }

    get search_results () {
        const contains = _converse.FILTER_CONTAINS;
        if (this.query) {
            if (this.query === this.old_query) {
                return this._search_results;
            } else if (this.old_query && this.query.includes(this.old_query)) {
                this._search_results = this._search_results.filter(e => contains(e.sn, this.query));
            } else {
                this._search_results = _converse.emojis_list.filter(e => contains(e.sn, this.query));
            }
            this.old_query = this.query;
        } else {
            this._search_results = [];
        }
        return this._search_results;
    }

    disconnectedCallback() {
        super.disconnectedCallback()
        const body = document.querySelector('body');
        body.removeEventListener('keydown', this.onGlobalKeyDown);
    }

    _onGlobalKeyDown (ev) {
        if (!this.navigator) {
            return;
        }
        if (ev.keyCode === converse.keycodes.ENTER &&
                this.navigator.selected &&
                u.isVisible(this)) {
            this.onEnterPressed(ev);
        } else if (ev.keyCode === converse.keycodes.DOWN_ARROW &&
                !this.navigator.enabled &&
                u.isVisible(this)) {
            this.enableArrowNavigation(ev);
        }
    }

    setCategoryForElement (el, preserve_scroll=false) {
        const old_category = this.current_category;
        const category = el.getAttribute('data-category') || old_category;
        if (old_category !== category) {
            this.preserve_scroll = preserve_scroll;
            this.model.save({'current_category': category});
        }
    }

    setCategoryOnVisibilityChange (ev) {
        const selected = this.navigator.selected;
        const intersection_with_selected = ev.filter(i => i.target.contains(selected)).pop();
        let current;
        // Choose the intersection that contains the currently selected
        // element, or otherwise the one with the largest ratio.
        if (intersection_with_selected) {
            current = intersection_with_selected;
        } else {
            current = ev.reduce((p, c) => c.intersectionRatio >= (p?.intersectionRatio || 0) ? c : p, null);
        }
        current && current.isIntersecting && this.setCategoryForElement(current.target, true);
    }

    insertIntoTextArea (value) {
        const replace = this.model.get('autocompleting');
        const position = this.model.get('position');
        this.model.set({'autocompleting': null, 'position': null});
        this.chatview.insertIntoTextArea(value, replace, false, position);
        if (this.chatview.emoji_dropdown) {
            this.chatview.emoji_dropdown.toggle();
        }
        this.model.set({'query': ''});
        this.disableArrowNavigation();
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

    insertEmoji (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target.nodeName === 'IMG' ? ev.target.parentElement : ev.target;
        const replace = this.model.get('autocompleting');
        const position = this.model.get('position');
        this.model.set({'autocompleting': null, 'position': null});
        this.chatview.insertIntoTextArea(target.getAttribute('data-emoji'), replace, false, position);
        this.chatview.emoji_dropdown.toggle();
        this.model.set({'query': ''});
    }

    onKeyDown (ev) {
        if (ev.keyCode === converse.keycodes.TAB) {
            if (ev.target.value) {
                ev.preventDefault();
                const match = find(_converse.emoji_shortnames, sn => _converse.FILTER_CONTAINS(sn, ev.target.value));
                match && this.model.set({'query': match});
            } else if (!this.navigator.enabled) {
                this.enableArrowNavigation(ev);
            }
        } else if (ev.keyCode === converse.keycodes.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        } else if (ev.keyCode === converse.keycodes.ENTER) {
            this.onEnterPressed(ev);
        } else if (ev.keyCode === converse.keycodes.ESCAPE) {
            this.chatview.el.querySelector('.chat-textarea').focus();
            ev.stopPropagation();
            ev.preventDefault();
        } else if (
            ev.keyCode !== converse.keycodes.ENTER &&
            ev.keyCode !== converse.keycodes.DOWN_ARROW
        ) {
            this.debouncedFilter(ev.target);
        }
    }

    onEnterPressed (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (_converse.emoji_shortnames.includes(ev.target.value)) {
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

    shouldBeHidden (shortname) {
        // Helper method for the template which decides whether an
        // emoji should be hidden, based on which skin tone is
        // currently being applied.
        if (shortname.includes('_tone')) {
            if (!this.current_skintone || !shortname.includes(this.current_skintone)) {
                return true;
            }
        } else {
            if (this.current_skintone && _converse.emojis.toned.includes(shortname)) {
                return true;
            }
        }
        if (this.query && !_converse.FILTER_CONTAINS(shortname, this.query)) {
            return true;
        }
        return false;
    }

    getTonedShortname (shortname) {
        if (_converse.emojis.toned.includes(shortname) && this.current_skintone) {
            return `${shortname.slice(0, shortname.length-1)}_${this.current_skintone}:`
        }
        return shortname;
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
                threshold: [0.1]
            }
            const handler = ev => this.setCategoryOnVisibilityChange(ev);
            this.observer = new IntersectionObserver(handler, options);
        }
        sizzle('.emoji-picker', this).forEach(a => this.observer.observe(a));
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
        this.navigator.disable();
    }

    enableArrowNavigation (ev) {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        this.disableArrowNavigation();
        this.navigator.enable();
        this.navigator.handleKeydown(ev);
    }

    setScrollPosition () {
        const el = this.querySelector('.emoji-lists__container--browse');
        const heading = this.querySelector(`#emoji-picker-${this.current_category}`);
        if (heading) {
            // +4 due to 2px padding on list elements
            el.scrollTop = heading.offsetTop - heading.offsetHeight*3 + 4;
        }
    }
}

window.customElements.define('converse-emoji-picker', EmojiPicker);
