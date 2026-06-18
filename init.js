/* Shared bootstrap for the Converse demo pages.
 *
 * Reads per-page settings from a <script type="application/json"
 * id="converse-config"> data block and initializes Converse. Kept external
 * (not inline) and config-as-data (not executable script) so the pages can be
 * served under a Content-Security-Policy without `script-src 'unsafe-inline'`.
 * See docs/src/content/docs/security.md.
 */
const el = document.getElementById('converse-config');
converse.initialize(el ? JSON.parse(el.textContent) : {});
