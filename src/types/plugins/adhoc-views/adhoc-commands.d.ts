/**
 * @typedef {Object} UIProps
 * @property {string} instructions
 * @property {string} jid
 * @property {string} [alert]
 * @property {'danger'|'primary'} [alert_type]
 * @property {'cancel'|'complete'|'execute'|'next'|'prev'} name
 *
 * @typedef {AdHocCommand & AdHocCommandFields & UIProps} AdHocCommandUIProps
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
    toggleCommandForm(ev: any): Promise<void>;
    executeAction(ev: any): void;
    clearCommand(cmd: any): void;
    runCommand(form: any, action: any): Promise<void>;
    note: any;
    cancel(ev: any): Promise<void>;
}
export type AdHocCommand = import('@converse/headless/types/plugins/adhoc/utils').AdHocCommand;
export type AdHocCommandFields = import('@converse/headless/types/plugins/adhoc/utils').AdHocCommandFields;
export type UIProps = {
    instructions: string;
    jid: string;
    alert?: string;
    alert_type?: 'danger' | 'primary';
    name: 'cancel' | 'complete' | 'execute' | 'next' | 'prev';
};
export type AdHocCommandUIProps = AdHocCommand & AdHocCommandFields & UIProps;
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=adhoc-commands.d.ts.map