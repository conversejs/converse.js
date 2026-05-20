import { rspack } from '@rspack/core';
import { merge } from 'webpack-merge';
import buildConfig from '../rspack/rspack.build.js';

export default (env, argv) =>
    merge(buildConfig(env, argv), {
        experiments: {
            outputModule: true,
            topLevelAwait: true,
        },
        output: {
            module: true,
            chunkFormat: 'module',
            chunkLoading: 'import',
            filename: '[name].esm.js',
            chunkFilename: 'chunkjs.esm/[name].js',
            library: {
                type: 'module',
            },
        },
        optimization: {
            minimizer: [
                new rspack.SwcJsMinimizerRspackPlugin({
                    minimizerOptions: {
                        module: true, // This allows 'import' and 'export' in the minifier
                    },
                }),
            ],
        },
    });
