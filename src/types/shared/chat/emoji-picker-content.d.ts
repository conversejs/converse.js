export default class EmojiPickerContent extends CustomElement {
    static get properties(): {
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
        allowed_emojis: {
            type: ArrayConstructor;
        };
    };
    model: any;
    current_skintone: any;
    query: any;
    search_results: any;
    allowed_emojis: any;
    render(): import("lit-html").TemplateResult<1>;
    firstUpdated(): void;
    initIntersectionObserver(): void;
    observer: IntersectionObserver;
    setCategoryOnVisibilityChange(entries: any): void;
    /**
     * @param {MouseEvent} ev
     */
    insertEmoji(ev: MouseEvent): void;
    /**
     * Helper method for the template which decides whether an
     * emoji should be hidden.
     * It filters based on:
     * - Whether the emoji is allowed (if restrictions apply)
     * - The current skin tone
     * - The current search query
     *
     * @param {string} shortname
     * @returns {boolean}
     */
    shouldBeHidden(shortname: string): boolean;
}
export type EmojiPicker = any;
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=emoji-picker-content.d.ts.map