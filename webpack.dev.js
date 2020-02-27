/* global module, process */
const merge = require("webpack-merge");
const prod = require("./webpack.prod.js");
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

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
