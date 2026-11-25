/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Attaches to the connection that a shared worker holds, so that
 *  tabs share one connection (the `worker` option of `connection_options`).
 */
import { Strophe } from 'strophe.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { IS_BROWSER } from '../../utils/environment.js';

function usesWorker() {
    return !!api.settings.get('connection_options')?.worker;
}

/**
 * Asks the worker to attach this tab to its session. Resolves with `false`
 * if login should connect anew, and with `true` if there's nothing left for
 * it to do: the tab attached, or its connection was ended while attaching
 * (for example by logging out). The connection's status handler takes it
 * from there.
 * @returns {Promise<boolean>}
 */
function attach() {
    const connection = api.connection.get();
    const { ATTACHED, ATTACHFAIL, CONNECTED, CONNFAIL, DISCONNECTED } = Strophe.Status;
    let settled = false;
    let abandoned = false;

    return new Promise((resolve) => {
        /** @param {boolean} done */
        const settle = (done) => {
            settled = true;
            resolve(done);
        };
        connection.attach(
            /**
             * @param {number} status
             * @param {string} [condition]
             * @param {Element} [elem]
             */
            (status, condition, elem) => {
                // Login connects anew, so the end of this attempt is not a
                // disconnection to reconnect from.
                if (abandoned) return;

                if (!settled) {
                    if (status === CONNFAIL) {
                        // The worker has no session for this tab after all,
                        // for example because its socket is gone or it speaks
                        // another protocol version.
                        abandoned = true;
                        return settle(false);
                    }
                    if (status === ATTACHFAIL) {
                        settle(false);
                    } else if (status === ATTACHED || status === CONNECTED || status === DISCONNECTED) {
                        settle(true);
                    }
                }
                connection.onConnectStatusChanged(status, condition, elem);
            },
        );
    });
}

/**
 * @param {null} _context
 * @param {import('../../shared/api/types').AttachSessionPayload} payload
 * @returns {Promise<import('../../shared/api/types').AttachSessionPayload>}
 */
async function attachToWorker(_context, payload) {
    if (payload.attached || !usesWorker()) return payload;

    return { ...payload, attached: await attach() };
}

converse.plugins.add('converse-shared-worker', {
    enabled() {
        // Shared workers only exist in a browser.
        return IS_BROWSER;
    },

    initialize() {
        api.listen.on('attachSession', attachToWorker);
        // Every tab reads the session that the worker holds.
        api.listen.on('shouldShareSession', (_context, shared) => shared || usesWorker());
    },
});
