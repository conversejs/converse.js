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
 * Only chunks that carry the runtime and load lazy chunks are touched, so
 * copied third-party files and the lazy chunks themselves are left alone.
 * If such a chunk has no matching `import()`, the runtime's output changed and
 * the build fails instead of shipping an unannotated bundle.
 *
 * Runs after minification, so the minifier can't strip the comments.
 */
const ANNOTATION = '/* webpackIgnore: true */ /* @vite-ignore */ ';
const CHUNK_IMPORT = /\bimport\(\s*(?="\.\/"\s*\+)/g;

export default class IgnoreChunkImportsPlugin {
    /** @param {import('@rspack/core').Compiler} compiler */
    apply(compiler) {
        const { Compilation, WebpackError, sources } = compiler.webpack;
        compiler.hooks.thisCompilation.tap('IgnoreChunkImportsPlugin', (compilation) => {
            compilation.hooks.processAssets.tap(
                {
                    name: 'IgnoreChunkImportsPlugin',
                    stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1,
                },
                () => {
                    for (const chunk of compilation.chunks) {
                        if (!chunk.hasRuntime() || !chunk.getAllAsyncChunks().length) continue;

                        for (const name of chunk.files) {
                            if (!name.endsWith('.js')) continue;

                            let found = false;
                            compilation.updateAsset(name, (source) => {
                                const matches = [...source.source().toString().matchAll(CHUNK_IMPORT)];
                                if (!matches.length) return source;

                                found = true;
                                const replaced = new sources.ReplaceSource(source);
                                for (const m of matches) {
                                    replaced.insert(m.index + m[0].length, ANNOTATION);
                                }
                                return replaced;
                            });

                            if (!found) {
                                compilation.errors.push(
                                    new WebpackError(
                                        `IgnoreChunkImportsPlugin: no chunk-loading import() found in ${name}. ` +
                                            'The rspack runtime output may have changed; update CHUNK_IMPORT.'
                                    )
                                );
                            }
                        }
                    }
                }
            );
        });
    }
}
