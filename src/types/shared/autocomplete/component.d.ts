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
 * @property { Function } data
 *  A function that maps the returned matches into the correct format
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
    static get properties(): {
        position: {
            type: StringConstructor;
        };
        autofocus: {
            type: BooleanConstructor;
        };
        getAutoCompleteList: {
            type: FunctionConstructor;
        };
        data: {
            type: FunctionConstructor;
        };
        list: {
            type: ArrayConstructor;
        };
        auto_evaluate: {
            type: BooleanConstructor;
        };
        auto_first: {
            type: BooleanConstructor;
        };
        filter: {
            type: StringConstructor;
        };
        include_triggers: {
            type: StringConstructor;
        };
        min_chars: {
            type: NumberConstructor;
        };
        name: {
            type: StringConstructor;
        };
        placeholder: {
            type: StringConstructor;
        };
        value: {
            type: StringConstructor;
        };
        triggers: {
            type: StringConstructor;
        };
        required: {
            type: BooleanConstructor;
        };
    };
    data: (a: any) => any;
    value: string;
    position: string;
    auto_evaluate: boolean;
    auto_first: boolean;
    filter: string;
    include_triggers: string;
    match_current_word: boolean;
    max_items: number;
    min_chars: number;
    triggers: string;
    getAutoCompleteList: any;
    list: any;
    name: string;
    placeholder: string;
    required: boolean;
    render(): import("lit").TemplateResult<1>;
    firstUpdated(): void;
    auto_complete: AutoComplete;
    auto_completing: boolean;
    onKeyDown(ev: any): void;
    onKeyUp(ev: any): void;
}
import { CustomElement } from 'shared/components/element.js';
import AutoComplete from './autocomplete.js';
//# sourceMappingURL=component.d.ts.map