/**
 * Per-file environment scaffolding for Converse tests, replacing what Karma's
 * `files` list injected: the compiled stylesheet + the tiny test stylesheet.
 * `mock.js`/`initConverse` handle the `#conversejs` root element themselves.
 *
 * CSS is injected via <link> to the sirv-served `/dist` mount (see
 * vitest/serve-static.js) so url() references resolve against /dist, rather than
 * importing the 605KB stylesheet through Vite's CSS transform.
 */
function addStylesheet(href) {
    if (document.querySelector(`link[data-converse-test="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.converseTest = href;
    document.head.appendChild(link);
}

addStylesheet('/dist/converse.css');
addStylesheet('/base/src/web/shared/tests/tests.css');

document.title = 'Converse Tests';

// The browser's credential store would otherwise be asked for a password,
// with a prompt, whenever a test logs in without one. Specs that need it to
// hand one over stub it themselves.
beforeEach(() => {
    if (navigator.credentials) vi.spyOn(navigator.credentials, 'get').mockResolvedValue(null);
});
