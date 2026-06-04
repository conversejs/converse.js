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
    // We can't use import.meta.url because rspack statically inlines it as the
    // source file path. Instead, find the script URL of converse.js or
    // converse-headless.js at runtime and use its directory.
    let script_base;
    if (typeof document !== 'undefined') {
        const scripts = /** @type {HTMLScriptElement[]} */ (Array.from(document.querySelectorAll('script[src]')));
        for (const el of scripts) {
            if (
                el.src.includes('converse-headless') ||
                el.src.includes('converse.js') ||
                el.src.includes('converse.min.js')
            ) {
                script_base = el.src.slice(0, el.src.lastIndexOf('/') + 1);
                break;
            }
        }
    }
    if (!script_base && typeof location !== 'undefined') {
        script_base = location.origin + location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1);
    }
    if (script_base) globalThis.__WASM_BASE__ = script_base;

    // @ts-expect-error - resolved at runtime from dist/, not source
    _promise = import(/* webpackIgnore: true */ './libomemo.esm.min.js').catch((e) => {
        log.error('Failed to load libomemo.js crypto library');
        log.error(e);
        _promise = null;
        throw e;
    });
    return _promise;
}
