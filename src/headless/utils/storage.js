import Storage from '@converse/skeletor/src/storage.js';
import _converse from '../shared/_converse.js';
import { settings_api } from '../shared/settings/api.js';
import { getUnloadEvent } from './session.js';

const settings = settings_api;

export function getDefaultStore() {
    if (_converse.state.config.get('trusted')) {
        const is_non_persistent = settings.get('persistent_store') === 'sessionStorage';
        return is_non_persistent ? 'session' : 'persistent';
    } else {
        return 'session';
    }
}

function storeUsesIndexedDB(store) {
    return store === 'persistent' && settings.get('persistent_store') === 'IndexedDB';
}

export function createStore(id, store) {
    const name = store || getDefaultStore();
    const s = _converse.storage[name];
    if (typeof s === 'undefined') {
        throw new TypeError(`createStore: Could not find store for ${id}`);
    }
    return new Storage(id, s, storeUsesIndexedDB(store));
}

export function initStorage(model, id, type) {
    const store = type || getDefaultStore();
    model.browserStorage = createStore(id, store);
    if (storeUsesIndexedDB(store)) {
        const flush = () => model.browserStorage.flush();
        const unloadevent = getUnloadEvent();
        window.addEventListener(unloadevent, flush);
        model.on('destroy', () => window.removeEventListener(unloadevent, flush));
        model.listenTo(_converse, 'beforeLogout', flush);
    }
}
