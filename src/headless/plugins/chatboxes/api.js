import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { createChatBox } from './utils.js';

const _chatBoxTypes = {};

/** @typedef {import('@converse/skeletor').Model} Model */

/**
 * The "chatboxes" namespace.
 *
 * @namespace api.chatboxes
 * @memberOf api
 */
export default {
    /**
     * @method api.chatboxes.create
     * @param {string|string[]} jids - A JID or array of JIDs
     * @param {Object} attrs An object containing configuration attributes
     * @param {Model} model - The type of chatbox that should be created
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
     * @method api.chatboxes.get
     * @param {string|string[]} jids - A JID or array of JIDs
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
    },

    /**
     * The "chatboxes" registry.
     * Allows you to register more chatbox types that can be created via
     * `api.chatboxes.create`.
     * @namespace api.chatboxes.registry
     * @memberOf api.chatboxes
     */
    registry: {
        /**
         * @method api.chatboxes.registry.add
         * Add another type of chatbox that can be added to this collection.
         * This is used in the `createModel` function to determine what type of
         * chatbox class to instantiate (e.g. ChatBox, MUC, Feed etc.) based on the
         * passed in attributes.
         * @param {string} type - The type name
         * @param {Model} model - The model which will be instantiated for the given type name.
         */
        add(type, model) {
            _chatBoxTypes[type] = model;
        },

        /**
         * @method api.chatboxes.registry.get
         * @param {string} type - The type name
         * @return {Model} model - The model which will be instantiated for the given type name.
         */
        get(type) {
            return _chatBoxTypes[type];
        }
    }
}
