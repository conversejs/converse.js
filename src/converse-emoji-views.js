// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/**
 * @module converse-emoji-views
 */

import "@converse/headless/converse-emoji";
import { debounce, find } from "lodash";
import BrowserStorage from "backbone.browserStorage";
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
            }
        },

        ChatRoomView: {
            events: {
                'click .toggle-smiley': 'toggleEmojiMenu'
            },

            onKeyDown (ev) {
                const { _converse } = this.__super__;
                if (ev.keyCode === _converse.keycodes.TAB) {
                    const value = u.getCurrentWord(ev.target, null, /(:.*?:)/g);
                    if (value.startsWith(':')) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        return this.autocompleteInPicker(ev.target, value);
                    }
                }
                return this.__super__.onKeyDown.call(this, ev);
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
                if (this.emoji_dropdown === undefined) {
                    this.createEmojiDropdown();
                }
                await _converse.api.waitUntil('emojisInitialized');
                this.emoji_picker_view.model.set({
                    'autocompleting': value,
                    'position': input.selectionStart
                }, {'silent': true});
                this.emoji_picker_view.filter(value, true);
                this.emoji_dropdown.toggle();
            },

            createEmojiPicker () {
                if (!_converse.emojipicker) {
                    const storage = _converse.config.get('storage'),
                          id = `converse.emoji-${_converse.bare_jid}`;
                    _converse.emojipicker = new _converse.EmojiPicker({'id': id});
                    _converse.emojipicker.browserStorage = new BrowserStorage[storage](id);
                    _converse.emojipicker.fetch();
                }
                this.emoji_picker_view = new _converse.EmojiPickerView({'model': _converse.emojipicker});
                this.emoji_picker_view.chatview = this;
            },

            createEmojiDropdown () {
                const dropdown_el = this.el.querySelector('.toggle-smiley.dropup');
                this.emoji_dropdown = new bootstrap.Dropdown(dropdown_el, true);
                this.emoji_dropdown.el = dropdown_el;
            },

            async toggleEmojiMenu (ev) {
                if (this.emoji_dropdown === undefined) {
                    ev.stopPropagation();
                    this.createEmojiDropdown();
                    this.emoji_dropdown.toggle();
                    await _converse.api.waitUntil('emojisInitialized');
                    this.emoji_picker_view.setScrollPosition();
                }
            },

            insertEmojiPicker () {
                const picker_el = this.el.querySelector('.emoji-picker');
                if (picker_el !== null) {
                    picker_el.innerHTML = '';
                    picker_el.appendChild(this.emoji_picker_view.el);
                }
            }
        };
        Object.assign(_converse.ChatBoxView.prototype, emoji_aware_chat_view);


        _converse.EmojiPickerView = Backbone.VDOMView.extend({
            className: 'emoji-picker__container',
            events: {
                'click .emoji-picker__header li.emoji-category': 'chooseCategory',
                'click .emoji-skintone-picker li.emoji-skintone': 'chooseSkinTone',
                'click .insert-emoji': 'insertEmoji',
                'keydown .emoji-search': 'onKeyDown'
            },

            async initialize () {
                this.search_results = [];
                this.debouncedFilter = debounce(input => this.filter(input.value), 150);
                this.listenTo(this.model, 'change:query', this.render)
                this.listenTo(this.model, 'change:current_skintone', this.render)
                this.listenTo(this.model, 'change:current_category', this.render)
                await _converse.api.waitUntil('emojisInitialized');
                this.render();
                _converse.api.trigger('emojiPickerViewInitialized');
            },

            toHTML () {
                const html = tpl_emojis(
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
                return html;
            },

            afterRender () {
                this.initIntersectionObserver();
                const textarea = this.el.querySelector('.emoji-search');
                textarea.addEventListener('focus', ev => this.chatview.emitFocused(ev));
                textarea.addEventListener('blur', ev => this.chatview.emitBlurred(ev));
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

            setCategoryOnVisibilityChange (ev) {
                const current = ev.filter(e => e.isIntersecting).pop();
                if (current) {
                    const category = current.target.getAttribute('data-category');
                    const old_category = this.model.get('current_category');
                    if (old_category !== category) {
                        // XXX: Manually set the classes, it's quicker than using the VDOM
                        this.model.set(
                            {'current_category': category},
                            {'silent': true}
                        );
                        const categories = sizzle('.emoji-picker__header .emoji-category', this.el);
                        const new_el = categories.filter(el => el.getAttribute('data-category') === category).pop();
                        const old_el = categories.filter(el => el.getAttribute('data-category') === old_category).pop();
                        new_el && u.addClass('picked', new_el);
                        old_el && u.removeClass('picked', old_el);
                    }
                }
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
                        rootMargin: '0px',
                        threshold: [0.1, 0.2, 0.3, 0.4, 0.5]
                    }
                    const handler = debounce((ev) => this.setCategoryOnVisibilityChange(ev), 200);
                    this.observer = new IntersectionObserver(handler, options);
                }
                sizzle('.emoji-picker', this.el).forEach(a => this.observer.observe(a));
            },

            insertIntoTextArea (value) {
                const replace = this.model.get('autocompleting');
                const position = this.model.get('position');
                this.model.set({'autocompleting': null, 'position': null});
                this.chatview.insertIntoTextArea(value, replace, false, position);
                this.chatview.emoji_dropdown.toggle();
                this.filter('', true);
            },

            onKeyDown (ev) {
                if (ev.keyCode === _converse.keycodes.TAB) {
                    ev.preventDefault();
                    const match = find(_converse.emoji_shortnames, sn => _converse.FILTER_CONTAINS(sn, ev.target.value));
                    if (match) {
                        this.filter(match, true);
                    }
                } else if (ev.keyCode === _converse.keycodes.ENTER) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (_converse.emoji_shortnames.includes(ev.target.value)) {
                        this.insertIntoTextArea(ev.target.value);
                    } else if (this.search_results.length === 1) {
                        this.insertIntoTextArea(this.search_results[0].sn);
                    }
                } else {
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
                ev.preventDefault();
                ev.stopPropagation();
                const target = ev.target.nodeName === 'IMG' ? ev.target.parentElement : ev.target;
                const category = target.getAttribute("data-category").trim();
                // XXX: See above
                const input = this.el.querySelector('.emoji-search');
                input.value = '';
                this.model.save({'current_category': category, 'query': undefined});
                this.setScrollPosition();
            },

            setScrollPosition () {
                const category = this.model.get('current_category');
                const el = this.el.querySelector('.emoji-picker__lists');
                const heading = this.el.querySelector(`#emoji-picker-${category}`);
                el.scrollTop = heading.offsetTop - heading.offsetHeight*3;
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
        _converse.api.listen.on('renderToolbar', view => {
            if (_converse.visible_toolbar_buttons.emoji) {
                const html = tpl_emoji_button({'tooltip_insert_smiley': __('Insert emojis')});
                view.el.querySelector('.chat-toolbar').insertAdjacentHTML('afterBegin', html);
                view.createEmojiPicker();
                view.insertEmojiPicker();
            }
        });
    }
});
