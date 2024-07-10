export default MUCBookmarkForm;
declare class MUCBookmarkForm extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    willUpdate(changed_properties: any): void;
    model: any;
    bookmark: any;
    render(): import("lit").TemplateResult<1>;
    onBookmarkFormSubmitted(ev: any): void;
    removeBookmark(ev: any): void;
    closeBookmarkForm(ev: any): void;
}
import { CustomElement } from "shared/components/element";
//# sourceMappingURL=bookmark-form.d.ts.map