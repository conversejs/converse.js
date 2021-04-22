import Storage from '@converse/skeletor/src/storage.js';
import { _converse, api } from '@converse/headless/core';
import log from '@converse/headless/log';
import u from '@converse/headless/utils/core';

export function getDefaultStore () {
    if (_converse.config.get('trusted')) {
        const is_non_persistent = api.settings.get('persistent_store') === 'sessionStorage';
        return is_non_persistent ? 'session': 'persistent';
    } else {
        return 'session';
    }
}

export function createStore (id, storage) {
    const s = _converse.storage[storage || getDefaultStore()];
    if (typeof s === 'undefined') {
        throw new TypeError(`createStore: Could not find store for %{id}`);
    }
    return new Storage(id, s);
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
