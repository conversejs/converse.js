/**
 * @module converse-emoji-views
 * @copyright 2013-2019, the Converse.js developers
 * @license Mozilla Public License (MPLv2)
 */

import "@converse/headless/converse-emoji";
import { debounce, find, get } from "lodash";
import DOMNavigator from "./dom-navigator";
import bootstrap from "bootstrap.native";
import tpl_emoji_button from "templates/emoji_button.html";
import tpl_emojis from "templates/emojis.html";

const { Backbone, sizzle } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-emoji-views', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ["converse-emoji", "converse-chatview", "converse-muc-views"],


    overrides: {
        ChatBoxView: {
            events: {
                'click .toggle-smiley': 'toggleEmojiMenu',
            },

            onEnterPressed () {
                if (this.emoji_dropdown && u.isVisible(this.emoji_dropdown.el.querySelector('.emoji-picker'))) {
                    this.emoji_dropdown.toggle();
                }
                this.__super__.onEnterPressed.apply(this, arguments);
            },

            onKeyDown (ev) {
                if (ev.keyCode === converse.keycodes.TAB) {
                    const value = u.getCurrentWord(ev.target, null, /(:.*?:)/g);
                    if (value.startsWith(':')) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        return this.autocompleteInPicker(ev.target, value);
                    }
                }
                return this.__super__.onKeyDown.call(this, ev);
            }
        },

        ChatRoomView: {
            events: {
                'click .toggle-smiley': 'toggleEmojiMenu'
            }
        }
    },


    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;
        const { __ } = _converse;

        _converse.api.settings.update({
            'use_system_emojis': true,
            'visible_toolbar_buttons': {
                'emoji': true
            },
        });


        const emoji_aware_chat_view = {

            async autocompleteInPicker (input, value) {
                await this.createEmojiDropdown();
                this.emoji_picker_view.model.set({
                    'autocompleting': value,
                    'position': input.selectionStart
                }, {'silent': true});
                this.emoji_picker_view.filter(value, true);
                this.emoji_dropdown.toggle();
            },

            async createEmojiPicker () {
                await _converse.api.emojis.initialize()

                const id = `converse.emoji-${_converse.bare_jid}-${this.model.get('jid')}`;
                const emojipicker = new _converse.EmojiPicker({'id': id});
                emojipicker.browserStorage = _converse.createStore(id);
                await new Promise(resolve => emojipicker.fetch({ 'success': resolve, 'error': resolve}));

                this.emoji_picker_view = new _converse.EmojiPickerView({
                    'model': emojipicker,
                    'chatview': this
                });
                const el = this.el.querySelector('.emoji-picker__container');
                el.innerHTML = '';
                el.appendChild(this.emoji_picker_view.el);
            },

            async createEmojiDropdown () {
                if (!this.emoji_dropdown) {
                    await this.createEmojiPicker();
                    const el = this.el.querySelector('.emoji-picker');
                    this.emoji_dropdown = new bootstrap.Dropdown(el, true);
                    this.emoji_dropdown.el = el;
                }
            },

            async toggleEmojiMenu (ev) {
                ev.stopPropagation();
                await this.createEmojiDropdown();
                this.emoji_dropdown.toggle();
                this.emoji_picker_view.setScrollPosition();
            }
        };
        Object.assign(_converse.ChatBoxView.prototype, emoji_aware_chat_view);


        _converse.EmojiPickerView = Backbone.VDOMView.extend({
            className: 'emoji-picker',
            events: {
                'click .emoji-picker__header li.emoji-category .pick-category': 'chooseCategory',
                'click .emoji-skintone-picker li.emoji-skintone': 'chooseSkinTone',
                'click .insert-emoji': 'insertEmoji',
                'focus .emoji-search': 'disableArrowNavigation',
                'keydown .emoji-search': 'onKeyDown'
            },

            initialize (config) {
                this.chatview = config.chatview;
                this.onGlobalKeyDown = ev => this._onGlobalKeyDown(ev);

                const body = document.querySelector('body');
                body.addEventListener('keydown', this.onGlobalKeyDown);

                this.search_results = [];
                this.debouncedFilter = debounce(input => this.filter(input.value), 150);
                this.listenTo(this.model, 'change:query', this.render)
                this.listenTo(this.model, 'change:current_skintone', this.render)
                this.listenTo(this.model, 'change:current_category', () => {
                    this.render();
                    const category = this.model.get('current_category');
                    const el = this.el.querySelector(`.emoji-category[data-category="${category}"]`);
                    this.navigator.select(el);
                    !this.navigator.enabled && this.navigator.enable();
                });
                this.render();
            },

            toHTML () {
                return tpl_emojis(
                    Object.assign(
                        this.model.toJSON(), {
                            '__': __,
                            '_converse': _converse,
                            'emoji_categories': _converse.emoji_categories,
                            'emojis_by_category': _converse.emojis.json,
                            'shouldBeHidden': shortname => this.shouldBeHidden(shortname),
                            'skintones': ['tone1', 'tone2', 'tone3', 'tone4', 'tone5'],
                            'toned_emojis': _converse.emojis.toned,
                            'transform': u.getEmojiRenderer(),
                            'transformCategory': shortname => u.getEmojiRenderer()(this.getTonedShortname(shortname)),
                            'search_results': this.search_results
                        }
                    )
                );
            },

            remove () {
                const body = document.querySelector('body');
                body.removeEventListener('keydown', this.onGlobalKeyDown);
                Backbone.VDOMView.prototype.remove.call(this);
            },

            afterRender () {
                this.initIntersectionObserver();
                this.initArrowNavigation();
            },

            initArrowNavigation () {
                if (!this.navigator) {
                    const default_selector = 'li:not(.hidden):not(.emoji-skintone), .emoji-search';
                    const options = {
                        'jump_to_picked': '.emoji-category',
                        'jump_to_picked_selector': '.emoji-category.picked',
                        'jump_to_picked_direction': DOMNavigator.DIRECTION.down,
                        'picked_selector': '.picked',
                        'scroll_container': this.el.querySelector('.emoji-picker__lists'),
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
                    this.navigator = new DOMNavigator(this.el, options);
                    this.listenTo(this.chatview.model, 'destroy', () => this.navigator.destroy());
                }
            },

            enableArrowNavigation (ev) {
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                this.disableArrowNavigation();
                this.navigator.enable();
                this.navigator.handleKeydown(ev);
            },

            disableArrowNavigation () {
                this.navigator.disable();
            },

            filter (value, set_property) {
                const old_query = this.model.get('query');
                if (!value) {
                    this.search_results = [];
                } else if (old_query && value.includes(old_query)) {
                    this.search_results = this.search_results.filter(e => _converse.FILTER_CONTAINS(e.sn, value));
                } else {
                    this.search_results = _converse.emojis_list.filter(e => _converse.FILTER_CONTAINS(e.sn, value));
                }
                this.model.set({'query': value});
                if (set_property) {
                    // XXX: Ideally we would set `query` on the model and
                    // then let the view re-render, instead of doing it
                    // manually here. Snabbdom supports setting properties,
                    // Backbone.VDOMView doesn't.
                    const input = this.el.querySelector('.emoji-search');
                    input.value = value;
                }
            },

            setCategoryForElement (el) {
                const category = el.getAttribute('data-category');
                const old_category = this.model.get('current_category');
                if (old_category !== category) {
                    this.model.save(
                        {'current_category': category},
                        {'silent': true}
                    );
                    const category_els = sizzle('.emoji-picker__header .emoji-category', this.el);
                    category_els.forEach(el => u.removeClass('picked', el));
                    const new_el = category_els.filter(el => el.getAttribute('data-category') === category).pop();
                    new_el && u.addClass('picked', new_el);
                }
            },

            setCategoryOnVisibilityChange (ev) {
                const selected = this.navigator.selected;
                const intersection_with_selected = ev.filter(i => i.target.contains(selected)).pop();
                let current;
                // Choose the intersection that contains the currently selected
                // element, or otherwise the one with the largest ratio.
                if (intersection_with_selected) {
                    current = intersection_with_selected;
                } else {
                    current = ev.reduce((p, c) => c.intersectionRatio >= get(p, 'intersectionRatio', 0) ? c : p, null);
                }
                current && current.isIntersecting && this.setCategoryForElement(current.target);
            },

            initIntersectionObserver () {
                if (!window.IntersectionObserver) {
                    return;
                }
                if (this.observer) {
                    this.observer.disconnect();
                } else {
                    const options = {
                        root: this.el.querySelector('.emoji-picker__lists'),
                        threshold: [0.1]
                    }
                    const handler = ev => this.setCategoryOnVisibilityChange(ev);
                    this.observer = new IntersectionObserver(handler, options);
                }
                sizzle('.emoji-picker', this.el).forEach(a => this.observer.observe(a));
            },

            insertIntoTextArea (value) {
                const replace = this.model.get('autocompleting');
                const position = this.model.get('position');
                this.model.set({'autocompleting': null, 'position': null});
                this.chatview.insertIntoTextArea(value, replace, false, position);
                if (this.chatview.emoji_dropdown) {
                    this.chatview.emoji_dropdown.toggle();
                }
                this.filter('', true);
                this.disableArrowNavigation();
            },

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
            },

            _onGlobalKeyDown (ev) {
                if (!this.navigator) {
                    return;
                }
                if (ev.keyCode === converse.keycodes.ENTER &&
                        this.navigator.selected &&
                        u.isVisible(this.el)) {
                    this.onEnterPressed(ev);
                } else if (ev.keyCode === converse.keycodes.DOWN_ARROW &&
                        !this.navigator.enabled &&
                        u.isVisible(this.el)) {
                    this.enableArrowNavigation(ev);
                }
            },

            onKeyDown (ev) {
                if (ev.keyCode === converse.keycodes.TAB) {
                    if (ev.target.value) {
                        ev.preventDefault();
                        const match = find(_converse.emoji_shortnames, sn => _converse.FILTER_CONTAINS(sn, ev.target.value));
                        match && this.filter(match, true);
                    } else if (!this.navigator.enabled) {
                        this.enableArrowNavigation(ev);
                    }
                } else if (ev.keyCode === converse.keycodes.DOWN_ARROW && !this.navigator.enabled) {
                    this.enableArrowNavigation(ev);
                } else if (ev.keyCode === converse.keycodes.ENTER) {
                    this.onEnterPressed(ev);
                } else if (
                    ev.keyCode !== converse.keycodes.ENTER &&
                    ev.keyCode !== converse.keycodes.DOWN_ARROW
                ) {
                    this.debouncedFilter(ev.target);
                }
            },

            shouldBeHidden (shortname) {
                // Helper method for the template which decides whether an
                // emoji should be hidden, based on which skin tone is
                // currently being applied.
                const current_skintone = this.model.get('current_skintone');
                if (shortname.includes('_tone')) {
                    if (!current_skintone || !shortname.includes(current_skintone)) {
                        return true;
                    }
                } else {
                    if (current_skintone && _converse.emojis.toned.includes(shortname)) {
                        return true;
                    }
                }
                const query = this.model.get('query');
                if (query && !_converse.FILTER_CONTAINS(shortname, query)) {
                    return true;
                }
                return false;
            },

            getTonedShortname (shortname) {
                if (_converse.emojis.toned.includes(shortname) && this.model.get('current_skintone')) {
                    return `${shortname.slice(0, shortname.length-1)}_${this.model.get('current_skintone')}:`
                }
                return shortname;
            },

            chooseSkinTone (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                const target = ev.target.nodeName === 'IMG' ?
                    ev.target.parentElement : ev.target;
                const skintone = target.getAttribute("data-skintone").trim();
                if (this.model.get('current_skintone') === skintone) {
                    this.model.save({'current_skintone': ''});
                } else {
                    this.model.save({'current_skintone': skintone});
                }
            },

            chooseCategory (ev) {
                ev.preventDefault && ev.preventDefault();
                ev.stopPropagation && ev.stopPropagation();
                const input = this.el.querySelector('.emoji-search');
                input.value = '';
                const el = ev.target.matches('li') ? ev.target : u.ancestor(ev.target, 'li');
                this.setCategoryForElement(el);
                this.navigator.select(el);
                this.setScrollPosition();
            },

            setScrollPosition () {
                const category = this.model.get('current_category');
                const el = this.el.querySelector('.emoji-picker__lists');
                const heading = this.el.querySelector(`#emoji-picker-${category}`);
                if (heading) {
                    // +4 due to 2px padding on list elements
                    el.scrollTop = heading.offsetTop - heading.offsetHeight*3 + 4;
                }
            },

            insertEmoji (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                const target = ev.target.nodeName === 'IMG' ? ev.target.parentElement : ev.target;
                const replace = this.model.get('autocompleting');
                const position = this.model.get('position');
                this.model.set({'autocompleting': null, 'position': null});
                this.chatview.insertIntoTextArea(target.getAttribute('data-emoji'), replace, false, position);
                this.chatview.emoji_dropdown.toggle();
                this.filter('', true);
            }
        });


        /************************ BEGIN Event Handlers ************************/

        _converse.api.listen.on('chatBoxClosed', view => view.emoji_picker_view && view.emoji_picker_view.remove());

        _converse.api.listen.on('renderToolbar', view => {
            if (_converse.visible_toolbar_buttons.emoji) {
                const html = tpl_emoji_button({'tooltip_insert_smiley': __('Insert emojis')});
                view.el.querySelector('.chat-toolbar').insertAdjacentHTML('afterBegin', html);
            }
        });

        _converse.api.listen.on('headlinesBoxInitialized', () => _converse.api.emojis.initialize());
        _converse.api.listen.on('chatRoomInitialized', () => _converse.api.emojis.initialize());
        _converse.api.listen.on('chatBoxInitialized', () => _converse.api.emojis.initialize());

        /************************ END Event Handlers ************************/
    }
});
