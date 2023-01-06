export default class Confirm {
    constructor(options: any);
    confirmation: any;
    initialize(): void;
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    onConfimation(ev: any): void;
    renderModalFooter(): string;
}
