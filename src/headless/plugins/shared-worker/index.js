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
 * Asks the worker to attach this tab to its session, and resolves with
 * whether it did. The connection's status handler takes it from there.
 * @returns {Promise<boolean>}
 */
function attach() {
    const connection = api.connection.get();
    return new Promise((resolve) => {
        connection.attach(
            /**
             * @param {number} status
             * @param {string} [condition]
             * @param {Element} [elem]
             */
            (status, condition, elem) => {
                if (status === Strophe.Status.ATTACHFAIL) {
                    resolve(false);
                } else if (status === Strophe.Status.ATTACHED || status === Strophe.Status.CONNECTED) {
                    resolve(true);
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
