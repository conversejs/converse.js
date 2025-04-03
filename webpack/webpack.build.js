/* global __dirname, module, process */
const CircularDependencyPlugin = require('circular-dependency-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const common = require("./webpack.common.js");
const path = require('path');
const { merge }  = require("webpack-merge");

const plugins = [
    new MiniCssExtractPlugin({filename: '../dist/converse.min.css'}),
    new MiniCssExtractPlugin({filename: '../dist/converse.css'}),
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
            {from: 'logo/conversejs-gold-gradient.svg', to: 'images/logo'},
            {from: 'src/shared/styles/webfonts', to: 'webfonts'},
            {from: 'manifest.json', to: 'manifest.json'}
        ]
    }),
    new CircularDependencyPlugin({
      exclude: /node_modules/,
      failOnError: true,
      allowAsyncCycles: false,
      cwd: process.cwd(),
    })
];

module.exports = merge(common, {
    plugins,
    entry: {
        "converse": path.resolve(__dirname, "../src/entry.js"),
        "converse.min": path.resolve(__dirname, "../src/entry.js"),
    },
    output: {
        filename: "[name].js",
    },
    mode: "production",
    module: {
        rules: [{
            test: /\.(js|ts)$/,
            use: [{
                loader: 'minify-html-literals-loader'
            }]
        },
        {
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
                {
                    loader: "postcss-loader",
                    options: { sourceMap: true }
                },
                {
                    loader: 'sass-loader',
                    options: {
                        sassOptions: {
                            silenceDeprecations: ['color-functions', 'global-builtin', 'import', 'mixed-decls'],
                            includePaths: [
                                path.resolve(__dirname, '../node_modules/'),
                                path.resolve(__dirname, '../src/')
                            ]
                        },
                        sourceMap: true
                    }
                },
            ]
        }]
    }
});
