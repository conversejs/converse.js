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
            test: /\.js$/,
            include: /src/,
            use: {
                loader: 'swc-loader',
                options: {
                    jsc: {
                        target: 'es5',
                        parser: {
                            syntax: 'ecmascript',
                            jsx: false,
                            dynamicImport: false,
                        },
                    }
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
                        api: "modern-compiler",
                        sassOptions: {
                            silenceDeprecations: ['color-functions', 'global-builtin', 'import', 'mixed-decls'],
                            includePaths: [path.resolve(__dirname, '../node_modules/')]
                        }
                    }
                }
            ]
        }]
    },
    externals: [{
        '@converse/skeletor': 'skeletor',
        'filesize': 'filesize',
        'jed': 'jed',
        'lit': 'lit',
        'lit-html': 'lit-html',
        'localforage': 'localforage',
        'lodash': 'lodash',
        'lodash.noconflict': 'lodash.noconflict',
        'pluggable.js': 'pluggable',
        'sizzle': 'sizzle',
        'strophe.js': 'strophe',
        'urijs': 'urijs',
        'window': 'window',
    }]
});
