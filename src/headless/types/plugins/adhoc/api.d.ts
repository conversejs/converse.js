declare namespace _default {
    namespace adhoc {
        /**
         * @method api.adhoc.getCommands
         * @param { String } to_jid
         */
        function getCommands(to_jid: string): Promise<any>;
        /**
         * @method api.adhoc.fetchCommandForm
         */
        function fetchCommandForm(command: any): Promise<{
            sessionid: any;
            instructions: any;
            fields: any;
            actions: any[];
        } | {
            instructions: any;
            fields: any[];
        }>;
        /**
         * @method api.adhoc.runCommand
         * @param { String } jid
         * @param { String } sessionid
         * @param { 'execute' | 'cancel' | 'prev' | 'next' | 'complete' } action
         * @param { String } node
         * @param { Array<{ [k:string]: string }> } inputs
         */
        function runCommand(jid: string, sessionid: string, node: string, action: "cancel" | "execute" | "prev" | "next" | "complete", inputs: {
            [k: string]: string;
        }[]): Promise<{
            note: any;
            sessionid?: any;
            instructions?: any;
            fields?: any;
            actions?: any[];
            status: any;
        }>;
    }
}
export default _default;
//# sourceMappingURL=api.d.ts.map