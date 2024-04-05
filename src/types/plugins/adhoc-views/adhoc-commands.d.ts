/**
 * @typedef {Object} UIProps
 * @property {string} instructions
 * @property {string} jid
 * @property {string} [alert]
 * @property {'danger'|'primary'} [alert_type]
 * @property {'cancel'|'complete'|'execute'|'next'|'prev'} name
 *
 * @typedef {AdHocCommand & AdHocCommandResult & UIProps} AdHocCommandUIProps
 */
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
    commands: AdHocCommandUIProps[];
    render(): import("lit-html").TemplateResult<1>;
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
    clearCommand(cmd: AdHocCommandUIProps): void;
    /**
     * @param {HTMLFormElement} form
     * @param {AdHocCommandAction} action
     */
    runCommand(form: HTMLFormElement, action: AdHocCommandAction): Promise<void>;
    note: any;
    /**
     * @param {MouseEvent} ev
     */
    cancel(ev: MouseEvent): Promise<void>;
}
export type AdHocCommand = import('@converse/headless/types/plugins/adhoc/utils').AdHocCommand;
export type AdHocCommandResult = import('@converse/headless/types/plugins/adhoc/utils').AdHocCommandResult;
export type AdHocCommandAction = import('@converse/headless/types/plugins/adhoc/api').AdHocCommandAction;
export type UIProps = {
    instructions: string;
    jid: string;
    alert?: string;
    alert_type?: 'danger' | 'primary';
    name: 'cancel' | 'complete' | 'execute' | 'next' | 'prev';
};
export type AdHocCommandUIProps = AdHocCommand & AdHocCommandResult & UIProps;
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=adhoc-commands.d.ts.map