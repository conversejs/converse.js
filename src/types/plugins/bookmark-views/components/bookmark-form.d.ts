export default MUCBookmarkForm;
declare class MUCBookmarkForm extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    /**
     * @param {Map<PropertyKey, any>} changed_properties
     * @return {void}
     */
    willUpdate(changed_properties: Map<PropertyKey, any>): void;
    model: any;
    bookmark: any;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {Event} ev
     */
    onBookmarkFormSubmitted(ev: Event): void;
    /**
     * @param {Event} ev
     */
    removeBookmark(ev: Event): void;
    /**
     * @param {Event} ev
     */
    closeBookmarkForm(ev: Event): void;
}
import { CustomElement } from 'shared/components/element';
//# sourceMappingURL=bookmark-form.d.ts.map