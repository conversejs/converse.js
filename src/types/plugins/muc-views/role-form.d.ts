export default RoleForm;
declare class RoleForm extends CustomElement {
    static get properties(): {
        muc: {
            type: ObjectConstructor;
        };
        jid: {
            type: StringConstructor;
        };
        role: {
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
    muc: any;
    nick: any;
    jid: any;
    render(): import("lit-html").TemplateResult<1>;
    alert(message: any, type: any): void;
    alert_message: any;
    alert_type: any;
    assignRole(ev: any): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=role-form.d.ts.map