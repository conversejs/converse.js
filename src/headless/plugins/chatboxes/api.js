import { _converse, api } from "../../core.js";
import { createChatBox } from './utils.js';

/**
 * The "chatboxes" namespace.
 *
 * @namespace api.chatboxes
 * @memberOf api
 */
export default {
    /**
     * @method api.chats.create
     * @param { String|String[] } jids - A JID or array of JIDs
     * @param { Object } [attrs] An object containing configuration attributes
     * @param { Model } model - The type of chatbox that should be created
     */
    async create (jids=[], attrs={}, model) {
        await api.waitUntil('chatBoxesFetched');
        if (typeof jids === 'string') {
            return createChatBox(jids, attrs, model);
        } else {
            return Promise.all(jids.map(jid => createChatBox(jid, attrs, model)));
        }
    },

    /**
     * @method api.chats.get
     * @param { String|String[] } jids - A JID or array of JIDs
     */
    async get (jids) {
        await api.waitUntil('chatBoxesFetched');
        if (jids === undefined) {
            return _converse.chatboxes.models;
        } else if (typeof jids === 'string') {
            return _converse.chatboxes.get(jids.toLowerCase());
        } else {
            jids = jids.map(j => j.toLowerCase());
            return _converse.chatboxes.models.filter(m => jids.includes(m.get('jid')));
        }
    }
}
