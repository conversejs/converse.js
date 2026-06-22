/**
 * @returns {import('./types').StorageType}
 */
export function getDefaultStorageType(): import("./types").StorageType;
/**
 * @returns {boolean}
 */
export function isPersistentStorageAvailable(): boolean;
/**
 * @param {string} id
 * @param {import('./types').StorageType} type
 * @returns {PersistentStorage}
 */
export function createStore(id: string, type: import("./types").StorageType): PersistentStorage;
/**
 * @param {import('./types').StorageModel} model
 * @param {string} id
 * @param {import('./types').StorageType} [type]
 */
export function initStorage(model: import("./types").StorageModel, id: string, type?: import("./types").StorageType): void;
import { PersistentStorage } from '@converse/skeletor';
//# sourceMappingURL=storage.d.ts.map