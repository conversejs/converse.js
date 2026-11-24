/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Attaches to the connection that a shared worker holds, so that
 *  tabs share one connection (the `worker` option of `connection_options`).
 */
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { IS_BROWSER } from '../../utils/environment.js';

/**
 * @param {null} _context
 * @param {import('../../shared/api/types').AttachSessionPayload} payload
 * @returns {Promise<import('../../shared/api/types').AttachSessionPayload>}
 */
async function attachToWorker(_context, payload) {
    if (payload.attached || !api.settings.get('connection_options')?.worker) return payload;

    const attached = await api.connection.get().restoreWorkerSession();
    return { ...payload, attached };
}

converse.plugins.add('converse-shared-worker', {
    enabled() {
        // Shared workers only exist in a browser.
        return IS_BROWSER;
    },

    initialize() {
        api.listen.on('attachSession', attachToWorker);
    },
});
