const { rspack } = require('@rspack/core');
const path = require('path');
const { merge } = require('webpack-merge');
const common = require('../rspack/rspack.common.js');

const plugins = [
    new rspack.CopyRspackPlugin({
        patterns: [{ from: 'src/headless/plugins/emoji/emoji.json', to: 'emoji.json' }],
    }),
];

module.exports = [
    // Headless build configuration
    merge(common, {
        name: 'converse-headless',
        mode: 'development',
        entry: {
            'converse-headless': {
                import: path.resolve(__dirname, '../src/headless/index.js'),
                filename: '../src/headless/dist/[name].js',
            },
        },
        devtool: 'inline-source-map',
        optimization: {
            minimize: false,
        },
        plugins,
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
        output: {
            path: path.resolve(__dirname, '../src/headless/dist'),
            publicPath: '/src/headless/dist/',
        },
        devServer: {
            devMiddleware: {
                writeToDisk: true,
            },
        },
    }),
    // Main application build configuration
    merge(common, {
        mode: 'development',
        entry: {
            'converse': {
                import: path.resolve(__dirname, '../src/entry.js'),
                filename: '../dist/[name].js',
            },
        },
        devtool: 'inline-source-map',
        optimization: {
            minimize: false,
        },
        resolve: {
            alias: {
                '@converse/headless': path.resolve(__dirname, '../src/headless/dist/converse-headless.js')
            }
        },
        devServer: {
            static: [
                {
                    directory: path.resolve(__dirname, '..'), // Serve root directory for dev.html etc
                    publicPath: '/',
                    serveIndex: true,
                    watch: {
                        ignored: ['**/node_modules', '../dist', '**/.git'],
                    },
                },
                {
                    directory: path.resolve(__dirname, '../dist'),
                    publicPath: '/dist/',
                },
                {
                    directory: path.resolve(__dirname, '../src/headless/dist'),
                    publicPath: '/src/headless/dist/',
                },
            ],
            port: 8008,
            allowedHosts: ['localhost'],
            devMiddleware: {
                writeToDisk: true,
            },
        },
        watchOptions: {
            ignored: [path.posix.resolve(__dirname, '../node_modules'), path.posix.resolve(__dirname, '../3rdparty')],
        },
    }),
];
