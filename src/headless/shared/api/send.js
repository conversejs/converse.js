import _converse from '../_converse.js';
import log from "@converse/log";
import { Strophe } from 'strophe.js';
import { TimeoutError } from '../errors.js';

export default {
    /**
     * @typedef {import('strophe.js').Builder} Builder
     *
     * Allows you to send XML stanzas.
     * @method _converse.api.send
     * @param {Element|Builder} stanza
     * @returns {void}
     * @example
     * const msg = converse.env.$msg({
     *     'from': 'juliet@example.com/balcony',
     *     'to': 'romeo@example.net',
     *     'type':'chat'
     * });
     * _converse.api.send(msg);
     */
    send(stanza) {
        const { api } = _converse;
        if (!api.connection.connected()) {
            log.warn("Not sending stanza because we're not connected!");
            log.warn(Strophe.serialize(stanza));
            return;
        }
        const el = stanza instanceof Element ? stanza : stanza.tree();
        if (el.tagName === 'iq') {
            return api.sendIQ(el);
        } else {
            api.connection.get().send(el);
            api.trigger('send', el);
        }
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
     */
    sendIQ(stanza, timeout, reject = true) {
        const { api } = _converse;
        if (!api.connection.connected()) {
            throw new Error("Not sending IQ stanza because we're not connected!");
        }

        const connection = api.connection.get();

        let promise;
        const el = stanza instanceof Element ? stanza : stanza.tree();
        if (['get', 'set'].includes(el.getAttribute('type'))) {
            timeout = timeout || api.settings.get('stanza_timeout');
            if (reject) {
                promise = new Promise((resolve, reject) => connection.sendIQ(el, resolve, reject, timeout));
                promise.catch((e) => {
                    if (e === null) {
                        throw new TimeoutError(
                            `Timeout error after ${timeout}ms for the following IQ stanza: ${Strophe.serialize(el)}`
                        );
                    }
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
