declare namespace _default {
    namespace presence {
        /**
         * Send out a presence stanza
         * @method _converse.api.user.presence.send
         * @param {String} [type]
         * @param {String} [to]
         * @param {String} [status] - An optional status message
         * @param {Array<Element>|Array<Strophe.Builder>|Element|Strophe.Builder} [child_nodes]
         *  Nodes(s) to be added as child nodes of the `presence` XML element.
         */
        function send(type?: string, to?: string, status?: string, child_nodes?: any): Promise<void>;
    }
}
export default _default;
export namespace Strophe {
    type Builder = any;
}
export type XMPPStatus = import('../../plugins/status/status').default;
//# sourceMappingURL=presence.d.ts.map