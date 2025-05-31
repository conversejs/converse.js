import promise_api from '../../shared/api/promise.js';
import { sendBlockStanza, sendUnblockStanza } from './utils.js';

const { waitUntil } = promise_api;

/**
 * Groups methods relevant to XEP-0191 Blocking Command
 * @namespace api.blocklist
 * @memberOf api
 */
const blocklist = {
    /**
     * Retrieves the current user's blocklist
     * @returns {Promise<import('./collection').default>}
     */
    async get() {
        return await waitUntil('blocklistInitialized');
    },

    /**
     * Adds a new entity to the blocklist
     * @param {string|string[]} jid
     * @param {boolean} [send_stanza=true]
     * @returns {Promise<import('./collection').default>}
     */
    async add(jid, send_stanza = true) {
        const blocklist = await waitUntil('blocklistInitialized');
        const jids = Array.isArray(jid) ? jid : [jid];
        if (send_stanza) await sendBlockStanza(jids);
        jids.forEach((jid) => blocklist.create({ jid }));
        return blocklist;
    },

    /**
     * Removes an entity from the blocklist
     * @param {string|string[]} jid
     * @param {boolean} [send_stanza=true]
     * @returns {Promise<import('./collection').default>}
     */
    async remove(jid, send_stanza = true) {
        const blocklist = await waitUntil('blocklistInitialized');
        const jids = Array.isArray(jid) ? jid : [jid];
        if (send_stanza) await sendUnblockStanza(jids);
        jids.forEach((jid) => blocklist.get(jid)?.destroy());
        blocklist.remove(jids);
        return blocklist;
    },
};

const blocklist_api = { blocklist };

export default blocklist_api;
