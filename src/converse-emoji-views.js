// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/**
 * @module converse-emoji-views
 */

import "@converse/headless/converse-emoji";
import BrowserStorage from "backbone.browserStorage";
import bootstrap from "bootstrap.native";
import tpl_emoji_button from "templates/emoji_button.html";
import tpl_emojis from "templates/emojis.html";
const { Backbone, _ } = converse.env;
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
    dependencies: ["converse-emoji", "converse-chatview"],


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

            createEmojiPicker () {
                if (_converse.emojipicker === undefined) {
                    const storage = _converse.config.get('storage'),
                          id = `converse.emoji-${_converse.bare_jid}`;
                    _converse.emojipicker = new _converse.EmojiPicker({'id': id});
                    _converse.emojipicker.browserStorage = new BrowserStorage[storage](id);
                    _converse.emojipicker.fetch();
                }
                this.emoji_picker_view = new _converse.EmojiPickerView({'model': _converse.emojipicker});
                this.emoji_picker_view.chatview = this;
            },

            async toggleEmojiMenu (ev) {
                if (this.emoji_dropdown === undefined) {
                    ev.stopPropagation();
                    const dropdown_el = this.el.querySelector('.toggle-smiley.dropup');
                    this.emoji_dropdown = new bootstrap.Dropdown(dropdown_el, true);
                    this.emoji_dropdown.el = dropdown_el;
                    this.emoji_dropdown.toggle();
                    await _converse.api.waitUntil('emojisInitialized');
                    this.emoji_picker_view.render();
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
                'click .toggle-smiley ul.emoji-picker li': 'insertEmoji',
                'keydown .emoji-search': 'onKeyDown'
            },

            initialize () {
                this.debouncedFilter = _.debounce(input => this.filter(input), 50);
                this.model.on('change:query', this.render, this);
                this.model.on('change:current_skintone', this.render, this);
                this.model.on('change:current_category', () => {
                    this.render();
                    this.setScrollPosition();
                });
                _converse.api.trigger('emojiPickerViewInitialized');
            },

            toHTML () {
                const html = tpl_emojis(
                    Object.assign(
                        this.model.toJSON(), {
                            '__': __,
                            '_converse': _converse,
                            'emoji_categories': _converse.emoji_categories,
                            'emojis_by_category': u.getEmojisByCategory(),
                            'shouldBeHidden': shortname => this.shouldBeHidden(shortname),
                            'skintones': ['tone1', 'tone2', 'tone3', 'tone4', 'tone5'],
                            'toned_emojis': _converse.emojis.toned,
                            'transform': u.getEmojiRenderer(),
                            'transformCategory': shortname => u.getEmojiRenderer()(this.getTonedShortname(shortname))
                        }
                    )
                );
                return html;
            },

            filter (input) {
                this.model.set({'query': input.value});
            },

            onKeyDown (ev) {
                if (ev.keyCode === _converse.keycodes.TAB) {
                    ev.preventDefault();
                    const match = _.find(_converse.emoji_shortnames, sn => _converse.FILTER_CONTAINS(sn, ev.target.value));
                    if (match) {
                        // XXX: Ideally we would set `query` on the model and
                        // then let the view re-render, instead of doing it
                        // manually here. Snabbdom supports setting properties,
                        // Backbone.VDOMView doesn't.
                        ev.target.value = match;
                        this.filter(ev.target);
                    }
                } else if (ev.keyCode === _converse.keycodes.ENTER) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (_converse.emoji_shortnames.includes(ev.target.value)) {
                        this.chatview.insertIntoTextArea(ev.target.value);
                        this.chatview.emoji_dropdown.toggle();
                        // XXX: See above
                        ev.target.value = '';
                        this.filter(ev.target);
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
            },

            setScrollPosition () {
                const category = this.model.get('current_category');
                const el = this.el.querySelector('.emoji-picker__lists');
                const heading = this.el.querySelector(`#emoji-picker-${category}`);
                el.scrollTop = heading.offsetTop - heading.offsetHeight*2;
            },

            insertEmoji (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                const target = ev.target.nodeName === 'IMG' ? ev.target.parentElement : ev.target;
                this.chatview.insertIntoTextArea(target.getAttribute('data-emoji'));
                this.chatview.emoji_dropdown.toggle();
                // XXX: See above
                const input = this.el.querySelector('.emoji-search');
                input.value = '';
                this.filter(input);
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
