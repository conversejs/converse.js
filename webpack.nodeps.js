/* global module, __dirname */
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const common = require("./webpack.common.js");
const merge = require("webpack-merge");
const path = require('path');

module.exports = merge(common, {
    mode: "production",
    output: {
        filename: 'converse-no-dependencies.js'
    },
    optimization: {
        minimizer: []
    },
    plugins: [
        new MiniCssExtractPlugin({filename: ''})
    ],
    module: {
        rules: [
        {
            test: /\.js$/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: [
                        ["@babel/preset-env", {
                            "targets": {
                                "browsers": ["ie 8"]
                            }
                        }]
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
                        includePaths: [path.resolve(__dirname, 'node_modules/')]
                    }
                }
            ]
        }]
    },
    externals: [{
        "backbone": "backbone",
        "backbone.nativeview": "backbone.nativeview",
        "backbone.vdomview": "backbone.vdomview",
        "backbone.browserStorage": "backbone.browserStorage",
        "backbone.overview": "backbone.overview",
        "es6-promise": "es6-promise",
        "formdata-polyfill": "formdata-polyfill",
        "lodash": "lodash",
        "lodash.noconflict": "lodash.noconflict",
        "strophe": "strophe",
        "window": "window",
        "filesize": "filesize",
        "jed": "jed",
        "sizzle": "sizzle",
        "twemoji": "twemoji",
        "urijs": "urijs"
    }]
});
