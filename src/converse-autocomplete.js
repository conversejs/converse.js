// Converse.js
// http://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

// This plugin started as a fork of Lea Verou's Awesomplete
// https://leaverou.github.io/awesomplete/

(function (root, factory) {
    define(["converse-core"], factory);
}(this, function (converse) {

    const { _, Backbone } = converse.env,
          u = converse.env.utils;


    converse.plugins.add("converse-autocomplete", {
        initialize () {
            const { _converse } = this;

            _converse.FILTER_CONTAINS = function (text, input) {
                return RegExp($.regExpEscape(input.trim()), "i").test(text);
            };

            _converse.FILTER_STARTSWITH = function (text, input) {
                return RegExp("^" + $.regExpEscape(input.trim()), "i").test(text);
            };

            const _ac = function (el, o) {
                const me = this;

                this.is_opened = false;

                if (u.hasClass('.suggestion-box', el)) {
                    this.container = el;
                } else {
                    this.container = el.querySelector('.suggestion-box');
                }
                this.input = $(this.container.querySelector('.suggestion-box__input'));
                this.input.setAttribute("autocomplete", "off");
                this.input.setAttribute("aria-autocomplete", "list");

                this.ul = $(this.container.querySelector('.suggestion-box__results'));
                this.status = $(this.container.querySelector('.suggestion-box__additions'));

                o = o || {};

                configure(this, {
                    'match_current_word': false, // Match only the current word, otherwise all input is matched
                    'match_on_tab': false, // Whether matching should only start when tab's pressed
                    'min_chars': 2,
                    'max_items': 10,
                    'auto_evaluate': true,
                    'auto_first': false,
                    'data': _ac.DATA,
                    'filter': _ac.FILTER_CONTAINS,
                    'sort': o.sort === false ? false : _ac.SORT_BYLENGTH,
                    'item': _ac.ITEM,
                    'replace': _ac.REPLACE
                }, o);

                this.index = -1;

                const input = {
                    "blur": this.close.bind(this, { reason: "blur" }),
                    "keydown": function(evt) {
                        const c = evt.keyCode;

                        // If the dropdown `ul` is in view, then act on keydown for the following keys:
                        // Enter / Esc / Up / Down
                        if(me.opened) {
                            if (c === _converse.keycodes.ENTER && me.selected) {
                                evt.preventDefault();
                                me.select();
                            } else if (c === _converse.keycodes.ESCAPE) {
                                me.close({ reason: "esc" });
                            } else if (c === _converse.keycodes.UP_ARROW || c === _converse.keycodes.DOWN_ARROW) {
                                evt.preventDefault();
                                me[c === _converse.keycodes.UP_ARROW ? "previous" : "next"]();
                            }
                        }
                    }
                }
                if (this.auto_evaluate) {
                    input["input"] = this.evaluate.bind(this);
                }

                // Bind events
                this._events = {
                    'input': input,
                    'form': {
                        "submit": this.close.bind(this, { reason: "submit" })
                    },
                    'ul': {
                        "mousedown": function(evt) {
                            let li = evt.target;
                            if (li !== this) {
                                while (li && !(/li/i).test(li.nodeName)) {
                                    li = li.parentNode;
                                }

                                if (li && evt.button === 0) {  // Only select on left click
                                    evt.preventDefault();
                                    me.select(li, evt.target);
                                }
                            }
                        }
                    }
                };

                $.bind(this.input, this._events.input);
                $.bind(this.input.form, this._events.form);
                $.bind(this.ul, this._events.ul);

                if (this.input.hasAttribute("list")) {
                    this.list = "#" + this.input.getAttribute("list");
                    this.input.removeAttribute("list");
                }
                else {
                    this.list = this.input.getAttribute("data-list") || o.list || [];
                }

                _ac.all.push(this);
            }

            _ac.prototype = {
                set list (list) {
                    if (Array.isArray(list)) {
                        this._list = list;
                    }
                    else if (typeof list === "string" && _.includes(list, ",")) {
                        this._list = list.split(/\s*,\s*/);
                    }
                    else { // Element or CSS selector
                        list = $(list);
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
                },

                get selected() {
                    return this.index > -1;
                },

                get opened() {
                    return this.is_opened;
                },

                close (o) {
                    if (!this.opened) {
                        return;
                    }

                    this.ul.setAttribute("hidden", "");
                    this.is_opened = false;
                    this.index = -1;

                    $.fire(this.input, "suggestion-box-close", o || {});
                },

                open () {
                    this.ul.removeAttribute("hidden");
                    this.is_opened = true;

                    if (this.auto_first && this.index === -1) {
                        this.goto(0);
                    }

                    $.fire(this.input, "suggestion-box-open");
                },

                destroy () {
                    //remove events from the input and its form
                    $.unbind(this.input, this._events.input);
                    $.unbind(this.input.form, this._events.form);

                    //move the input out of the suggestion-box container and remove the container and its children
                    const parentNode = this.container.parentNode;

                    parentNode.insertBefore(this.input, this.container);
                    parentNode.removeChild(this.container);

                    //remove autocomplete and aria-autocomplete attributes
                    this.input.removeAttribute("autocomplete");
                    this.input.removeAttribute("aria-autocomplete");

                    //remove this awesomeplete instance from the global array of instances
                    var indexOfAutoComplete = _ac.all.indexOf(this);

                    if (indexOfAutoComplete !== -1) {
                        _ac.all.splice(indexOfAutoComplete, 1);
                    }
                },

                next () {
                    var count = this.ul.children.length;
                    this.goto(this.index < count - 1 ? this.index + 1 : (count ? 0 : -1) );
                },

                previous () {
                    var count = this.ul.children.length;
                    var pos = this.index - 1;

                    this.goto(this.selected && pos !== -1 ? pos : count - 1);
                },

                // Should not be used, highlights specific item without any checks!
                goto (i) {
                    var lis = this.ul.children;

                    if (this.selected) {
                        lis[this.index].setAttribute("aria-selected", "false");
                    }

                    this.index = i;

                    if (i > -1 && lis.length > 0) {
                        lis[i].setAttribute("aria-selected", "true");
                        this.status.textContent = lis[i].textContent;

                        // scroll to highlighted element in case parent's height is fixed
                        this.ul.scrollTop = lis[i].offsetTop - this.ul.clientHeight + lis[i].clientHeight;

                        $.fire(this.input, "suggestion-box-highlight", {
                            text: this.suggestions[this.index]
                        });
                    }
                },

                select (selected, origin) {
                    if (selected) {
                        this.index = u.siblingIndex(selected);
                    } else {
                        selected = this.ul.children[this.index];
                    }

                    if (selected) {
                        const suggestion = this.suggestions[this.index],
                            allowed = $.fire(this.input, "suggestion-box-select", {
                                'text': suggestion,
                                'origin': origin || selected
                            });

                        if (allowed) {
                            this.replace(suggestion);
                            this.close({'reason': 'select'});
                            this.auto_completing = false;
                            this.trigger("suggestion-box-selectcomplete", {'text': suggestion});
                        }
                    }
                },

                keyPressed (ev) {
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
                    }
                    if (this.auto_completing) {
                        this.evaluate();
                    }
                },

                evaluate (ev) {
                    let value = this.input.value;
                    if (this.match_current_word) {
                        value = u.getCurrentWord(this.input);
                    }

                    if (value.length >= this.min_chars && this._list.length > 0) {
                        this.index = -1;
                        // Populate list with options that match
                        this.ul.innerHTML = "";

                        this.suggestions = this._list
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
            };

            // Make it an event emitter
            _.extend(_ac.prototype, Backbone.Events);

            // Static methods/properties
            _ac.all = [];

            _ac.SORT_BYLENGTH = function (a, b) {
                if (a.length !== b.length) {
                    return a.length - b.length;
                }

                return a < b? -1 : 1;
            };

            _ac.ITEM = function (text, input) {
                input = input.trim();
                var element = document.createElement("li");
                element.setAttribute("aria-selected", "false");

                var regex = new RegExp("("+input+")", "ig");
                var parts = input ? text.split(regex) : [text];
                parts.forEach(function (txt) {
                    if (input && txt.match(regex)) {
                        var match = document.createElement("mark");
                        match.textContent = txt;
                        element.appendChild(match);
                    } else {
                        element.appendChild(document.createTextNode(txt));
                    }
                });
                return element;
            };

            _ac.REPLACE = function (text) {
                this.input.value = text.value;
            };

            _ac.DATA = function (item/*, input*/) { return item; };

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

            function configure (instance, properties, o) {
                for (var i in properties) {
                    if (!Object.prototype.hasOwnProperty.call(properties, i)) {
                        continue;
                    }

                    const initial = properties[i],
                          attr_value = instance.input.getAttribute("data-" + i.toLowerCase());

                    if (typeof initial === "number") {
                        instance[i] = parseInt(attr_value, 10);
                    } else if (initial === false) { // Boolean options must be false by default anyway
                        instance[i] = attr_value !== null;
                    } else if (initial instanceof Function) {
                        instance[i] = null;
                    } else {
                        instance[i] = attr_value;
                    }

                    if (!instance[i] && instance[i] !== 0) {
                        instance[i] = (i in o)? o[i] : initial;
                    }
                }
            }

            // Helpers
            var slice = Array.prototype.slice;

            function $(expr, con) {
                return typeof expr === "string"? (con || document).querySelector(expr) : expr || null;
            }

            function $$(expr, con) {
                return slice.call((con || document).querySelectorAll(expr));
            }

            $.bind = function(element, o) {
                if (element) {
                    for (var event in o) {
                        if (!Object.prototype.hasOwnProperty.call(o, event)) {
                            continue;
                        }
                        const callback = o[event];
                        event.split(/\s+/).forEach(event => element.addEventListener(event, callback));
                    }
                }
            };

            $.unbind = function(element, o) {
                if (element) {
                    for (var event in o) {
                        if (!Object.prototype.hasOwnProperty.call(o, event)) {
                            continue;
                        }
                        const callback = o[event];
                        event.split(/\s+/).forEach(event => element.removeEventListener(event, callback));
                    }
                }
            };

            $.fire = function(target, type, properties) {
                var evt = document.createEvent("HTMLEvents");

                evt.initEvent(type, true, true );

                for (var j in properties) {
                    if (!Object.prototype.hasOwnProperty.call(properties, j)) {
                        continue;
                    }
                    evt[j] = properties[j];
                }

                return target.dispatchEvent(evt);
            };

            $.regExpEscape = function (s) {
                return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
            };

            _ac.$ = $;
            _ac.$$ = $$;

            _converse.AutoComplete = _ac;
        }
    });
}));
