/**
 * A custom element that can be used to add auto-completion suggestions to a form input.
 * @example
 *     <converse-autocomplete
 *         .getAutoCompleteList="${getAutoCompleteList}"
 *         placeholder="${placeholder_text}"
 *         name="foo">
 *     </converse-autocomplete>
 */
export default class AutoCompleteComponent extends CustomElement {
    static get properties(): {
        auto_evaluate: {
            type: BooleanConstructor;
        };
        auto_first: {
            type: BooleanConstructor;
        };
        autofocus: {
            type: BooleanConstructor;
        };
        data: {
            type: FunctionConstructor;
        };
        error_message: {
            type: StringConstructor;
        };
        filter: {
            type: StringConstructor;
        };
        getAutoCompleteList: {
            type: FunctionConstructor;
        };
        include_triggers: {
            type: StringConstructor;
        };
        list: {
            type: ArrayConstructor;
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
        position: {
            type: StringConstructor;
        };
        renderItem: {
            type: FunctionConstructor;
        };
        required: {
            type: BooleanConstructor;
        };
        suffix: {
            type: StringConstructor;
        };
        triggers: {
            type: StringConstructor;
        };
        validate: {
            type: FunctionConstructor;
        };
        value: {
            type: StringConstructor;
        };
    };
    auto_evaluate: boolean;
    auto_first: boolean;
    data: (a: any) => any;
    error_message: string;
    /** @type { "contains" | "startswith" }
     * Provide matches which contain the entered text, or which starts with the entered text */
    filter: "contains" | "startswith";
    getAutoCompleteList: any;
    include_triggers: string;
    list: any;
    match_current_word: boolean;
    max_items: number;
    min_chars: number;
    name: string;
    placeholder: string;
    /** @type {"above" | "below"} Should the autocomplete list show above or below the input element? */
    position: "above" | "below";
    renderItem: typeof getAutoCompleteItem;
    required: boolean;
    suffix: string;
    triggers: string;
    validate: any;
    value: string;
    evaluate: {
        (...args: any[]): void;
        flush(): void;
    };
    render(): import("lit-html").TemplateResult<1>;
    firstUpdated(): void;
    auto_complete: AutoComplete;
    auto_completing: boolean;
    /** @param {KeyboardEvent} ev */
    onKeyDown(ev: KeyboardEvent): void;
    onChange(): Promise<this>;
}
import { CustomElement } from 'shared/components/element.js';
import { getAutoCompleteItem } from './utils.js';
import AutoComplete from './autocomplete.js';
//# sourceMappingURL=component.d.ts.map