/* global module, process */
const merge = require("webpack-merge");
const prod = require("./webpack.prod.js");
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const ASSET_PATH = process.env.ASSET_PATH || '/dist/'; // eslint-disable-line no-process-env

module.exports = merge(prod, {
    output: {
        publicPath: ASSET_PATH,
        filename: 'converse.js',
    },
    optimization: {
        minimize: false,
    },
    devtool: 'source-map',
    plugins: [
        new MiniCssExtractPlugin({filename: '../dist/converse.css'}),
        new webpack.DefinePlugin({ // This makes it possible for us to safely use env vars on our code
            'process.env.ASSET_PATH': JSON.stringify(ASSET_PATH)
        })
    ],
});
