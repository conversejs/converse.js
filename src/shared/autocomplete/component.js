import AutoComplete from './autocomplete.js';
import { CustomElement } from 'shared/components/element.js';
import { FILTER_CONTAINS, FILTER_STARTSWITH } from './utils.js';
import { api } from '@converse/headless/core';
import { html } from 'lit';

/**
 * A custom element that can be used to add auto-completion suggestions to a form input.
 * @class AutoCompleteComponent
 *
 * @property { "above" | "below" } [position="above"]
 *  Should the autocomplete list show above or below the input element?
 * @property { Boolean } [autofocus=false]
 *  Should the `focus` attribute be set on the input element?
 * @property { Function } getAutoCompleteList
 *  A function that returns the list of autocomplete suggestions
 * @property { Array } list
 *  An array of suggestions, to be used instead of the `getAutoCompleteList` *  function
 * @property { Boolean } [auto_evaluate=true]
 *  Should evaluation happen automatically without any particular key as trigger?
 * @property { Boolean } [auto_first=false]
 *  Should the first element automatically be selected?
 * @property { "contains" | "startswith" } [filter="contains"]
 *  Provide matches which contain the entered text, or which starts with the entered text
 * @property { String } [include_triggers=""]
 *  Space separated characters which should be included in the returned value
 * @property { Number } [min_chars=1]
 *  The minimum number of characters to be entered into the input before autocomplete starts.
 * @property { String } [name]
 *  The `name` attribute of the `input` element
 * @property { String } [placeholder]
 *  The `placeholder` attribute of the `input` element
 * @property { String } [triggers]
 *  String of space separated characters which trigger autocomplete
 *
 * @example
 *     <converse-autocomplete
 *         .getAutoCompleteList="${getAutoCompleteList}"
 *         placeholder="${placeholder_text}"
 *         name="foo">
 *     </converse-autocomplete>
 */
export default class AutoCompleteComponent extends CustomElement {
    static get properties () {
        return {
            'position': { type: String },
            'autofocus': { type: Boolean },
            'getAutoCompleteList': { type: Function },
            'list': { type: Array },
            'auto_evaluate': { type: Boolean },
            'auto_first': { type: Boolean },
            'filter': { type: String },
            'include_triggers': { type: String },
            'min_chars': { type: Number },
            'name': { type: String },
            'placeholder': { type: String },
            'triggers': { type: String },
            'required': { type: Boolean },
        };
    }

    constructor () {
        super();
        this.position = 'above';
        this.auto_evaluate = true;
        this.auto_first = false;
        this.filter = 'contains';
        this.include_triggers = '';
        this.match_current_word = false; // Match only the current word, otherwise all input is matched
        this.max_items = 10;
        this.min_chars = 1;
        this.triggers = '';
    }

    render () {
        const position_class = `suggestion-box__results--${this.position}`;
        return html`
            <div class="suggestion-box suggestion-box__name">
                <ul class="suggestion-box__results ${position_class}" hidden=""></ul>
                <input
                    ?autofocus=${this.autofocus}
                    ?required=${this.required}
                    type="text"
                    name="${this.name}"
                    autocomplete="off"
                    @keydown=${this.onKeyDown}
                    @keyup=${this.onKeyUp}
                    class="form-control suggestion-box__input"
                    placeholder="${this.placeholder}"
                />
                <span
                    class="suggestion-box__additions visually-hidden"
                    role="status"
                    aria-live="assertive"
                    aria-relevant="additions"
                ></span>
            </div>
        `;
    }

    firstUpdated () {
        this.auto_complete = new AutoComplete(this.firstElementChild, {
            'ac_triggers': this.triggers.split(' '),
            'auto_evaluate': this.auto_evaluate,
            'auto_first': this.auto_first,
            'filter': this.filter == 'contains' ? FILTER_CONTAINS : FILTER_STARTSWITH,
            'include_triggers': [],
            'list': this.list ?? ((q) => this.getAutoCompleteList(q)),
            'match_current_word': true,
            'max_items': this.max_items,
            'min_chars': this.min_chars,
        });
        this.auto_complete.on('suggestion-box-selectcomplete', () => (this.auto_completing = false));
    }

    onKeyDown (ev) {
        this.auto_complete.onKeyDown(ev);
    }

    onKeyUp (ev) {
        this.auto_complete.evaluate(ev);
    }
}

api.elements.define('converse-autocomplete', AutoCompleteComponent);
