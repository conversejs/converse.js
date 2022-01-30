/* global module, __dirname */
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const common = require("./webpack.common.js");
const path = require('path');
const { merge}  = require("webpack-merge");

module.exports = merge(common, {
    mode: "production",
    output: {
        filename: 'converse-no-dependencies.js'
    },
    optimization: {
        minimizer: []
    },
    plugins: [
        new MiniCssExtractPlugin({filename: 'tmp.css'})
    ],
    module: {
        rules: [
        {
            test: /\.js$/,
            include: /src/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: [
                        ["@babel/preset-env", {
                            "targets": {
                                "browsers": ["ie 11"]
                            }
                        }]
                    ],
                    plugins: [
                        '@babel/plugin-proposal-class-properties',
                        '@babel/plugin-proposal-nullish-coalescing-operator',
                        '@babel/plugin-proposal-optional-chaining',
                        '@babel/plugin-syntax-dynamic-import'
                    ]
                }
            }
        },
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
        'twemoji': 'twemoji',
        'urijs': 'urijs',
        'window': 'window',
    }]
});
