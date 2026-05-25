export default MUCPasswordForm;
declare class MUCPasswordForm extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    submitPassword(ev: any): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=password-form.d.ts.map