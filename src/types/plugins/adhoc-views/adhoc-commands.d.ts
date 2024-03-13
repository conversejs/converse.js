export default class AdHocCommands extends CustomElement {
    static get properties(): {
        alert: {
            type: StringConstructor;
        };
        alert_type: {
            type: StringConstructor;
        };
        commands: {
            type: ArrayConstructor;
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
    /**
     * @param {SubmitEvent} ev
     */
    fetchCommands(ev: SubmitEvent): Promise<void>;
    alert_type: string;
    alert: any;
    toggleCommandForm(ev: any): Promise<void>;
    executeAction(ev: any): void;
    clearCommand(cmd: any): void;
    runCommand(form: any, action: any): Promise<void>;
    note: any;
    cancel(ev: any): Promise<void>;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=adhoc-commands.d.ts.map