/* global __dirname, module */
const common = require("./webpack.common.js");
const merge = require("webpack-merge");
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = merge(common, {
    output: {
        filename: 'converse.min.js',
    },
    plugins: [
        new MiniCssExtractPlugin({filename: '../dist/converse.min.css'})
    ],
    mode: "production",
    devtool: "source-map",
    module: {
        rules: [{
            test: /\.scss$/,
            use: [
                MiniCssExtractPlugin.loader,
                {
                    loader: 'css-loader',
                    options: {sourceMap: true}
                },
                'postcss-loader',
                {
                    loader: 'sass-loader',
                    options: {
                        includePaths: [
                            path.resolve(__dirname, 'node_modules/')
                        ],
                        sourceMap: true
                    }
                }
            ]
        }]
    }
});

