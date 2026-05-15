import path from 'path';
import { rspack } from '@rspack/core';
import { merge } from 'webpack-merge';
import common, { __dirname } from '../rspack/rspack.common.js';

export default (_env, argv) => {
    const isDev = argv?.mode === 'development';

    const plugins = [
        new rspack.CopyRspackPlugin({
            patterns: [
                { from: 'src/headless/plugins/emoji/emoji.json', to: 'emoji.json' },
                { from: 'node_modules/libomemo.js/dist/curve25519_compiled.wasm', to: 'curve25519_compiled.wasm' },
                { from: `node_modules/libomemo.js/dist/${isDev ? 'libomemo.esm.js' : 'libomemo.esm.min.js'}`, to: 'libomemo.esm.min.js' },
            ],
        }),
    ];

    const sharedConfig = {
        plugins,
        mode: isDev ? 'development' : 'production',
        devtool: isDev ? 'cheap-module-source-map' : 'source-map',
        optimization: {
            minimize: !isDev,
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    include: [
                        /src/,
                        /node_modules\/mergebounce/,
                        /node_modules\/lit-html/,
                        /node_modules\/strophe/,
                        /node_modules\/pluggable/,
                        /node_modules\/@converse/,
                    ],
                },
            ],
        },
        resolve: {
            fallback: {
                fs: false,
                path: false,
                crypto: false,
            },
        },
    };

    const nonMinESMConfig = merge(common, {
        ...sharedConfig,
        entry: {
            'converse-headless': path.resolve(__dirname, '../src/headless/index.js'),
        },
        optimization: {
            minimize: false,
        },
        experiments: {
            outputModule: true,
            topLevelAwait: true,
        },
        output: {
            path: path.resolve(__dirname, '../src/headless/dist'),
            filename: 'converse-headless.js',
            assetModuleFilename: '[name][ext]',
            globalObject: 'this',
            library: {
                type: 'module',
            },
        },
    });

    const minESMConfig = merge(common, {
        ...sharedConfig,
        entry: {
            'converse-headless.min': path.resolve(__dirname, '../src/headless/index.js'),
        },
        experiments: {
            outputModule: true,
            topLevelAwait: true,
        },
        optimization: {
            minimize: !isDev,
            minimizer: [
                new rspack.SwcJsMinimizerRspackPlugin({
                    exclude: /libomemo/,
                    minimizerOptions: {
                        module: true,
                        minify: true,
                        mangle: true,
                        compress: {
                            drop_debugger: process.env.DROP_DEBUGGER === 'true',
                            passes: 2,
                        },
                        format: {
                            comments: false,
                        },
                    },
                }),
            ],
        },
        output: {
            path: path.resolve(__dirname, '../src/headless/dist'),
            filename: 'converse-headless.min.js',
            assetModuleFilename: '[name][ext]',
            globalObject: 'this',
            library: {
                type: 'module',
            },
        },
    });

    return [nonMinESMConfig, minESMConfig];
};
