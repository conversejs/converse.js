import AutoComplete from "./autocomplete.js";
import { CustomElement } from "shared/components/element.js";
import { FILTER_CONTAINS, FILTER_STARTSWITH, getAutoCompleteItem } from "./utils.js";
import { api, u } from "@converse/headless";
import { html } from "lit";

/**
 * A custom element that can be used to add auto-completion suggestions to a form input.
 * @class AutoCompleteComponent
 *
 * @property {"above" | "below"} [position="above"]
 *  Should the autocomplete list show above or below the input element?
 * @property {Boolean} [autofocus=false]
 *  Should the `focus` attribute be set on the input element?
 * @property {Function} getAutoCompleteList
 *  A function that returns the list of autocomplete suggestions
 * @property {Function} data
 *  A function that maps the returned matches into the correct format
 * @property {Array} list
 *  An array of suggestions, to be used instead of the `getAutoCompleteList` *  function
 * @property {Boolean} [auto_evaluate=true]
 *  Should evaluation happen automatically without any particular key as trigger?
 * @property {Boolean} [auto_first=false]
 *  Should the first element automatically be selected?
 * @property { "contains" | "startswith" } [filter="contains"]
 *  Provide matches which contain the entered text, or which starts with the entered text
 * @property {String} [include_triggers=""]
 *  Space separated characters which should be included in the returned value
 * @property {Number} [min_chars=1]
 *  The minimum number of characters to be entered into the input before autocomplete starts.
 * @property {String} [name]
 *  The `name` attribute of the `input` element
 * @property {String} [placeholder]
 *  The `placeholder` attribute of the `input` element
 * @property {Function} [renderItem]
 *  Optional function which must return a lit TemplateResult which renders an
 *  suggestion item in the autocomplete list.
 * @property {String} [triggers]
 *  String of space separated characters which trigger autocomplete
 * @property {Function} [validate]
 *  A validation function that returns a string containing a validation error
 *  message in case the validation failed.
 *
 * @example
 *     <converse-autocomplete
 *         .getAutoCompleteList="${getAutoCompleteList}"
 *         placeholder="${placeholder_text}"
 *         name="foo">
 *     </converse-autocomplete>
 */
export default class AutoCompleteComponent extends CustomElement {
    static get properties() {
        return {
            auto_evaluate: { type: Boolean },
            auto_first: { type: Boolean },
            autofocus: { type: Boolean },
            data: { type: Function },
            error_message: { type: String },
            filter: { type: String },
            getAutoCompleteList: { type: Function },
            include_triggers: { type: String },
            list: { type: Array },
            min_chars: { type: Number },
            name: { type: String },
            placeholder: { type: String },
            position: { type: String },
            renderItem: { type: Function },
            required: { type: Boolean },
            triggers: { type: String },
            validate: { type: Function },
            value: { type: String },
        };
    }

    constructor() {
        super();
        this.auto_evaluate = true;
        this.auto_first = false;
        this.data = (a) => a;
        this.error_message = "";
        this.filter = "contains";
        this.getAutoCompleteList = null;
        this.include_triggers = "";
        this.list = null;
        this.match_current_word = false; // Match only the current word, otherwise all input is matched
        this.max_items = 10;
        this.min_chars = 1;
        this.name = "";
        this.placeholder = "";
        this.position = "above";
        this.renderItem = getAutoCompleteItem;

        this.required = false;
        this.triggers = "";
        this.validate = null;
        this.value = "";

        this.evaluate = u.debounce(
            /** @param {KeyboardEvent} ev */
            (ev) => {
                this.auto_evaluate && this.auto_complete.evaluate(ev);
            },
            250
        );
    }

    render() {
        const position_class = `suggestion-box__results--${this.position}`;
        return html`
            <div class="suggestion-box suggestion-box__name">
                <ul class="suggestion-box__results ${position_class}" hidden=""></ul>
                <input
                    .validate=${this.validate}
                    ?autofocus=${this.autofocus}
                    ?required=${this.required}
                    @change=${this.onChange}
                    @keydown=${this.onKeyDown}
                    @input=${this.evaluate}
                    autocomplete="off"
                    class="form-control suggestion-box__input ${this.error_message ? "is-invalid error" : ""}"
                    name="${this.name}"
                    placeholder="${this.placeholder}"
                    type="text"
                    value="${this.value}"
                />
                <span
                    class="suggestion-box__additions visually-hidden"
                    role="status"
                    aria-live="assertive"
                    aria-relevant="additions"
                ></span>
            </div>
            ${this.error_message ? html`<div class="invalid-feedback">${this.error_message}</div>` : ""}
        `;
    }

    firstUpdated() {
        this.auto_complete = new AutoComplete(/** @type HTMLElement */ (this.firstElementChild), {
            ac_triggers: this.triggers.split(" "),
            auto_first: this.auto_first,
            filter: this.filter == "contains" ? FILTER_CONTAINS : FILTER_STARTSWITH,
            include_triggers: [],
            list: this.list ?? (/** @param {string} q */(q) => this.getAutoCompleteList(q)),
            data: this.data,
            match_current_word: true,
            max_items: this.max_items,
            min_chars: this.min_chars,
            item: this.renderItem,
        });
        this.auto_complete.on("suggestion-box-selectcomplete", ({ suggestion }) => {
            this.auto_completing = false;
            this.dispatchEvent(new CustomEvent('autocomplete-select', {
                detail: { suggestion },
                bubbles: true,
                composed: true
            }));
        });
    }

    /** @param {KeyboardEvent} ev */
    onKeyDown(ev) {
        this.auto_complete.onKeyDown(ev);
    }

    async onChange() {
        const input = this.querySelector("input");
        this.error_message = await this.validate?.(input.value);
        if (this.error_message) this.requestUpdate();
        return this;
    }
}

api.elements.define("converse-autocomplete", AutoCompleteComponent);
