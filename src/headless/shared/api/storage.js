import { initStorage, createStore, getDefaultStore } from '../../utils/storage';

export default {
    /**
     * @namespace _converse.api.storage
     * @memberOf _converse.api.storage
     */
    storage: {
        init (model, id, type) {
            return initStorage(model, id, type);
        },

        create (id, store) {
            return createStore(id, store);
        },

        default () {
            return getDefaultStore();
        },
    },
};
