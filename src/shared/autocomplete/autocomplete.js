/**
 * @copyright Lea Verou and the Converse.js contributors
 * @description
 *  Started as a fork of Lea Verou's "Awesomplete"
 *  https://leaverou.github.io/awesomplete/
 * @license Mozilla Public License (MPLv2)
 */

import { Events } from '@converse/skeletor/src/events.js';
import { helpers, FILTER_CONTAINS, ITEM, SORT_BY_QUERY_POSITION } from './utils.js';
import Suggestion from './suggestion.js';
import { converse } from "@converse/headless/core";


const u = converse.env.utils;


export class AutoComplete {

    constructor (el, config={}) {
        this.suggestions = [];
        this.is_opened = false;

        if (u.hasClass('suggestion-box', el)) {
            this.container = el;
        } else {
            this.container = el.querySelector('.suggestion-box');
        }
        this.input = this.container.querySelector('.suggestion-box__input');
        this.input.setAttribute("aria-autocomplete", "list");

        this.ul = this.container.querySelector('.suggestion-box__results');
        this.status = this.container.querySelector('.suggestion-box__additions');

        Object.assign(this, {
            'match_current_word': false, // Match only the current word, otherwise all input is matched
            'ac_triggers': [], // Array of keys (`ev.key`) values that will trigger auto-complete
            'include_triggers': [], // Array of trigger keys which should be included in the returned value
            'min_chars': 2,
            'max_items': 10,
            'auto_evaluate': true, // Should evaluation happen automatically without any particular key as trigger?
            'auto_first': false, // Should the first element be automatically selected?
            'data': a => a,
            'filter': FILTER_CONTAINS,
            'sort': config.sort === false ? false : SORT_BY_QUERY_POSITION,
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
        const input = {
            "blur": () => this.close({'reason': 'blur'})
        }
        if (this.auto_evaluate) {
            input["input"] = (e) => this.evaluate(e);
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
        } else if (typeof list === "string" && list.includes(",")) {
            this._list = list.split(/\s*,\s*/);
        } else { // Element or CSS selector
            const children = helpers.getElement(list)?.children || [];
            this._list = Array.from(children)
                .filter(el => !el.disabled)
                .map(el => {
                    const text = el.textContent.trim();
                    const value = el.value || text;
                    const label = el.label || text;
                    return (value !== "") ? { label, value } : null;
                })
                .filter(i => i);
        }

        if (document.activeElement === this.input) {
            this.evaluate();
        }
    }

    get list () {
        return this._list;
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

    goto (i, scroll=true) {
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

            if (scroll) {
                // scroll to highlighted element in case parent's height is fixed
                this.ul.scrollTop = list[i].offsetTop - this.ul.clientHeight + list[i].clientHeight;
            }
            this.trigger("suggestion-box-highlight", {'text': this.suggestions[this.index]});
        }
    }

    select (selected) {
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
            const index = Array.prototype.slice.call(this.ul.children).indexOf(li);
            this.goto(index, false);
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

    onKeyDown (ev) {
        if (this.opened) {
            if ([converse.keycodes.ENTER, converse.keycodes.TAB].includes(ev.keyCode) && this.selected) {
                ev.preventDefault();
                ev.stopPropagation();
                this.select();
                return true;
            } else if (ev.keyCode === converse.keycodes.ESCAPE) {
                this.close({'reason': 'esc'});
                return true;
            } else if ([converse.keycodes.UP_ARROW, converse.keycodes.DOWN_ARROW].includes(ev.keyCode)) {
                ev.preventDefault();
                ev.stopPropagation();
                this[ev.keyCode === converse.keycodes.UP_ARROW ? "previous" : "next"]();
                return true;
            }
        }

        if ([converse.keycodes.SHIFT,
                converse.keycodes.META,
                converse.keycodes.META_RIGHT,
                converse.keycodes.ESCAPE,
                converse.keycodes.ALT
            ].includes(ev.keyCode)) {

            return;
        }

        if (this.ac_triggers.includes(ev.key)) {
            if (ev.key === "Tab") {
                ev.preventDefault();
            }
            this.auto_completing = true;
        } else if (ev.key === "Backspace") {
            const word = u.getCurrentWord(ev.target, ev.target.selectionEnd-1);
            if (helpers.isMention(word, this.ac_triggers)) {
                this.auto_completing = true;
            }
        }
    }

    async evaluate (ev) {
        const selecting = this.selected && ev && (
            ev.keyCode === converse.keycodes.UP_ARROW ||
            ev.keyCode === converse.keycodes.DOWN_ARROW
        );

        if (!this.auto_evaluate && !this.auto_completing || selecting) {
            return;
        }

        let value = this.match_current_word ? u.getCurrentWord(this.input) : this.input.value;

        const contains_trigger = helpers.isMention(value, this.ac_triggers);
        if (contains_trigger && !this.include_triggers.includes(ev.key)) {
            value = u.isMentionBoundary(value[0])
                ? value.slice('2')
                : value.slice('1');
        }

        const is_long_enough = value.length && value.length >= this.min_chars;

        if (contains_trigger || is_long_enough) {
            this.auto_completing = true;

            const list = typeof this._list === "function" ? await this._list(value) : this._list;
            if (list.length === 0 || !this.auto_completing) {
                this.close({'reason': 'nomatches'});
                return;
            }

            this.index = -1;
            this.ul.innerHTML = "";

            this.suggestions = list
                .map(item => new Suggestion(this.data(item, value), value))
                .filter(item => this.filter(item, value));

            if (this.sort !== false) {
                this.suggestions = this.suggestions.sort(this.sort);
            }
            this.suggestions = this.suggestions.slice(0, this.max_items);
            this.suggestions.forEach(text => this.ul.appendChild(this.item(text, value)));

            if (this.ul.children.length === 0) {
                this.close({'reason': 'nomatches'});
            } else {
                this.open();
            }
        } else {
            this.close({'reason': 'nomatches'});
            if (!contains_trigger) {
                this.auto_completing = false;
            }
        }
    }
}

// Make it an event emitter
Object.assign(AutoComplete.prototype, Events);

export default AutoComplete;
