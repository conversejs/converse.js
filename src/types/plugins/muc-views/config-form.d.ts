export default MUCConfigForm;
declare class MUCConfigForm extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    connectedCallback(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    getConfig(): Promise<void>;
    submitConfigForm(ev: any): Promise<void>;
    closeForm(ev: any): void;
}
import { CustomElement } from "shared/components/element";
//# sourceMappingURL=config-form.d.ts.map