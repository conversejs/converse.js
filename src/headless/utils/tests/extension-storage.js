/**
 * Tests for the localForage drivers that wrap the browser extension storage
 * areas. The extension APIs are replaced by in-memory stubs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { local_driver, sync_driver } from '../extension-storage.js';

/**
 * @param {boolean} promises - Whether the stub returns promises or uses callbacks.
 */
function createArea(promises) {
    const data = {};
    const resolve = (value, callback) => {
        if (promises) return Promise.resolve(value);
        callback(value);
    };
    const pick = (keys) => {
        if (keys === null) return { ...data };
        const out = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
            if (key in data) out[key] = data[key];
        }
        return out;
    };
    const area = {
        data,
        get: (keys, callback) => resolve(pick(keys), callback),
        set: (items, callback) => {
            Object.assign(data, items);
            return resolve(undefined, callback);
        },
        remove: (keys, callback) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
            return resolve(undefined, callback);
        },
        clear: (callback) => {
            for (const key of Object.keys(data)) delete data[key];
            return resolve(undefined, callback);
        },
    };
    if (promises) return area;
    // Callback style: the methods take a callback and return nothing.
    return {
        data,
        get: (keys, callback) => area.get(keys, callback),
        set: (items, callback) => area.set(items, callback),
        remove: (keys, callback) => area.remove(keys, callback),
        clear: (callback) => area.clear(callback),
    };
}

describe('Extension storage drivers', function () {
    afterEach(function () {
        vi.unstubAllGlobals();
    });

    it('is not supported outside of an extension', function () {
        vi.stubGlobal('browser', undefined);
        vi.stubGlobal('chrome', undefined);
        expect(local_driver._support).toBe(false);
        expect(sync_driver._support).toBe(false);
    });

    it('is registered under the names used by persistent_store', function () {
        expect(local_driver._driver).toBe('webExtensionLocalStorage');
        expect(sync_driver._driver).toBe('webExtensionSyncStorage');
    });

    it('uses the local and sync storage areas respectively', async function () {
        const local = createArea(true);
        const sync = createArea(true);
        vi.stubGlobal('browser', { storage: { local, sync } });

        await local_driver.setItem('a', 1);
        await sync_driver.setItem('b', 2);
        expect(local.data).toEqual({ a: 1 });
        expect(sync.data).toEqual({ b: 2 });
    });

    it.each([
        ['promise based', true],
        ['callback based', false],
    ])('supports the full localForage interface with a %s API', async function (_label, promises) {
        const area = createArea(promises);
        vi.stubGlobal('chrome', { storage: { local: area, sync: createArea(promises) } });
        expect(local_driver._support).toBe(true);

        await local_driver._initStorage();
        expect(await local_driver.getItem('missing')).toBe(null);

        expect(await local_driver.setItem('first', { jid: 'juliet@capulet.lit' })).toEqual({
            jid: 'juliet@capulet.lit',
        });
        await local_driver.setItem('second', 'value');
        expect(await local_driver.getItem('first')).toEqual({ jid: 'juliet@capulet.lit' });

        expect(await local_driver.keys()).toEqual(['first', 'second']);
        expect(await local_driver.key(1)).toBe('second');
        expect(await local_driver.key(5)).toBe(null);
        expect(await local_driver.length()).toBe(2);

        const seen = [];
        await local_driver.iterate((value, key, i) => {
            seen.push([key, value, i]);
        });
        expect(seen).toEqual([
            ['first', { jid: 'juliet@capulet.lit' }, 0],
            ['second', 'value', 1],
        ]);

        await local_driver.removeItem('first');
        expect(await local_driver.keys()).toEqual(['second']);

        await local_driver.clear();
        expect(await local_driver.length()).toBe(0);
    });

    it('stops iterating and returns the value once the iterator returns one', async function () {
        vi.stubGlobal('browser', { storage: { local: createArea(true), sync: createArea(true) } });
        await local_driver.setItem('first', 1);
        await local_driver.setItem('second', 2);

        const visited = [];
        const result = await local_driver.iterate((_value, key) => {
            visited.push(key);
            return 'found';
        });
        expect(visited).toEqual(['first']);
        expect(result).toBe('found');
    });

    it('rejects when the callback API reports an error', async function () {
        const error = new Error('quota exceeded');
        const area = {
            get: (_keys, callback) => callback({}),
            set: (_items, callback) => callback(),
            remove: (_keys, callback) => callback(),
            clear: (callback) => callback(),
        };
        vi.stubGlobal('chrome', {
            runtime: { lastError: error },
            storage: { local: area, sync: area },
        });
        await expect(local_driver.setItem('a', 1)).rejects.toBe(error);
    });
});
