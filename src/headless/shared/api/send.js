import _converse from '../_converse.js';
import log from '@converse/log';
import { CodedError } from '../errors.js';

export default {
    /**
     * @typedef {import('strophe.js').Builder} Builder
     *
     * Allows you to send XML stanzas.
     *
     * Nothing is sent before the session is authenticated (see
     * {@link api.connection.authenticated}). To defer work until sending is
     * possible, wait for the `connected` or `reconnected` event.
     *
     * A message or presence that's refused is dropped, without an error,
     * and the result says so.
     * @method _converse.api.send
     * @param {Element|Builder} stanza
     * @returns {boolean|Promise<any>} For a message or presence, whether it
     *  was sent. For an IQ, the promise that {@link api.sendIQ} returns.
     * @example
     *     const { stx } = _converse.env;
     *     const msg = stx`<message from="juliet@example.com/balcony" to="romeo@example.net" type="chat"/>`;
     *     _converse.api.send(msg);
     */
    send(stanza) {
        const { api } = _converse;
        const el = stanza instanceof Element ? stanza : stanza.tree();
        if (!api.connection.authenticated()) {
            log.warn("Not sending stanza because we're not authenticated!");
            log.warn(el);
            return false;
        }
        if (el.tagName === 'iq') return api.sendIQ(el);

        api.connection.get().send(el);
        api.trigger('send', el);
        return true;
    },

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
     * @throws {CodedError} With the code `not-connected` if the session isn't
     *  authenticated yet, since the server would reject the stanza and close the stream.
     */
    sendIQ(stanza, timeout, reject = true) {
        const { api } = _converse;
        const el = stanza instanceof Element ? stanza : stanza.tree();
        if (!api.connection.authenticated()) {
            // The stanza may hold a password, so it stays out of the message, which callers log and relay.
            log.debug(el);
            throw new CodedError(
                'not-connected',
                `Not sending IQ stanza because we're not authenticated (id "${el.getAttribute('id')}", ` +
                    `to "${el.getAttribute('to')}", ${el.firstElementChild?.namespaceURI})`,
            );
        }

        const connection = api.connection.get();

        let promise;
        if (['get', 'set'].includes(el.getAttribute('type'))) {
            timeout = timeout || api.settings.get('stanza_timeout');
            if (reject) {
                promise = new Promise((resolve, reject) => connection.sendIQ(el, resolve, reject, timeout));
                // Callers get `null` on a timeout. Only log here: throwing would
                // reject this derived promise, which nobody handles.
                promise.catch((e) => {
                    if (e === null) log.error(`Timeout error after ${timeout}ms for IQ stanza`, el);
                });
            } else {
                promise = new Promise((resolve) => connection.sendIQ(el, resolve, resolve, timeout));
            }
        } else {
            connection.sendIQ(el);
            promise = Promise.resolve();
        }
        api.trigger('send', el);
        return promise;
    },
};
