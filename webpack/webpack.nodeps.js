/* global module, __dirname */
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const common = require("./webpack.common.js");
const path = require('path');
const { merge}  = require("webpack-merge");

module.exports = merge(common, {
    mode: "production",
    entry: {
        "converse-no-dependencies": path.resolve(__dirname, "../src/entry.js"),
    },
    plugins: [
        new MiniCssExtractPlugin({filename: 'tmp.css'})
    ],
    module: {
        rules: [
        {
            test: /\.scss$/,
            use: [
                MiniCssExtractPlugin.loader,
                'css-loader',
                {
                    loader: 'sass-loader',
                    options: {
                        sassOptions: {
                            includePaths: [path.resolve(__dirname, '../node_modules/')]
                        }
                    }
                }
            ]
        }]
    },
    externals: [{
        'pluggable.js': 'pluggable',
        '@converse/skeletor': 'skeletor',
        'localforage': 'localforage',
        'filesize': 'filesize',
        'jed': 'jed',
        'lodash': 'lodash',
        'lodash.noconflict': 'lodash.noconflict',
        'sizzle': 'sizzle',
        'strophe.js': 'strophe',
        'urijs': 'urijs',
        'window': 'window',
    }]
});
