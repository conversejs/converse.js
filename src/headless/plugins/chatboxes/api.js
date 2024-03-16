/**
 * @typedef {import('@converse/skeletor').Model} Model
 * @typedef {import('../chat/model.js').default} ChatBox
 */
import _converse from '../../shared/_converse.js';
import promise_api from '../../shared/api/promise.js';
import { createChatBox } from './utils.js';

const { waitUntil } = promise_api;
const _chatBoxTypes = {};


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
     * @param {new (attrs: object, options: object) => ChatBox} model - The type of chatbox that should be created
     */
    async create (jids=[], attrs={}, model) {
        await waitUntil('chatBoxesFetched');
        if (typeof jids === 'string') {
            return createChatBox(jids, attrs, model);
        } else {
            return Promise.all(jids.map(jid => createChatBox(jid, attrs, model)));
        }
    },

    /**
     * @method api.chatboxes.get
     * @param {string|string[]} [jids] - A JID or array of JIDs
     */
    async get (jids) {
        await waitUntil('chatBoxesFetched');
        const { chatboxes } = _converse.state;
        if (jids === undefined) {
            return chatboxes.models;
        } else if (typeof jids === 'string') {
            return chatboxes.get(jids.toLowerCase());
        } else {
            jids = jids.map(j => j.toLowerCase());
            return chatboxes.models.filter(m => jids.includes(m.get('jid')));
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
