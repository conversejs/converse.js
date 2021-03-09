import Storage from '@converse/skeletor/src/storage.js';
import _converse from '@converse/headless/shared/_converse';
import log from '@converse/headless/log';
import u from '@converse/headless/utils/core';


export function createStore (id, storage) {
    const s = _converse.storage[storage || _converse.getDefaultStore()];
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
