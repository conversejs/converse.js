import path from 'path';
import { rspack } from '@rspack/core';
import { merge } from 'webpack-merge';
import common, { __dirname } from '../rspack/rspack.common.js';

const plugins = [
    new rspack.CopyRspackPlugin({
        patterns: [
            { from: 'src/headless/plugins/emoji/emoji.json', to: 'emoji.json' },
            { from: 'node_modules/libomemo.js/dist/curve25519_compiled.wasm', to: 'curve25519_compiled.wasm' },
        ],
    }),
];

export default (_env, argv) => {
    const isDev = argv?.mode === 'development';

    const sharedConfig = {
        entry: {
            'converse-headless': path.resolve(__dirname, '../src/headless/index.js'),
        },
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

    const nonMinConfig = merge(common, {
        ...sharedConfig,
        optimization: {
            minimize: false,
        },
        output: {
            path: path.resolve(__dirname, '../src/headless/dist'),
            filename: 'converse-headless.js',
            chunkFilename: 'chunks/[name].[contenthash].js',
            assetModuleFilename: '[name][ext]',
            globalObject: 'this',
        },
    });

    const minConfig = merge(common, {
        ...sharedConfig,
        output: {
            path: path.resolve(__dirname, '../src/headless/dist'),
            filename: 'converse-headless.min.js',
            chunkFilename: 'chunks-min/[name].[contenthash].js',
            assetModuleFilename: '[name][ext]',
            globalObject: 'this',
        },
    });

    const nonMinESMConfig = merge(common, {
        ...sharedConfig,
        optimization: {
            minimize: false,
        },
        experiments: {
            outputModule: true,
            topLevelAwait: true,
        },
        output: {
            path: path.resolve(__dirname, '../src/headless/dist'),
            filename: 'converse-headless.esm.js',
            chunkFilename: 'chunks-esm/[name].[contenthash].js',
            assetModuleFilename: '[name][ext]',
            library: {
                type: 'module',
            },
        },
    });

    const minESMConfig = merge(common, {
        ...sharedConfig,
        experiments: {
            outputModule: true,
            topLevelAwait: true,
        },
        output: {
            path: path.resolve(__dirname, '../src/headless/dist'),
            filename: 'converse-headless.min.esm.js',
            chunkFilename: 'chunks-esm-min/[name].[contenthash].js',
            assetModuleFilename: '[name][ext]',
            library: {
                type: 'module',
            },
        },
    });

    return [nonMinConfig, minConfig, nonMinESMConfig, minESMConfig];
};
