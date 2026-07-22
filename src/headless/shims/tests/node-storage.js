/**
 * Covers the arrangement `utils/storage.js` relies on under Node: one
 * `NodeSQLiteStorage` shared by every `PersistentStorage`, rather than
 * skeletor's `'node'` store type, which builds one database file per store.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Model, NodeSQLiteStorage, PersistentStorage } from '@converse/skeletor';
import { getNodeStore, registerNodeStoreFactory } from '../../utils/node-store.js';

/** @type {string} */
let dir;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'converse-store-'));
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * @param {Model} model
 * @param {object} attrs
 */
function save(model, attrs) {
    return new Promise((resolve, reject) => model.save(attrs, { success: resolve, error: (_, e) => reject(e) }));
}

/**
 * @param {Model} model
 */
function fetch(model) {
    return new Promise((resolve, reject) => model.fetch({ success: resolve, error: (_, e) => reject(e) }));
}

describe('the shared Node storage driver', () => {
    it('keeps every store in a single database file', async () => {
        const shared = new NodeSQLiteStorage('converse', dir, false);

        const alpha = new Model({ id: '1' });
        alpha.storage = new PersistentStorage('alpha', shared);
        const beta = new Model({ id: '1' });
        beta.storage = new PersistentStorage('beta', shared);

        await save(alpha, { who: 'alpha-one' });
        await save(beta, { who: 'beta-one' });

        expect(fs.readdirSync(dir)).toEqual(['converse.db']);
    });

    it('does not let two stores collide on the same model id', async () => {
        // `PersistentStorage.getItemName()` prefixes every key with the store
        // name, which is what makes one shared database safe.
        const shared = new NodeSQLiteStorage('converse', dir, false);

        const alpha = new Model({ id: '1' });
        alpha.storage = new PersistentStorage('alpha', shared);
        const beta = new Model({ id: '1' });
        beta.storage = new PersistentStorage('beta', shared);

        await save(alpha, { who: 'alpha-one' });
        await save(beta, { who: 'beta-one' });

        const refetched = new Model({ id: '1' });
        refetched.storage = new PersistentStorage('beta', shared);
        await fetch(refetched);
        expect(refetched.get('who')).toBe('beta-one');

        expect(await shared.getItem('alpha-1')).toEqual({ id: '1', who: 'alpha-one' });
        expect(await shared.getItem('beta-1')).toEqual({ id: '1', who: 'beta-one' });
    });

    it('leaves the write buffer alone when batched writes are off', () => {
        // Each PersistentStorage constructed with batchedWrites reassigns
        // `driver.debouncedSetItems`, so instances sharing a driver would share
        // one debounce buffer. Converse never asks for it under Node
        // (`storeUsesIndexedDB()` is browser-only), and this pins that down.
        const shared = new NodeSQLiteStorage('converse', dir, false);
        new PersistentStorage('alpha', shared);
        new PersistentStorage('beta', shared);

        expect(shared.debouncedSetItems).toBeUndefined();
    });

    it('builds the driver once and reuses it', () => {
        let built = 0;
        registerNodeStoreFactory(() => {
            built++;
            return new NodeSQLiteStorage('converse', dir, false);
        });

        expect(getNodeStore()).toBe(getNodeStore());
        expect(built).toBe(1);
    });

    it('defers building the driver until a store is asked for', () => {
        registerNodeStoreFactory(() => new NodeSQLiteStorage('converse', dir, false));
        expect(fs.readdirSync(dir)).toEqual([]);

        getNodeStore();
        expect(fs.readdirSync(dir)).toEqual(['converse.db']);
    });
});
