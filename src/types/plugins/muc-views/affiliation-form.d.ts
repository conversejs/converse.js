export default AffiliationForm;
declare class AffiliationForm extends CustomElement {
    static get properties(): {
        muc: {
            type: ObjectConstructor;
        };
        jid: {
            type: StringConstructor;
        };
        affiliation: {
            type: StringConstructor;
        };
        alert_message: {
            type: StringConstructor;
            attribute: boolean;
        };
        alert_type: {
            type: StringConstructor;
            attribute: boolean;
        };
    };
    jid: any;
    muc: any;
    affiliation: any;
    render(): import("lit-html").TemplateResult<1>;
    alert(message: any, type: any): void;
    alert_message: any;
    alert_type: any;
    assignAffiliation(ev: any): Promise<void>;
}
import { CustomElement } from 'shared/components/element';
//# sourceMappingURL=affiliation-form.d.ts.map