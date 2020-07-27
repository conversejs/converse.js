/* global module */
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const prod = require("./webpack.prod.js");
const { merge } = require("webpack-merge");

module.exports = merge(prod, {
    output: {
        filename: 'converse.js',
    },
    optimization: {
        minimize: false,
    },
    devtool: 'source-map',
    plugins: [
        new MiniCssExtractPlugin({filename: '../dist/converse.css'}),
    ],
});
