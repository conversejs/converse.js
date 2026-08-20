/**
 * Node.js OMEMO crypto loading.
 *
 * In the browser, libomemo.js is fetched from a file served next to
 * converse-headless.js. Under Node there is no such file. The library is a
 * package, so it is imported by name.
 *
 * @module shims/node-omemo
 */
import { setCryptoLoader } from '../plugins/omemo/crypto.js';

setCryptoLoader(() => import('libomemo.js'));
