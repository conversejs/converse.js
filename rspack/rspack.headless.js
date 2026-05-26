import path from 'path';
import { rspack } from '@rspack/core';
import { merge } from 'webpack-merge';
import common, { __dirname } from '../rspack/rspack.common.js';

const plugins = [
    new rspack.CopyRspackPlugin({
        patterns: [{ from: 'src/headless/plugins/emoji/emoji.json', to: 'emoji.json' }],
    }),
];

export default (_env, argv) => {
    const isDev = argv?.mode === 'development';

    const sharedConfig = {
        entry: {
            'converse-headless': path.resolve(__dirname, '../src/headless/index.js'),
            'converse-headless.min': path.resolve(__dirname, '../src/headless/index.js'),
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
                    type: 'javascript/auto',
                },
            ],
        },
    };

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
            filename: 'converse-headless.js',
            chunkFilename: 'converse-headless.js',
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
            filename: 'converse-headless.min.js',
            chunkFilename: 'converse-headless.min.js',
            library: {
                type: 'module',
            },
        },
    });

    return [
        nonMinESMConfig,
        minESMConfig,
    ];
};