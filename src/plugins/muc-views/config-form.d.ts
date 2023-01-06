export default MUCConfigForm;
declare class MUCConfigForm {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    connectedCallback(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    getConfig(): Promise<void>;
    submitConfigForm(ev: any): Promise<void>;
    closeForm(ev: any): void;
}
