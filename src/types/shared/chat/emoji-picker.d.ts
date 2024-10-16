export default class EmojiPicker extends CustomElement {
    static get properties(): {
        chatview: {
            type: ObjectConstructor;
        };
        current_category: {
            type: StringConstructor;
            reflect: boolean;
        };
        current_skintone: {
            type: StringConstructor;
            reflect: boolean;
        };
        model: {
            type: ObjectConstructor;
        };
        query: {
            type: StringConstructor;
            reflect: boolean;
        };
        render_emojis: {
            type: BooleanConstructor;
        };
    };
    firstUpdated(changed: any): void;
    render_emojis: any;
    chatview: any;
    model: any;
    query: string;
    _search_results: any[];
    debouncedFilter: import("lodash").DebouncedFunc<(input: HTMLInputElement) => any>;
    set search_results(value: any[]);
    get search_results(): any[];
    render(): import("lit").TemplateResult<1>;
    updated(changed: any): void;
    onModelChanged(changed: any): void;
    current_category: any;
    current_skintone: any;
    setScrollPosition(): void;
    preserve_scroll: boolean;
    updateSearchResults(changed: any): any[];
    registerEvents(): void;
    onGlobalKeyDown: (ev: any) => void;
    connectedCallback(): void;
    /**
     * @param {KeyboardEvent} ev
     */
    _onGlobalKeyDown(ev: KeyboardEvent): void;
    /**
     * @param {HTMLElement} el
     */
    setCategoryForElement(el: HTMLElement): void;
    /**
     * @param {string} value
     */
    insertIntoTextArea(value: string): void;
    /**
     * @param {MouseEvent} ev
     */
    chooseSkinTone(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    chooseCategory(ev: MouseEvent): void;
    /**
     * @param {KeyboardEvent} ev
     */
    onSearchInputKeyDown(ev: KeyboardEvent): void;
    /**
     * @param {KeyboardEvent} ev
     */
    onEnterPressed(ev: KeyboardEvent): void;
    /**
     * @param {FocusEvent} ev
     */
    onSearchInputFocus(ev: FocusEvent): void;
    /**
     * @param {string} shortname
     */
    getTonedShortname(shortname: string): string;
    initArrowNavigation(): void;
    navigator: DOMNavigator;
    disableArrowNavigation(): void;
    /**
     * @param {KeyboardEvent} ev
     */
    enableArrowNavigation(ev: KeyboardEvent): void;
}
export type DOMNavigatorOptions = any;
export type DOMNavigatorDirection = any;
import { CustomElement } from 'shared/components/element.js';
import DOMNavigator from "shared/dom-navigator";
//# sourceMappingURL=emoji-picker.d.ts.map