export default MUCNicknameForm;
declare class MUCNicknameForm extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    model: any;
    /**
     * @param {Map<string, any>} changed
     */
    shouldUpdate(changed: Map<string, any>): boolean;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {Event} ev
     */
    submitNickname(ev: Event): void;
    closeModal(): void;
}
import { CustomElement } from 'shared/components/element';
//# sourceMappingURL=nickname-form.d.ts.map