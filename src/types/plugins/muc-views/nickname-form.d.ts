export default MUCNicknameForm;
declare class MUCNicknameForm extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    connectedCallback(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    submitNickname(ev: any): void;
    closeModal(): void;
}
import { CustomElement } from "shared/components/element";
//# sourceMappingURL=nickname-form.d.ts.map