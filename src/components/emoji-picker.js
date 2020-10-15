import "./emoji-picker-content.js";
import DOMNavigator from "../dom-navigator";
import { BaseDropdown } from "./dropdown.js";
import { CustomElement } from './element.js';
import { __ } from '../i18n';
import { _converse, api, converse } from "@converse/headless/converse-core";
import { debounce } from "lodash-es";
import { html } from "lit-element";
import { tpl_emoji_picker } from "../templates/emoji_picker.js";
import { until } from 'lit-html/directives/until.js';

const u = converse.env.utils;


export default class EmojiPicker extends CustomElement {

    static get properties () {
        return {
            'chatview': { type: Object },
            'current_category': { type: String, 'reflect': true },
            'current_skintone': { type: String, 'reflect': true },
            'model': { type: Object },
            'query': { type: String, 'reflet': true },
            // This is an optimization, we lazily render the emoji picker, otherwise tests slow to a crawl.
            'render_emojis': { type: Boolean },
        }
    }

    firstUpdated () {
        this.listenTo(this.model, 'change', o => this.onModelChanged(o.changed));
        this.initArrowNavigation();
    }

    constructor () {
        super();
        this._search_results = [];
        this.debouncedFilter = debounce(input => this.model.set({'query': input.value}), 250);
        this.registerEvents();
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
            'onSearchInputKeyDown': ev => this.onKeyDown(ev),
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
        this.requestUpdate();
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
        super.disconnectedCallback()
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

    setCategoryForElement (el) {
        const old_category = this.current_category;
        const category = el?.getAttribute('data-category') || old_category;
        if (old_category !== category) {
            this.model.save({'current_category': category});
        }
    }

    insertIntoTextArea (value) {
        this.chatview.onEmojiReceivedFromPicker(value);
        this.model.set({'autocompleting': null, 'query': '', 'ac_position': null});
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

    onKeyDown (ev) {
        if (ev.keyCode === converse.keycodes.TAB) {
            if (ev.target.value) {
                ev.preventDefault();
                const match = converse.emojis.shortnames.find(sn => _converse.FILTER_CONTAINS(sn, ev.target.value));
                match && this.model.set({'query': match});
            } else if (!this.navigator.enabled) {
                this.enableArrowNavigation(ev);
            }
        } else if (ev.keyCode === converse.keycodes.DOWN_ARROW && !this.navigator.enabled) {
            this.enableArrowNavigation(ev);
        } else if (ev.keyCode === converse.keycodes.ENTER) {
            this.onEnterPressed(ev);
        } else if (ev.keyCode === converse.keycodes.ESCAPE) {
            u.ancestor(this, 'converse-emoji-dropdown').hideMenu();
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
        if (ev.emoji_keypress_handled) {
            // Prevent the emoji from being inserted a 2nd time due to this
            // method being called by two event handlers: onKeyDown and _onGlobalKeyDown
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        ev.emoji_keypress_handled = true;
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
        if (converse.emojis.toned.includes(shortname) && this.current_skintone) {
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
        this.navigator.disable();
    }

    enableArrowNavigation (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.disableArrowNavigation();
        this.navigator.enable();
        this.navigator.handleKeydown(ev);
    }
}


export class EmojiDropdown extends BaseDropdown {

    static get properties() {
        return {
            chatview: { type: Object }
        };
    }

    constructor () {
        super();
        // This is an optimization, we lazily render the emoji picker, otherwise tests slow to a crawl.
        this.render_emojis = false;
    }

    initModel () {
        if (!this.init_promise) {
            this.init_promise = (async () => {
                await api.emojis.initialize()
                const id = `converse.emoji-${_converse.bare_jid}-${this.chatview.model.get('jid')}`;
                this.model = new _converse.EmojiPicker({'id': id});
                this.model.browserStorage = _converse.createStore(id);
                await new Promise(resolve => this.model.fetch({'success': resolve, 'error': resolve}));
                // We never want still be in the autocompleting state upon page load
                this.model.set({'autocompleting': null, 'ac_position': null});
            })();
        }
        return this.init_promise;
    }

    render() {
        return html`
            <div class="dropup">
                <button class="toggle-emojis"
                        title="${__('Insert emojis')}"
                        data-toggle="dropdown"
                        aria-haspopup="true"
                        aria-expanded="false">
                    <converse-icon
                        class="fa fa-smile "
                        path-prefix="${api.settings.get('assets_path')}"
                        size="1em"></converse-icon>
                </button>
                <div class="dropdown-menu">
                    ${until(this.initModel().then(() => html`
                        <converse-emoji-picker
                                .chatview=${this.chatview}
                                .model=${this.model}
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
            await this.requestUpdate();
        }
        super.showMenu();
        setTimeout(() => this.querySelector('.emoji-search')?.focus());
    }
}

api.elements.define('converse-emoji-dropdown', EmojiDropdown);
api.elements.define('converse-emoji-picker', EmojiPicker);
