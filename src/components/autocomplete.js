import { AutoComplete, FILTER_CONTAINS, FILTER_STARTSWITH } from "../converse-autocomplete.js";
import { CustomElement } from './element.js';
import { html } from 'lit-element';


export class AutoCompleteComponent extends CustomElement {

    static get properties () {
        return {
            'getAutoCompleteList': { type: Function },
            'auto_evaluate': { type: Boolean },
            'auto_first': { type: Boolean }, // Should the first element be automatically selected?
            'filter': { type: String },
            'include_triggers': { type: String },
            'min_chars': { type: Number },
            'name': { type: String },
            'placeholder': { type: String },
            'triggers': { type: String },
        }
    }

    constructor () {
        super();
        this.auto_evaluate = true; // Should evaluation happen automatically without any particular key as trigger?
        this.auto_first = false; // Should the first element be automatically selected?
        this.filter = 'contains';
        this.include_triggers = ''; // Space separated chars which should be included in the returned value
        this.match_current_word = false; // Match only the current word, otherwise all input is matched
        this.max_items = 10;
        this.min_chars = 1;
        this.triggers = ''; // String of space separated chars
    }

    render () {
        return html`
            <div class="suggestion-box suggestion-box__name">
                <ul class="suggestion-box__results suggestion-box__results--above" hidden=""></ul>
                <input type="text" name="${this.name}"
                       autocomplete="off"
                       @keydown=${this.onKeyDown}
                       @keyup=${this.onKeyUp}
                       class="form-control suggestion-box__input"
                       placeholder="${this.placeholder}"/>
                <span class="suggestion-box__additions visually-hidden" role="status" aria-live="assertive" aria-relevant="additions"></span>
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
            'list': () => this.getAutoCompleteList(),
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

window.customElements.define('converse-autocomplete', AutoCompleteComponent);
