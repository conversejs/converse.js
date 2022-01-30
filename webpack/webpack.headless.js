/* global __dirname, module */
const common = require("./webpack.common.js");
const path = require('path');
const { merge } = require("webpack-merge");

module.exports = merge(common, {
    entry: "@converse/headless/headless.js",
    output: {
        path: path.resolve(__dirname, '../src/headless/dist'), // Output path for generated bundles
        filename: 'converse-headless.min.js',
        chunkFilename: '[name].js'
    },
    mode: "production",
    devtool: "source-map",
});

