declare namespace _default {
    namespace reactions {
        /**
         * Sets our reactions to a message (XEP-0444), replacing those we gave
         * it before. XEP-0444 has no "add one": each reaction stanza carries
         * the sender's whole set, so an empty set withdraws them all.
         *
         * The message's `reactions` are updated straight away. When the chat
         * is OMEMO-encrypted the reactions go through OMEMO, and if that send
         * fails the update is rolled back and the error re-thrown
         * (`api.omemo.send` has already alerted the user). Otherwise the
         * stanza is sent as is, and one that bounces is rolled back by the
         * `getErrorAttributesForMessage` hook.
         *
         * @method _converse.api.reactions.send
         * @param {BaseMessage} message - The message reacted to
         * @param {string[]} emojis - Our whole set of reactions to it, as unicode emojis
         * @returns {Promise<void>}
         */
        function send(message: BaseMessage, emojis: string[]): Promise<void>;
    }
}
export default _default;
export type BaseMessage = import("../../shared/message").default;
export type ChatBoxOrMUC = import("../../shared/types").ChatBoxOrMUC;
//# sourceMappingURL=api.d.ts.map