/**
 * @returns {import('./types').StorageType}
 */
export function getDefaultStorageType(): import("./types").StorageType;
/**
 * @param {string} id
 * @param {import('./types').StorageType} type
 * @returns {BrowserStorage}
 */
export function createStore(id: string, type: import("./types").StorageType): BrowserStorage;
/**
 * @param {import('./types').StorageModel} model
 * @param {string} id
 * @param {import('./types').StorageType} [type]
 */
export function initStorage(model: import("./types").StorageModel, id: string, type?: import("./types").StorageType): void;
import { BrowserStorage } from '@converse/skeletor';
//# sourceMappingURL=storage.d.ts.map