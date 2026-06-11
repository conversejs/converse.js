declare namespace _default {
    /**
     * Start an outgoing call to a contact. Returns the live call if one is
     * already in progress (one call at a time).
     * @method api.calls.dial
     * @param {string} jid - the contact to call
     * @param {{ audio?: boolean }} [opts]
     * @returns {Call}
     */
    function dial(jid: string, opts?: {
        audio?: boolean;
    }): Call;
    /**
     * Look up a call by its session id or by the peer's JID.
     * @method api.calls.get
     * @param {string} [id_or_jid] - omit to get all live calls
     * @returns {Call|Call[]|undefined}
     */
    function get(id_or_jid?: string): Call | Call[] | undefined;
}
export default _default;
export type Call = import("./model.js").default;
//# sourceMappingURL=api.d.ts.map