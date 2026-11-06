/**
 * Bundles the per-file declarations that `tsc` emits into one `.d.ts` per
 * entry point, so that the published packages don't ship hundreds of
 * generated files. Run through `npm run types`, which emits the per-file
 * declarations first.
 *
 * Select the package with `--configPackage headless` or `--configPackage ui`,
 * since the UI's declarations can only be emitted once the headless bundle exists.
 */
import { dts } from 'rollup-plugin-dts';

import path from 'node:path';

/**
 * @param {string} input - An entry point among the per-file declarations
 * @param {string} file - Where to write the bundle
 */
function bundle(input, file) {
    // The declarations keep the bare imports of the sources (`shared/...`,
    // `plugins/...`), so resolve those inside the folder they were emitted to.
    // Anything not found there resolves from node_modules and stays external.
    const types_dir = path.resolve(path.dirname(input));
    return {
        input,
        // The sourcemap follows the per-file declaration maps back to the
        // sources, which the packages ship, so "Go to definition" lands there.
        output: { file, format: 'es', sourcemap: true },
        plugins: [dts({ sourcemap: true, compilerOptions: { paths: { '*': [`${types_dir}/*`] } } })],
    };
}

const packages = {
    headless: [
        // The Node entry re-exports the browser entry and only adds side effects,
        // so both export conditions share this bundle.
        bundle('src/headless/types/index.d.ts', 'src/headless/dist/converse-headless.d.ts'),
    ],
    ui: [bundle('src/types/index.d.ts', 'dist/converse.d.ts')],
};

/** @param {{ configPackage?: string }} args */
export default function (args) {
    const config = packages[args.configPackage];
    if (!config) {
        throw new Error(`Pass --configPackage with one of: ${Object.keys(packages).join(', ')}`);
    }
    return config;
}
