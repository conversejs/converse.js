/**
 * The storage driver Node uses.
 *
 * Kept out of `utils/storage.js` because everything that module exports is
 * spread into the public `u` namespace, and neither of these belongs there:
 * `registerNodeStoreFactory` does nothing useful to a browser consumer and
 * `getNodeStore` throws for one.
 *
 * @module utils/node-store
 */

/**
 * Builds the storage driver Node uses. Registered by `shims/node-storage.js`,
 * which the Node entry point imports; left null in the browser so that nothing
 * Node-only can reach the bundle.
 * @type {(() => import('@converse/skeletor').StorageDriver)|null}
 */
let node_store_factory = null;

/** @type {import('@converse/skeletor').StorageDriver|null} */
let node_store = null;

/**
 * @param {() => import('@converse/skeletor').StorageDriver} factory
 */
export function registerNodeStoreFactory(factory) {
    node_store_factory = factory;
    node_store = null;
}

/**
 * The single storage driver shared by every store under Node, built on first
 * use so that no database file is created before Converse is configured.
 *
 * Sharing one driver is what keeps Node to a single database file: skeletor's
 * `'node'` store type would otherwise build a `NodeSQLiteStorage` per store,
 * and a single login opens around forty of them. Keys can't collide across
 * stores because `PersistentStorage.getItemName()` already prefixes each one
 * with the store's name. This mirrors the browser, where a single shared
 * localForage instance backs every `PersistentStorage`.
 *
 * @returns {import('@converse/skeletor').StorageDriver}
 */
export function getNodeStore() {
    if (!node_store_factory) {
        throw new Error(
            'getNodeStore: no Node storage driver was registered. ' +
                "Import @converse/headless from Node (or via '@converse/headless/node') rather than the browser bundle.",
        );
    }
    node_store ??= node_store_factory();
    return node_store;
}
