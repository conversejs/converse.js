export default class ProfileModal {
    constructor(options: any);
    tab: string;
    initialize(): void;
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    setVCard(data: any): Promise<void>;
    onFormSubmitted(ev: any): void;
}
