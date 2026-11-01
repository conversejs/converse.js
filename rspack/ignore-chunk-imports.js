/**
 * Marks the `import()` that rspack's ESM chunk-loading runtime emits as
 * ignored by bundlers.
 *
 * The runtime loads chunks with `import("./" + __webpack_require__.u(chunkId))`.
 * When a project bundles `dist/converse.js` again, webpack reads that as a
 * context import over all of `dist/` and tries to bundle every file in it
 * (source maps, images, wasm), and Vite warns that it can't analyse it.
 * Annotating it keeps it a native `import()`, which loads the chunk relative
 * to the module that contains it.
 *
 * Runs after minification, so the minifier can't strip the comments.
 */
const ANNOTATION = '/* webpackIgnore: true */ /* @vite-ignore */ ';
const CHUNK_IMPORT = /\bimport\(\s*(?="\.\/"\s*\+)/g;

export default class IgnoreChunkImportsPlugin {
    /** @param {import('@rspack/core').Compiler} compiler */
    apply(compiler) {
        const { Compilation, sources } = compiler.webpack;
        compiler.hooks.thisCompilation.tap('IgnoreChunkImportsPlugin', (compilation) => {
            compilation.hooks.processAssets.tap(
                {
                    name: 'IgnoreChunkImportsPlugin',
                    stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1,
                },
                (assets) => {
                    for (const name of Object.keys(assets)) {
                        if (!name.endsWith('.js')) continue;

                        compilation.updateAsset(name, (source) => {
                            const code = source.source().toString();
                            const matches = [...code.matchAll(CHUNK_IMPORT)];
                            if (!matches.length) return source;

                            const replaced = new sources.ReplaceSource(source);
                            for (const m of matches) {
                                const at = m.index + m[0].length;
                                replaced.insert(at, ANNOTATION);
                            }
                            return replaced;
                        });
                    }
                }
            );
        });
    }
}
