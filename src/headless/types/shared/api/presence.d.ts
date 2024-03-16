declare namespace _default {
    namespace presence {
        /**
         * Send out a presence stanza
         * @method _converse.api.user.presence.send
         * @param {String} [type]
         * @param {String} [to]
         * @param {String} [status] - An optional status message
         * @param {Array<Element>|Array<Builder>|Element|Builder} [nodes]
         *  Nodes(s) to be added as child nodes of the `presence` XML element.
         */
        function send(type?: string, to?: string, status?: string, nodes?: Element | import("strophe.js/src/types/builder.js").default | Element[] | import("strophe.js/src/types/builder.js").default[]): Promise<void>;
    }
}
export default _default;
export type Builder = import('strophe.js').Builder;
export type XMPPStatus = import('../../plugins/status/status').default;
export type MUC = import('../../plugins/muc/muc.js').default;
//# sourceMappingURL=presence.d.ts.map