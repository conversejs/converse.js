export default adhoc_api;
declare namespace adhoc_api {
    namespace adhoc {
        /**
         * @method api.adhoc.getCommands
         * @param { String } to_jid
         */
        function getCommands(to_jid: string): Promise<any>;
    }
}
