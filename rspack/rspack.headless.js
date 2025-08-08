const path = require('path');
const { rspack } = require('@rspack/core');
const { merge } = require('webpack-merge');
const common = require('../rspack/rspack.common.js');

const plugins = [
    new rspack.CopyRspackPlugin({
        patterns: [
            { from: 'src/headless/plugins/emoji/emoji.json', to: 'emoji.json' },
        ],
    }),
];

const sharedConfig = {
    entry: {
        'converse-headless': path.resolve(__dirname, '../src/headless/index.js'),
        'converse-headless.min': path.resolve(__dirname, '../src/headless/index.js'),
    },
    plugins,
    mode: 'production',
    devtool: 'source-map',
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
                type: 'javascript/auto', // Let RSPack handle these files with built-in SWC
            },
        ],
    },
};

module.exports = [
    // CJS Build
    merge(common, {
        ...sharedConfig,
        output: {
            path: path.resolve(__dirname, '../src/headless/dist'),
            filename: '[name].js',
            chunkFilename: '[name].js',
            globalObject: 'this',
        },
    }),
    // ESM Build
    merge(common, {
        ...sharedConfig,
        experiments: {
            outputModule: true,
            topLevelAwait: true,
        },
        output: {
            path: path.resolve(__dirname, '../src/headless/dist'),
            filename: '[name].esm.js',
            chunkFilename: '[name].esm.js',
            library: {
                type: 'module'
            }
        },
    })
];
