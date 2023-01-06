export default class AddContactModal {
    initialize(): void;
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    afterRender(): void;
    initJIDAutoComplete(): void;
    jid_auto_complete: any;
    initGroupAutoComplete(): void;
    initXHRAutoComplete(): void;
    name_auto_complete: any;
    initXHRFetch(): void;
    xhr: XMLHttpRequest;
    validateSubmission(jid: any): boolean;
    afterSubmission(_form: any, jid: any, name: any, group: any): void;
    addContactFromForm(ev: any): void;
}
