/**
 * @param {() => import('@converse/skeletor').StorageDriver} factory
 */
export function registerNodeStoreFactory(factory: () => import("@converse/skeletor").StorageDriver): void;
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
export function getNodeStore(): import("@converse/skeletor").StorageDriver;
//# sourceMappingURL=node-store.d.ts.map