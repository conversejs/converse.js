/**
 * localForage drivers backed by the browser extension storage areas, used when
 * Converse runs inside a browser extension (`persistent_store` set to
 * `BrowserExtLocal` or `BrowserExtSync`).
 *
 * Both `browser.storage` (promise based) and the older callback based
 * `chrome.storage` are supported. The globals are looked up at call time, so
 * that tests can stub them.
 */

/**
 * @param {string} area_name - Either `local` or `sync`.
 * @returns {import('./types').ExtensionStorageArea | undefined}
 */
function getArea(area_name) {
    const storage = globalThis.browser?.storage || globalThis.chrome?.storage;
    return storage?.[area_name];
}

/**
 * Probes whether the area's methods return promises. Chrome's `storage` API
 * does so when no callback is passed, so the global it came from can't tell us.
 * @param {import('./types').ExtensionStorageArea} area
 * @returns {boolean}
 */
function probePromises(area) {
    try {
        const result = area.get(null);
        if (typeof result?.then !== 'function') return false;
        // The probe's result is unused, so a rejection must not go unhandled.
        result.then(undefined, () => {});
        return true;
    } catch {
        return false;
    }
}

/** @type {WeakMap<object, boolean>} */
const promise_support = new WeakMap();

/**
 * @param {import('./types').ExtensionStorageArea} area
 * @returns {boolean}
 */
function usesPromises(area) {
    if (!promise_support.has(area)) {
        promise_support.set(area, probePromises(area));
    }
    return promise_support.get(area);
}

/**
 * Calls a method on an extension storage area and returns a promise for its
 * result, whichever API style the area uses.
 * @param {string} area_name - Either `local` or `sync`.
 * @param {'get' | 'set' | 'remove' | 'clear'} method
 * @param {...any} args
 * @returns {Promise<any>}
 */
function call(area_name, method, ...args) {
    const area = getArea(area_name);
    if (!area) return Promise.reject(new Error(`Extension storage area "${area_name}" is not available`));

    if (usesPromises(area)) return Reflect.apply(area[method], area, args);

    return new Promise((resolve, reject) => {
        const callback = (result) => {
            const error = globalThis.chrome?.runtime?.lastError;
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        };
        Reflect.apply(area[method], area, [...args, callback]);
    });
}

/**
 * @param {string} name - The localForage driver name.
 * @param {string} area_name - Either `local` or `sync`.
 * @returns {LocalForageDriver}
 */
function createExtensionDriver(name, area_name) {
    /** @returns {Promise<Record<string, any>>} */
    const getAll = () => call(area_name, 'get', null);

    return {
        _driver: name,
        get _support() {
            return !!getArea(area_name);
        },
        _initStorage: () => Promise.resolve(),

        clear: () => call(area_name, 'clear'),

        getItem: async (key) => {
            const items = await call(area_name, 'get', key);
            return items[key] === undefined ? null : items[key];
        },

        setItem: async (key, value) => {
            await call(area_name, 'set', { [key]: value });
            return value;
        },

        removeItem: (key) => call(area_name, 'remove', key),

        keys: async () => Object.keys(await getAll()),

        key: async (n) => Object.keys(await getAll())[n] ?? null,

        length: async () => Object.keys(await getAll()).length,

        iterate: async (iterator) => {
            const items = await getAll();
            const keys = Object.keys(items);
            for (let i = 0; i < keys.length; i++) {
                const result = iterator(items[keys[i]], keys[i], i);
                if (result !== undefined) return result;
            }
            return undefined;
        },
    };
}

export const local_driver = createExtensionDriver('webExtensionLocalStorage', 'local');
export const sync_driver = createExtensionDriver('webExtensionSyncStorage', 'sync');
