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
    debouncedFilter: any;
    set search_results(arg: any[]);
    get search_results(): any[];
    render(): import("lit-html").TemplateResult<1>;
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
    _onGlobalKeyDown(ev: any): void;
    setCategoryForElement(el: any): void;
    insertIntoTextArea(value: any): void;
    chooseSkinTone(ev: any): void;
    chooseCategory(ev: any): void;
    onSearchInputKeyDown(ev: any): void;
    onEnterPressed(ev: any): void;
    onSearchInputFocus(ev: any): void;
    getTonedShortname(shortname: any): any;
    initArrowNavigation(): void;
    navigator: DOMNavigator;
    disableArrowNavigation(): void;
    enableArrowNavigation(ev: any): void;
}
export type DOMNavigatorOptions = any;
import { CustomElement } from "shared/components/element.js";
import DOMNavigator from "shared/dom-navigator";
//# sourceMappingURL=emoji-picker.d.ts.map