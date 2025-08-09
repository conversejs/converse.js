const common = require('../rspack/rspack.common.js');
const path = require('path');
const { merge } = require('webpack-merge');

module.exports = merge(common, {
    mode: 'development',
    entry: {
        'converse': {
            import: path.resolve(__dirname, '../src/entry.js'),
            filename: '../dist/[name].js'
        },
        'converse-headless': {
            import: path.resolve(__dirname, '../src/headless/index.js'),
            filename: '../src/headless/dist/[name].js'
        },
    },
    devtool: 'inline-source-map',
    optimization: {
        minimize: false,
    },
    devServer: {
        static: [
            {
                directory: path.resolve(__dirname, '..'), // Serve root directory for dev.html etc
                publicPath: '/',
                serveIndex: true,
                watch: {
                    ignored: ['**/node_modules', '**/dist', '**/.git']
                }
            },
            {
                directory: path.resolve(__dirname, '../dist'),
                publicPath: '/dist/'
            },
            {
                directory: path.resolve(__dirname, '../src/headless/dist'),
                publicPath: '/src/headless/dist/'
            }
        ],
        port: 8008,
        allowedHosts: ['localhost'],
        devMiddleware: {
            writeToDisk: true,
        },
    },
    watchOptions: {
        ignored: [
            path.posix.resolve(__dirname, '../node_modules'),
            path.posix.resolve(__dirname, '../3rdparty'),
            path.posix.resolve(__dirname, '../src/headless/dist') // Don't watch the output dir
        ],
    },
});
