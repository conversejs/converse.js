import log from '@converse/log';

let _promise;

/** @type {(() => Promise<typeof import('libomemo.js')>)|null} */
let _loader = null;

/**
 * Overrides how libomemo.js is loaded. Registered by `shims/node-omemo.js`,
 * because under Node the library comes from the package rather than from a file
 * served next to the bundle.
 * @param {() => Promise<typeof import('libomemo.js')>} loader
 */
export function setCryptoLoader(loader) {
    _loader = loader;
}

/**
 * Loads libomemo.js from the file served alongside converse-headless.js.
 * @returns {Promise<typeof import('libomemo.js')>}
 */
function loadFromAssetDirectory() {
    // @ts-expect-error - resolved at runtime from dist/, not source
    return import(/* webpackIgnore: true */ './libomemo.esm.min.js');
}

/**
 * Dynamically imports libomemo.js (GPL-3.0 licensed).
 * The dynamic import ensures the GPL code is only loaded
 * when OMEMO encryption is actually used.
 *
 * The `webpackIgnore` magic comment prevents rspack from bundling
 * or code-splitting libomemo.esm.js. It is served as a companion
 * file alongside converse-headless.js and loaded at runtime.
 *
 * In test environments, window.libomemo is mocked and used directly.
 *
 * @returns {Promise<typeof import('libomemo.js')>}
 */
export function getCrypto() {
    if (_promise) {
        return _promise;
    }

    // In tests, window.libomemo is set by the mock (src/shared/tests/mock.js)
    if (typeof window !== 'undefined' && window.libomemo) {
        _promise = Promise.resolve(/** @type {typeof import('libomemo.js')} */ (window.libomemo));
        return _promise;
    }

    const promise = (_loader ?? loadFromAssetDirectory)().catch((e) => {
        log.error('Failed to load libomemo.js crypto library');
        log.error(e);
        _promise = null;
        throw e;
    });

    // Callers that await this still see the rejection; this only stops one that
    // doesn't from surfacing as an unhandled rejection, which terminates a
    // Node process by default. OMEMO failing to load must degrade to "no OMEMO"
    // (see `initOMEMO`), never take the client down with it.
    promise.catch(() => {});

    _promise = promise;
    return _promise;
}
