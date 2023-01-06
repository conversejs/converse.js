export default MUCBookmarkForm;
declare class MUCBookmarkForm {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    connectedCallback(): void;
    model: any;
    bookmark: any;
    render(): import("lit-html").TemplateResult<1>;
    onBookmarkFormSubmitted(ev: any): void;
    removeBookmark(ev: any): void;
    closeBookmarkForm(ev: any): void;
}
