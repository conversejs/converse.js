import { PersistentStorage } from '@converse/skeletor';
import _converse from '../shared/_converse.js';
import { settings_api } from '../shared/settings/api.js';
import { getUnloadEvent } from './session.js';

const settings = settings_api;

/**
 * @returns {import('./types').StorageType}
 */
export function getDefaultStorageType() {
    if (_converse.state.config.get('trusted')) {
        const is_non_persistent = settings.get('persistent_store') === 'sessionStorage';
        return is_non_persistent ? 'session' : 'persistent';
    } else {
        return 'session';
    }
}

/**
 * @param {import('./types').StorageType} type
 */
function storeUsesIndexedDB(type) {
    return type === 'persistent' && settings.get('persistent_store') === 'IndexedDB';
}

/**
 * @returns {boolean}
 */
export function isPersistentStorageAvailable() {
    const store = settings.get('persistent_store');
    if (store === 'sessionStorage') {
        try {
            return typeof globalThis.sessionStorage !== 'undefined';
        } catch {
            return false;
        }
    } else if (store === 'BrowserExtLocal' || store === 'BrowserExtSync') {
        return true;
    }

    const driver =
        store === 'localStorage'
            ? PersistentStorage.localForage.LOCALSTORAGE
            : store === 'IndexedDB'
              ? PersistentStorage.localForage.INDEXEDDB
              : undefined;
    return driver ? PersistentStorage.localForage.supports(driver) : true;
}

/**
 * @param {string} id
 * @param {import('./types').StorageType} type
 * @returns {PersistentStorage}
 */
export function createStore(id, type) {
    const name = type || getDefaultStorageType();
    const s = _converse.storage[name];
    if (typeof s === 'undefined') {
        throw new TypeError(`createStore: Could not find store for ${id}`);
    }
    return new PersistentStorage(id, s, storeUsesIndexedDB(type));
}

/**
 * @param {import('./types').StorageModel} model
 * @param {string} id
 * @param {import('./types').StorageType} [type]
 */
export function initStorage(model, id, type) {
    type = type || getDefaultStorageType();
    model.storage = createStore(id, type);
    if (storeUsesIndexedDB(type)) {
        const flush = () => model.storage.flush();
        const unloadevent = getUnloadEvent();
        window.addEventListener(unloadevent, flush);
        model.on('destroy', () => window.removeEventListener(unloadevent, flush));
        model.listenTo(_converse, 'beforeLogout', flush);
    }
}
