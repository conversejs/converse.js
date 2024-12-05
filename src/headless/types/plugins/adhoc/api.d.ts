declare namespace _default {
    namespace adhoc {
        /**
         * @method api.adhoc.getCommands
         * @param {string} to_jid
         */
        function getCommands(to_jid: string): Promise<import("./types").AdHocCommand[]>;
        /**
         * @method api.adhoc.fetchCommandForm
         * @param {string} jid
         * @param {string} node
         * @returns {Promise<AdHocCommandResult>}
         */
        function fetchCommandForm(jid: string, node: string): Promise<import("./types").AdHocCommandResult>;
        /**
         * @method api.adhoc.runCommand
         * @param {String} jid
         * @param {String} sessionid
         * @param {import('./types').AdHocCommandAction} action
         * @param {String} node
         * @param {Array<{ [k:string]: string }>} inputs
         */
        function runCommand(jid: string, sessionid: string, node: string, action: import("./types").AdHocCommandAction, inputs: Array<{
            [k: string]: string;
        }>): Promise<{
            note: any;
            type?: import("../../shared/types.js").XFormResponseType;
            title?: string;
            instructions?: string;
            reported?: import("../../shared/types.js").XFormReportedField[];
            items?: import("../../shared/types.js").XFormResultItemField[][];
            fields?: import("../../shared/types.js").XFormField[];
            sessionid?: string;
            actions?: string[];
            status: any;
        }>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map