import Storage from '@converse/skeletor/src/storage.js';
import log from '@converse/headless/log';
import u from '@converse/headless/utils/core';
import { _converse, api } from '@converse/headless/core';

export function getDefaultStore () {
    if (_converse.config.get('trusted')) {
        const is_non_persistent = api.settings.get('persistent_store') === 'sessionStorage';
        return is_non_persistent ? 'session': 'persistent';
    } else {
        return 'session';
    }
}

export function createStore (id, store) {
    const name = store || getDefaultStore();
    const s = _converse.storage[name];
    if (typeof s === 'undefined') {
        throw new TypeError(`createStore: Could not find store for %{id}`);
    }
    return new Storage(id, s, api.settings.get('persistent_store') === 'IndexedDB');
}

export function initStorage (model, id, type) {
    const store = type || getDefaultStore();
    model.browserStorage = _converse.createStore(id, store);
    if (store === 'persistent' && api.settings.get('persistent_store') === 'IndexedDB') {
        const flush = () => model.browserStorage.flush();
        window.addEventListener(_converse.unloadevent, flush);
        model.on('destroy', () => window.removeEventListener(_converse.unloadevent, flush));
        model.listenTo(_converse, 'beforeLogout', flush);
    }
}

export function replacePromise (name) {
    const existing_promise = _converse.promises[name];
    if (!existing_promise) {
        throw new Error(`Tried to replace non-existing promise: ${name}`);
    }
    if (existing_promise.replace) {
        const promise = u.getResolveablePromise();
        promise.replace = existing_promise.replace;
        _converse.promises[name] = promise;
    } else {
        log.debug(`Not replacing promise "${name}"`);
    }
}
