declare namespace _default {
    namespace presence {
        /**
         * Send out a presence stanza
         * @method _converse.api.user.presence.send
         * @param {import('../../plugins/status/types').presence_attrs} [attrs]
         * @param {Array<Element>|Array<Builder>|Element|Builder} [nodes]
         *  Nodes(s) to be added as child nodes of the `presence` XML element.
         */
        function send(attrs?: import("../../plugins/status/types").presence_attrs, nodes?: Array<Element> | Array<Builder> | Element | Builder): Promise<void>;
    }
}
export default _default;
export type Builder = import("strophe.js").Builder;
export type Profile = import("../../plugins/status/profile").default;
export type MUC = import("../../plugins/muc/muc.js").default;
//# sourceMappingURL=presence.d.ts.map