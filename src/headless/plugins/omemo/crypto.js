import log from '@converse/log';

let _promise;

/**
 * Dynamically imports libomemo.js (GPL-3.0 licensed).
 * The dynamic import ensures the GPL code is only loaded
 * when OMEMO encryption is actually used.
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
        _promise = Promise.resolve(window.libomemo);
        return _promise;
    }

    _promise = import('libomemo.js').catch((e) => {
        log.error('Failed to load libomemo.js crypto library');
        log.error(e);
        _promise = null;
        throw e;
    });
    return _promise;
}
