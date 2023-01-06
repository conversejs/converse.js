export default MUCNicknameForm;
declare class MUCNicknameForm {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    connectedCallback(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    submitNickname(ev: any): void;
    closeModal(): void;
}
