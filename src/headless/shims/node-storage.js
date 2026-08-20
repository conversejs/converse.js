/**
 * Node.js storage.
 *
 * Registers the single `NodeSQLiteStorage` instance that every store shares, so
 * that Converse keeps its state in one database rather than the one-file-per-
 * store that skeletor's `'node'` store type would produce (a single login opens
 * around forty). See {@link module:utils/storage.getNodeStore} for why keys
 * can't collide.
 *
 * This lives in `shims/` because it reaches for `node:os` and `node:path` and
 * for a driver only skeletor's Node build registers, none of which can be
 * allowed into the browser bundle.
 *
 * @module shims/node-storage
 */
import os from 'node:os';
import path from 'node:path';
import { PersistentStorage } from '@converse/skeletor';
import { settings_api } from '../shared/settings/api.js';
import { isTestEnv } from '../utils/session.js';
import { registerNodeStoreFactory } from '../utils/node-store.js';

/**
 * Where the database goes. `storage_path` wins if set; otherwise the XDG state
 * directory, which is where a long-running client's state belongs. Falling back
 * to the working directory, as skeletor does, would scatter a directory behind
 * a TUI wherever it happened to be started from.
 * @returns {string}
 */
function getStorageDir() {
    const configured = settings_api.get('storage_path');
    if (configured) return configured;

    const state_home = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
    return path.join(state_home, 'converse');
}

registerNodeStoreFactory(() => {
    // Set by skeletor's Node build; typed by its published node declarations.
    const NodeSQLiteStorage = PersistentStorage.nodeStorage;
    if (!NodeSQLiteStorage) {
        throw new Error(
            'shims/node-storage: @converse/skeletor resolved to its browser build, which has no SQLite driver. ' +
                'Check that the `node` export condition is being applied.',
        );
    }
    return new NodeSQLiteStorage(isTestEnv() ? 'converse-test' : 'converse', getStorageDir(), false);
});
