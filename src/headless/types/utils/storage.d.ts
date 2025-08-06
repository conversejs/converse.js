/**
 * @returns {import('./types').StorageType}
 */
export function getDefaultStorageType(): import("./types").StorageType;
/**
 * @param {string} id
 * @param {import('./types').StorageType} type
 */
export function createStore(id: string, type: import("./types").StorageType): any;
/**
 * @param {import('@converse/skeletor').Model|import('@converse/skeletor').Collection} model
 * @param {string} id
 * @param {import('./types').StorageType} [type]
 */
export function initStorage(model: import("@converse/skeletor").Model | import("@converse/skeletor").Collection, id: string, type?: import("./types").StorageType): void;
//# sourceMappingURL=storage.d.ts.map