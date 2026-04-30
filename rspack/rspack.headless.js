const path = require('path');
const { rspack } = require('@rspack/core');
const { merge } = require('webpack-merge');
const common = require('../rspack/rspack.common.js');

const plugins = [
    new rspack.CopyRspackPlugin({
        patterns: [{ from: 'src/headless/plugins/emoji/emoji.json', to: 'emoji.json' }],
    }),
];

module.exports = (_env, argv) => {
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
                    type: 'javascript/auto', // Let RSPack handle these files with built-in SWC
                },
            ],
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
            chunkFilename: 'converse-headless.js',
            globalObject: 'this',
        },
    });

    const minConfig = merge(common, {
        ...sharedConfig,
        output: {
            path: path.resolve(__dirname, '../src/headless/dist'),
            filename: 'converse-headless.min.js',
            chunkFilename: 'converse-headless.min.js',
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
            chunkFilename: 'converse-headless.esm.js',
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
            chunkFilename: 'converse-headless.min.esm.js',
            library: {
                type: 'module',
            },
        },
    });

    return [
        // CJS Build
        nonMinConfig,
        minConfig,
        // ESM Build
        nonMinESMConfig,
        minESMConfig,
    ];
};
