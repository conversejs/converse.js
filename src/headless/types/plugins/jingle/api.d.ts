declare namespace _default {
    /**
     * Start an outgoing audio call. Calls are one at a time: dialling the peer
     * of the live call returns that call, and dialling anyone else returns null.
     * @method api.calls.dial
     * @param {string} jid - the contact to call
     * @returns {import('./model.js').default|null}
     */
    function dial(jid: string): import("./model.js").default | null;
    /**
     * Look up the live call by its session id or by the peer's JID. Ended
     * calls are no longer kept.
     * @method api.calls.get
     * @param {string} [id_or_jid] - omit to get all live calls
     * @returns {import('./model.js').default|import('./model.js').default[]|undefined}
     */
    function get(id_or_jid?: string): import("./model.js").default | import("./model.js").default[] | undefined;
}
export default _default;
//# sourceMappingURL=api.d.ts.map