export default MUCPasswordForm;
declare class MUCPasswordForm {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    connectedCallback(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    submitPassword(ev: any): void;
}
