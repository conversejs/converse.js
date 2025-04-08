declare namespace _default {
    /**
     * @typedef {import('strophe.js').Builder} Builder
     *
     * Allows you to send XML stanzas.
     * @method _converse.api.send
     * @param {Element|Builder} stanza
     * @returns {void}
     * @example
     *     const { stx } = _converse.env;
     *     const msg = stx`<message from="juliet@example.com/balcony" to="romeo@example.net" type="chat"/>`;
     *     _converse.api.send(msg);
     */
    function send(stanza: Element | import("strophe.js").Builder): void;
    /**
     * Send an IQ stanza
     * @method _converse.api.sendIQ
     * @param {Element|Builder} stanza
     * @param {number} [timeout] - The default timeout value is taken from
     *  the `stanza_timeout` configuration setting.
     * @param {boolean} [reject=true] - Whether an error IQ should cause the promise
     *  to be rejected. If `false`, the promise will resolve instead of being rejected.
     * @returns {Promise} A promise which resolves (or potentially rejected) once we
     *  receive a `result` or `error` stanza or once a timeout is reached.
     *  If the IQ stanza being sent is of type `result` or `error`, there's
     *  nothing to wait for, so an already resolved promise is returned.
     */
    function sendIQ(stanza: Element | import("strophe.js").Builder, timeout?: number, reject?: boolean): Promise<any>;
}
export default _default;
//# sourceMappingURL=send.d.ts.map