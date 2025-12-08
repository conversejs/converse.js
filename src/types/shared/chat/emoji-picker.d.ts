export default class EmojiPicker extends CustomElement {
    static get properties(): {
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
        state: {
            type: ObjectConstructor;
        };
        render_emojis: {
            type: BooleanConstructor;
        };
        allowed_emojis: {
            type: ArrayConstructor;
        };
        filter: {
            type: FunctionConstructor;
        };
    };
    state: any;
    model: any;
    query: string;
    render_emojis: any;
    _search_results: any[];
    filter: any;
    current_category: string;
    current_skintone: string;
    debouncedFilter: import("lodash").DebouncedFunc<(input: HTMLInputElement) => any>;
    allowed_emojis: any;
    initialize(): void;
    dropdown: Element;
    firstUpdated(changed: any): void;
    set search_results(value: any[]);
    get search_results(): any[];
    render(): import("lit-html").TemplateResult<1>;
    updated(changed: any): void;
    onModelChanged(changed: any): void;
    setScrollPosition(): void;
    preserve_scroll: boolean;
    updateSearchResults(changed: any): any[];
    registerEvents(): void;
    onKeyDown: (ev: any) => void;
    connectedCallback(): void;
    onDropdownHide(): void;
    /**
     * @param {HTMLElement} el
     */
    setCategoryForElement(el: HTMLElement): void;
    /**
     * @param {string} value
     */
    selectEmoji(value: string): void;
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
    #private;
}
export type DOMNavigatorOptions = any;
export type DOMNavigatorDirection = any;
import { CustomElement } from "shared/components/element.js";
import { DOMNavigator } from "shared/dom-navigator";
//# sourceMappingURL=emoji-picker.d.ts.map