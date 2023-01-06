export default class AdHocCommands {
    static get properties(): {
        alert: {
            type: StringConstructor;
        };
        alert_type: {
            type: StringConstructor;
        };
        nonce: {
            type: StringConstructor;
        };
        fetching: {
            type: BooleanConstructor;
        };
        showform: {
            type: StringConstructor;
        };
        view: {
            type: StringConstructor;
        };
    };
    view: string;
    fetching: boolean;
    showform: string;
    commands: any[];
    render(): import("lit-html").TemplateResult<1>;
    fetchCommands(ev: any): Promise<void>;
    alert_type: string;
    alert: any;
    toggleCommandForm(ev: any): Promise<void>;
    hideCommandForm(ev: any): void;
    nonce: any;
    runCommand(ev: any): Promise<void>;
}
