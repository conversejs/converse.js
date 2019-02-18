// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

// This plugin started as a fork of Lea Verou's Awesomplete
// https://leaverou.github.io/awesomplete/


import converse from "@converse/headless/converse-core";

const { _, Backbone } = converse.env,
      u = converse.env.utils;


converse.plugins.add("converse-autocomplete", {

    initialize () {
        const { _converse } = this;

        _converse.FILTER_CONTAINS = function (text, input) {
            return RegExp(helpers.regExpEscape(input.trim()), "i").test(text);
        };

        _converse.FILTER_STARTSWITH = function (text, input) {
            return RegExp("^" + helpers.regExpEscape(input.trim()), "i").test(text);
        };

        const SORT_BYLENGTH = function (a, b) {
            if (a.length !== b.length) {
                return a.length - b.length;
            }
            return a < b? -1 : 1;
        };

        const ITEM = (text, input) => {
            input = input.trim();
            const element = document.createElement("li");
            element.setAttribute("aria-selected", "false");

            const regex = new RegExp("("+input+")", "ig");
            const parts = input ? text.split(regex) : [text];
            parts.forEach((txt) => {
                if (input && txt.match(regex)) {
                    const match = document.createElement("mark");
                    match.textContent = txt;
                    element.appendChild(match);
                } else {
                    element.appendChild(document.createTextNode(txt));
                }
            });
            return element;
        };


        class AutoComplete {

            constructor (el, config={}) {
                this.is_opened = false;

                if (u.hasClass('.suggestion-box', el)) {
                    this.container = el;
                } else {
                    this.container = el.querySelector('.suggestion-box');
                }
                this.input = this.container.querySelector('.suggestion-box__input');
                this.input.setAttribute("autocomplete", "off");
                this.input.setAttribute("aria-autocomplete", "list");

                this.ul = this.container.querySelector('.suggestion-box__results');
                this.status = this.container.querySelector('.suggestion-box__additions');

                _.assignIn(this, {
                    'match_current_word': false, // Match only the current word, otherwise all input is matched
                    'match_on_tab': false, // Whether matching should only start when tab's pressed
                    'trigger_on_at': false, // Whether @ should trigger autocomplete
                    'min_chars': 2,
                    'max_items': 10,
                    'auto_evaluate': true,
                    'auto_first': false,
                    'data': _.identity,
                    'filter': _converse.FILTER_CONTAINS,
                    'sort': config.sort === false ? false : SORT_BYLENGTH,
                    'item': ITEM
                }, config);

                this.index = -1;

                this.bindEvents()

                if (this.input.hasAttribute("list")) {
                    this.list = "#" + this.input.getAttribute("list");
                    this.input.removeAttribute("list");
                } else {
                    this.list = this.input.getAttribute("data-list") || config.list || [];
                }
            }

            bindEvents () {
                // Bind events
                const input = {
                    "blur": () => this.close({'reason': 'blur'})
                }
                if (this.auto_evaluate) {
                    input["input"] = () => this.evaluate();
                }

                this._events = {
                    'input': input,
                    'form': {
                        "submit": () => this.close({'reason': 'submit'})
                    },
                    'ul': {
                        "mousedown": (ev) => this.onMouseDown(ev),
                        "mouseover": (ev) => this.onMouseOver(ev)
                    }
                };
                helpers.bind(this.input, this._events.input);
                helpers.bind(this.input.form, this._events.form);
                helpers.bind(this.ul, this._events.ul);
            }

            set list (list) {
                if (Array.isArray(list) || typeof list === "function") {
                    this._list = list;
                } else if (typeof list === "string" && _.includes(list, ",")) {
                    this._list = list.split(/\s*,\s*/);
                } else { // Element or CSS selector
                    list = helpers.getElement(list);
                    if (list && list.children) {
                        const items = [];
                        slice.apply(list.children).forEach(function (el) {
                            if (!el.disabled) {
                                const text = el.textContent.trim(),
                                    value = el.value || text,
                                    label = el.label || text;
                                if (value !== "") {
                                    items.push({ label: label, value: value });
                                }
                            }
                        });
                        this._list = items;
                    }
                }

                if (document.activeElement === this.input) {
                    this.evaluate();
                }
            }

            get selected () {
                return this.index > -1;
            }

            get opened () {
                return this.is_opened;
            }

            close (o) {
                if (!this.opened) {
                    return;
                }
                this.ul.setAttribute("hidden", "");
                this.is_opened = false;
                this.index = -1;
                this.trigger("suggestion-box-close", o || {});
            }

            insertValue (suggestion) {
                let value;
                if (this.match_current_word) {
                    u.replaceCurrentWord(this.input, suggestion.value);
                } else {
                    this.input.value = suggestion.value;
                }
            }

            open () {
                this.ul.removeAttribute("hidden");
                this.is_opened = true;

                if (this.auto_first && this.index === -1) {
                    this.goto(0);
                }
                this.trigger("suggestion-box-open");
            }

            destroy () {
                //remove events from the input and its form
                helpers.unbind(this.input, this._events.input);
                helpers.unbind(this.input.form, this._events.form);

                //move the input out of the suggestion-box container and remove the container and its children
                const parentNode = this.container.parentNode;

                parentNode.insertBefore(this.input, this.container);
                parentNode.removeChild(this.container);

                //remove autocomplete and aria-autocomplete attributes
                this.input.removeAttribute("autocomplete");
                this.input.removeAttribute("aria-autocomplete");
            }

            next () {
                const count = this.ul.children.length;
                this.goto(this.index < count - 1 ? this.index + 1 : (count ? 0 : -1) );
            }

            previous () {
                const count = this.ul.children.length,
                      pos = this.index - 1;
                this.goto(this.selected && pos !== -1 ? pos : count - 1);
            }

            goto (i) {
                // Should not be used directly, highlights specific item without any checks!
                const list = this.ul.children;
                if (this.selected) {
                    list[this.index].setAttribute("aria-selected", "false");
                }
                this.index = i;

                if (i > -1 && list.length > 0) {
                    list[i].setAttribute("aria-selected", "true");
                    list[i].focus();
                    this.status.textContent = list[i].textContent;
                    // scroll to highlighted element in case parent's height is fixed
                    this.ul.scrollTop = list[i].offsetTop - this.ul.clientHeight + list[i].clientHeight;
                    this.trigger("suggestion-box-highlight", {'text': this.suggestions[this.index]});
                }
            }

            select (selected, origin) {
                if (selected) {
                    this.index = u.siblingIndex(selected);
                } else {
                    selected = this.ul.children[this.index];
                }
                if (selected) {
                    const suggestion = this.suggestions[this.index];
                    this.insertValue(suggestion);
                    this.close({'reason': 'select'});
                    this.auto_completing = false;
                    this.trigger("suggestion-box-selectcomplete", {'text': suggestion});
                }
            }

            onMouseOver (ev) {
                const li = u.ancestor(ev.target, 'li');
                if (li) {
                    this.goto(Array.prototype.slice.call(this.ul.children).indexOf(li))
                }
            }

            onMouseDown (ev) {
                if (ev.button !== 0) {
                    return; // Only select on left click
                }
                const li = u.ancestor(ev.target, 'li');
                if (li) {
                    ev.preventDefault();
                    this.select(li, ev.target);
                }
            }

            keyPressed (ev) {
                if (this.opened) {
                    if (_.includes([_converse.keycodes.ENTER, _converse.keycodes.TAB], ev.keyCode) && this.selected) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        this.select();
                        return true;
                    } else if (ev.keyCode === _converse.keycodes.ESCAPE) {
                        this.close({'reason': 'esc'});
                        return true;
                    } else if (_.includes([_converse.keycodes.UP_ARROW, _converse.keycodes.DOWN_ARROW], ev.keyCode)) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        this[ev.keyCode === _converse.keycodes.UP_ARROW ? "previous" : "next"]();
                        return true;
                    }
                }

                if (_.includes([
                            _converse.keycodes.SHIFT,
                            _converse.keycodes.META,
                            _converse.keycodes.META_RIGHT,
                            _converse.keycodes.ESCAPE,
                            _converse.keycodes.ALT]
                        , ev.keyCode)) {
                    return;
                }
                if (this.match_on_tab && ev.keyCode === _converse.keycodes.TAB) {
                    ev.preventDefault();
                    this.auto_completing = true;
                } else if (this.trigger_on_at && ev.keyCode === _converse.keycodes.AT) {
                    this.auto_completing = true;
                }
            }

            evaluate (ev) {
                const arrow_pressed = (
                    ev.keyCode === _converse.keycodes.UP_ARROW ||
                    ev.keyCode === _converse.keycodes.DOWN_ARROW
                );
                if (!this.auto_completing || (this.selected && arrow_pressed)) {
                    return;
                }

                const list = typeof this._list === "function" ? this._list() : this._list;
                if (list.length === 0) {
                    return;
                }

                let value = this.match_current_word ? u.getCurrentWord(this.input) : this.input.value;

                let ignore_min_chars = false;
                if (this.trigger_on_at && value.startsWith('@')) {
                    ignore_min_chars = true;
                    value = value.slice('1');
                }

                if ((value.length >= this.min_chars) || ignore_min_chars) {
                    this.index = -1;
                    // Populate list with options that match
                    this.ul.innerHTML = "";

                    this.suggestions = list
                        .map(item => new Suggestion(this.data(item, value)))
                        .filter(item => this.filter(item, value));

                    if (this.sort !== false) {
                        this.suggestions = this.suggestions.sort(this.sort);
                    }
                    this.suggestions = this.suggestions.slice(0, this.max_items);
                    this.suggestions.forEach((text) => this.ul.appendChild(this.item(text, value)));

                    if (this.ul.children.length === 0) {
                        this.close({'reason': 'nomatches'});
                    } else {
                        this.open();
                    }
                } else {
                    this.close({'reason': 'nomatches'});
                    this.auto_completing = false;
                }
            }
        }

        // Make it an event emitter
        _.extend(AutoComplete.prototype, Backbone.Events);


        // Private functions

        function Suggestion(data) {
            const o = Array.isArray(data)
                ? { label: data[0], value: data[1] }
                : typeof data === "object" && "label" in data && "value" in data ? data : { label: data, value: data };

            this.label = o.label || o.value;
            this.value = o.value;
        }

        Object.defineProperty(Suggestion.prototype = Object.create(String.prototype), "length", {
            get: function() { return this.label.length; }
        });

        Suggestion.prototype.toString = Suggestion.prototype.valueOf = function () {
            return "" + this.label;
        };

        // Helpers
        var slice = Array.prototype.slice;

        const helpers = {

            getElement (expr, el) {
                return typeof expr === "string"? (el || document).querySelector(expr) : expr || null;
            },

            bind (element, o) {
                if (element) {
                    for (var event in o) {
                        if (!Object.prototype.hasOwnProperty.call(o, event)) {
                            continue;
                        }
                        const callback = o[event];
                        event.split(/\s+/).forEach(event => element.addEventListener(event, callback));
                    }
                }
            },

            unbind (element, o) {
                if (element) {
                    for (var event in o) {
                        if (!Object.prototype.hasOwnProperty.call(o, event)) {
                            continue;
                        }
                        const callback = o[event];
                        event.split(/\s+/).forEach(event => element.removeEventListener(event, callback));
                    }
                }
            },

            regExpEscape (s) {
                return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
            }
        }

        _converse.AutoComplete = AutoComplete;
    }
});
