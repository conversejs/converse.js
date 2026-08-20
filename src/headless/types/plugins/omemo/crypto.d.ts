/**
 * Overrides how libomemo.js is loaded. Registered by `shims/node-omemo.js`,
 * because under Node the library comes from the package rather than from a file
 * served next to the bundle.
 * @param {() => Promise<typeof import('libomemo.js')>} loader
 */
export function setCryptoLoader(loader: () => Promise<typeof import("libomemo.js")>): void;
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
export function getCrypto(): Promise<typeof import("libomemo.js")>;
//# sourceMappingURL=crypto.d.ts.map