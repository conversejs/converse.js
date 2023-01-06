declare namespace _default {
    /**
     * Pings the entity represented by the passed in JID by sending an IQ stanza to it.
     * @method api.ping
     * @param { String } [jid] - The JID of the service to ping
     *  If the ping is sent out to the user's bare JID and no response is received it will attempt to reconnect.
     * @param { Integer } [timeout] - The amount of time in
     *  milliseconds to wait for a response. The default is 10000;
     * @returns { Boolean | null }
     *  Whether the pinged entity responded with a non-error IQ stanza.
     *  If we already know we're not connected, no ping is sent out and `null` is returned.
     */
    function ping(jid?: string, timeout?: Integer): boolean;
}
export default _default;
