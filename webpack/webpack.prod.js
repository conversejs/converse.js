/* global __dirname, module, process */
const ASSET_PATH = process.env.ASSET_PATH || '/dist/'; // eslint-disable-line no-process-env
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const common = require("./webpack.common.js");
const path = require('path');
const webpack = require('webpack');
const { merge }  = require("webpack-merge");

const plugins = [
    new MiniCssExtractPlugin({filename: '../dist/converse.min.css'}),
    new CopyWebpackPlugin({
        patterns: [
            {from: 'node_modules/strophe.js/src/shared-connection-worker.js', to: 'shared-connection-worker.js'},
            {from: 'sounds', to: 'sounds'},
            {from: 'images/favicon.ico', to: 'images/favicon.ico'},
            {from: 'images/custom_emojis', to: 'images/custom_emojis'},
            {from: 'logo/conversejs-filled-192.png', to: 'images/logo'},
            {from: 'logo/conversejs-filled-512.png', to: 'images/logo'},
            {from: 'logo/conversejs-filled-192.svg', to: 'images/logo'},
            {from: 'logo/conversejs-filled-512.svg', to: 'images/logo'},
            {from: 'logo/conversejs-filled.svg', to: 'images/logo'},
            {from: 'src/shared/styles/webfonts', to: 'webfonts'}
        ]
    }),
    new webpack.DefinePlugin({ // This makes it possible for us to safely use env vars on our code
        'process.env.ASSET_PATH': JSON.stringify(ASSET_PATH)
    })
];

module.exports = merge(common, {
    plugins,
    output: {
        publicPath: ASSET_PATH,
        filename: 'converse.min.js',
    },
    mode: "production",
    devtool: "source-map",
    module: {
        rules: [{
            test: /\.scss$/,
            use: [
                MiniCssExtractPlugin.loader,
                {
                    loader: 'css-loader',
                    options: {
                        url: false,
                        sourceMap: true

                    }
                },
                'postcss-loader',
                {
                    loader: 'sass-loader',
                    options: {
                        sassOptions: {
                            includePaths: [path.resolve(__dirname, '../node_modules/')]
                        },
                        sourceMap: true
                    }
                }
            ]
        }]
    }
});
