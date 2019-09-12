/* global module */
const merge = require("webpack-merge");
const prod = require("./webpack.prod.js");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = merge(prod, {
    output: {
        publicPath: '/dist/', // URL base path for all assets
        filename: 'converse.js',
    },
    optimization: {
        minimize: false,
    },
    devtool: 'source-map',
    plugins: [new MiniCssExtractPlugin({filename: 'converse.css'})]
});
