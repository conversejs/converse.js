import _converse from '../../shared/_converse.js';
import log from '../../log.js';
import { Strophe } from 'strophe.js/src/strophe';
import { TimeoutError } from '../errors.js';
import { toStanza } from '../../utils/stanza.js';

export default {
    /**
     * Allows you to send XML stanzas.
     * @method _converse.api.send
     * @param { Element | Stanza } stanza
     * @return { void }
     * @example
     * const msg = converse.env.$msg({
     *     'from': 'juliet@example.com/balcony',
     *     'to': 'romeo@example.net',
     *     'type':'chat'
     * });
     * _converse.api.send(msg);
     */
    send (stanza) {
        const { api } = _converse;
        if (!api.connection.connected()) {
            log.warn("Not sending stanza because we're not connected!");
            log.warn(Strophe.serialize(stanza));
            return;
        }
        if (typeof stanza === 'string') {
            stanza = toStanza(stanza);
        } else if (stanza?.tree) {
            stanza = stanza.tree();
        }

        if (stanza.tagName === 'iq') {
            return api.sendIQ(stanza);
        } else {
            _converse.connection.send(stanza);
            api.trigger('send', stanza);
        }
    },

    /**
     * Send an IQ stanza
     * @method _converse.api.sendIQ
     * @param { Element } stanza
     * @param { number } [timeout] - The default timeout value is taken from
     *  the `stanza_timeout` configuration setting.
     * @param { Boolean } [reject=true] - Whether an error IQ should cause the promise
     *  to be rejected. If `false`, the promise will resolve instead of being rejected.
     * @returns { Promise } A promise which resolves (or potentially rejected) once we
     *  receive a `result` or `error` stanza or once a timeout is reached.
     *  If the IQ stanza being sent is of type `result` or `error`, there's
     *  nothing to wait for, so an already resolved promise is returned.
     */
    sendIQ (stanza, timeout, reject=true) {
        const { api, connection } = _converse;

        let promise;
        stanza = stanza.tree?.() ?? stanza;
        if (['get', 'set'].includes(stanza.getAttribute('type'))) {
            timeout = timeout || api.settings.get('stanza_timeout');
            if (reject) {
                promise = new Promise((resolve, reject) => connection.sendIQ(stanza, resolve, reject, timeout));
                promise.catch((e) => {
                    if (e === null) {
                        throw new TimeoutError(
                            `Timeout error after ${timeout}ms for the following IQ stanza: ${Strophe.serialize(stanza)}`
                        );
                    }
                });
            } else {
                promise = new Promise((resolve) => connection.sendIQ(stanza, resolve, resolve, timeout));
            }
        } else {
            _converse.connection.sendIQ(stanza);
            promise = Promise.resolve();
        }
        api.trigger('send', stanza);
        return promise;
    }
}
