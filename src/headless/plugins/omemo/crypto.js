import log from '@converse/log';

let _promise;

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

    // Tell libomemo where to find curve25519_compiled.wasm.
    // Without this, the Emscripten-generated code fetches the wasm with a bare
    // relative path (e.g. "curve25519_compiled.wasm") which fetch() resolves
    // against the page URL, not the module URL.
    globalThis.__WASM_BASE__ = new URL('./', import.meta.url).href;

    // @ts-expect-error - resolved at runtime from dist/, not source
    _promise = import(/* webpackIgnore: true */ './libomemo.esm.min.js').catch((e) => {
        log.error('Failed to load libomemo.js crypto library');
        log.error(e);
        _promise = null;
        throw e;
    });
    return _promise;
}
