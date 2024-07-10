export default class EmojiPickerContent extends CustomElement {
    static get properties(): {
        chatview: {
            type: ObjectConstructor;
        };
        search_results: {
            type: ArrayConstructor;
        };
        current_skintone: {
            type: StringConstructor;
        };
        model: {
            type: ObjectConstructor;
        };
        query: {
            type: StringConstructor;
        };
    };
    model: any;
    current_skintone: any;
    query: any;
    search_results: any;
    render(): import("lit").TemplateResult<1>;
    firstUpdated(): void;
    initIntersectionObserver(): void;
    observer: IntersectionObserver;
    setCategoryOnVisibilityChange(entries: any): void;
    insertEmoji(ev: any): void;
    shouldBeHidden(shortname: any): boolean;
}
export type EmojiPicker = any;
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=emoji-picker-content.d.ts.map