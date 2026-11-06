/**
 * Marks the `import()` calls that must stay native as ignored by bundlers.
 *
 * rspack's ESM chunk-loading runtime loads chunks with
 * `import("./" + __webpack_require__.u(chunkId))`. When a project bundles
 * `dist/converse.js` again, webpack reads that as a context import over all of
 * `dist/` and tries to bundle every file in it (source maps, images, wasm), and
 * Vite warns that it can't analyse it. Annotating it keeps it a native
 * `import()`, which loads the chunk relative to the module that contains it.
 *
 * Only chunks that carry the runtime are touched, so copied third-party files
 * and the lazy chunks themselves are left alone. If a runtime chunk that loads
 * lazy chunks has no matching `import()`, the runtime's output changed and the
 * build fails instead of shipping an unannotated bundle.
 *
 * The minifier also strips the comments on the source's
 * `import('./libomemo.esm.min.js')`, so that import is re-annotated too. It
 * isn't required to be there, since unminified bundles keep the comments.
 *
 * Runs after minification, so the minifier can't strip the comments.
 */
const ANNOTATION = '/* webpackIgnore: true */ /* @vite-ignore */ ';
const CHUNK_IMPORT = /\bimport\(\s*(?="\.\/"\s*\+)/g;
const LIBOMEMO_IMPORT = /\bimport\(\s*(?=["']\.\/libomemo\.esm\.min\.js["'])/g;

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
                        if (!chunk.hasRuntime()) continue;
                        const async_chunks = chunk.getAllAsyncChunks();
                        const loads_chunks = (async_chunks.length ?? async_chunks.size) > 0;

                        for (const name of chunk.files) {
                            if (!name.endsWith('.js')) continue;

                            let found = false;
                            compilation.updateAsset(name, (source) => {
                                const code = source.source().toString();
                                const chunk_imports = loads_chunks ? [...code.matchAll(CHUNK_IMPORT)] : [];
                                const matches = [...chunk_imports, ...code.matchAll(LIBOMEMO_IMPORT)];
                                found = chunk_imports.length > 0;
                                if (!matches.length) return source;

                                const replaced = new sources.ReplaceSource(source);
                                for (const m of matches) {
                                    replaced.insert(m.index + m[0].length, ANNOTATION);
                                }
                                return replaced;
                            });

                            if (loads_chunks && !found) {
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
