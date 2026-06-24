import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { serveStatic } from './vitest/serve-static.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const abs = (p) => path.join(root, p);

const setupFiles = [abs('vitest/setup.jasmine-shim.js'), abs('vitest/setup.converse.js')];

// Files living under tests/ dirs that are NOT specs (helpers + generated artifacts).
const commonExclude = [
    '**/node_modules/**',
    '**/tests/mock.js', // shared test helpers
    '**/omemo-views/tests/utils.js', // omemo-views test helper (no describe/it)
    '**/__screenshots__/**', // vitest browser-mode failure screenshots
    '**/.vitest-attachments/**',
];

// Each project needs its OWN browser config object: Vitest tags each browser
// `instance` with its project name in place, so sharing one object/array across
// both projects collides ("project name 'main (chromium)' was already defined")
// when running them together via `vitest run`. A factory hands out fresh objects.
const makeBrowser = () => ({
    enabled: true,
    provider: playwright(),
    headless: true,
    instances: [{ browser: 'chromium' }],
});

export default defineConfig({
    resolve: {
        // Specs import the prebuilt bundle by relative path, but the depth is
        // inconsistent (some use one `../` too many and only resolved under Karma's
        // `/base/` URL prefix). Resolve the bundles by basename, depth-independent.
        alias: [
            { find: /^shared\/(.*)$/, replacement: abs('src/shared/$1') },
            { find: /^utils\/(.*)$/, replacement: abs('src/utils/$1') },
            { find: /^templates\/(.*)$/, replacement: abs('src/templates/$1') },
            { find: /(?:\.\.\/)+dist\/converse\.js$/, replacement: abs('dist/converse.js') },
            {
                find: /(?:\.\.\/)+dist\/converse-headless\.js$/,
                replacement: abs('src/headless/dist/converse-headless.js'),
            },
        ],
    },
    optimizeDeps: {
        // The specs import the 3.5MB prebuilt ESM bundle by relative path; keep
        // the dep optimizer from crawling/pre-bundling it and its locale chunks.
        exclude: ['@converse/headless'],
    },
    test: {
        globals: true,
        restoreMocks: true, // match Jasmine's per-spec spyOn restoration
        // Converse leaves async work (lit renders, localforage reads) in flight
        // when a test ends; the next test's initConverse tears down #conversejs and
        // clears storage, so that trailing work errors against a gone root/store.
        // Karma+Jasmine silently tolerated these unhandled rejections; match that
        // so the runner swap doesn't change pass/fail semantics.
        dangerouslyIgnoreUnhandledErrors: true,
        testTimeout: 7000,
        setupFiles,
        sequence: { shuffle: false },
        fileParallelism: false, // suite shares global #conversejs / storage state
        isolate: true, // Reload the page per test file
        projects: [
            {
                extends: true,
                plugins: [serveStatic({ '/dist': abs('dist'), '/base': root })],
                test: {
                    name: 'main',
                    include: ['src/**/tests/**/*.js', 'src/**/tests/*.js'],
                    exclude: ['src/headless/**', ...commonExclude],
                    browser: makeBrowser(),
                },
            },
            {
                extends: true,
                root: abs('src/headless'),
                plugins: [serveStatic({ '/dist': abs('src/headless/dist'), '/base': root })],
                test: {
                    name: 'headless',
                    include: ['**/tests/**/*.js', '**/tests/*.js'],
                    exclude: [...commonExclude],
                    browser: makeBrowser(),
                },
            },
        ],
    },
});
