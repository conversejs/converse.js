/**
 * Node.js entry point for @converse/headless.
 *
 * It re-exports everything from the browser entry ({@link ./index.js}) and
 * additionally installs the DOM globals that Node lacks. The `node` condition
 * in package.json points here, so `import converse from '@converse/headless'`
 * picks it up automatically under Node; `@converse/headless/node` names it
 * explicitly.
 *
 * Two peer packages have to be installed alongside for this to work, both
 * declared as optional dependencies so that browser consumers never fetch them:
 * `@xmldom/xmldom` (the DOM) and `ws` (the WebSocket).
 *
 * Note that this is the source tree, not a bundle. The browser builds are
 * bundled by rspack because a page pays per request; Node resolves modules off
 * disk and gains nothing from bundling.
 */
// Must be first: installs `document`, `DOMParser`, `WebSocket` and the
// `Element`/`Node` constructors before any module touches a stanza.
import './shims/node-dom.js';
// Registers the shared SQLite driver that `utils/node-store.js` hands to every store.
import './shims/node-storage.js';
// Registers how libomemo.js and its WebAssembly get loaded under Node.
import './shims/node-omemo.js';
// Registers reading emoji.json from the package instead of fetching it.
import './shims/node-emoji.js';

export * from './index.js';
export { default } from './index.js';
