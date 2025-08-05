const common = require('../rspack/rspack.common.js');
const path = require('path');
const { merge } = require('webpack-merge');

module.exports = merge(common, {
    mode: 'development',
    entry: {
        'converse': path.resolve(__dirname, '../src/entry.js'),
    },
    devtool: 'inline-source-map',
    optimization: {
        minimize: false,
    },
    devServer: {
        static: {
            directory: path.resolve(__dirname, '../'),
        },
        port: 8008,
        allowedHosts: ['localhost'],
        devMiddleware: {
            publicPath: '/dist/',
            writeToDisk: true,
        },
    },
    watchOptions: {
        ignored: [path.posix.resolve(__dirname, '../node_modules'), path.posix.resolve(__dirname, '../3rdparty')],
    },
});
