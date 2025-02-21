export default class AdHocCommands extends CustomElement {
    /**
     * @typedef {import('@converse/headless/types/plugins/adhoc/types').AdHocCommandAction} AdHocCommandAction
     * @typedef {import('./types').AdHocCommandUIProps} AdHocCommandUIProps
     */
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
    commands: import("./types").AdHocCommandUIProps[];
    render(): import("lit").TemplateResult<1>;
    /**
     * @param {SubmitEvent} ev
     */
    fetchCommands(ev: SubmitEvent): Promise<void>;
    alert_type: string;
    alert: any;
    /**
     * @param {MouseEvent} ev
     */
    toggleCommandForm(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    executeAction(ev: MouseEvent): void;
    /**
     * @param {AdHocCommandUIProps} cmd
     */
    clearCommand(cmd: import("./types").AdHocCommandUIProps): void;
    /**
     * @param {HTMLFormElement} form
     * @param {AdHocCommandAction} action
     */
    runCommand(form: HTMLFormElement, action: import("@converse/headless/types/plugins/adhoc/types").AdHocCommandAction): Promise<void>;
    note: any;
    /**
     * @param {MouseEvent} ev
     */
    cancel(ev: MouseEvent): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=adhoc-commands.d.ts.map