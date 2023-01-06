export default class MUCSidebar {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    connectedCallback(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    closeSidebar(ev: any): void;
    onOccupantClicked(ev: any): void;
}
