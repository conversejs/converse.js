/* global __dirname, module */
const common = require("./webpack.common.js");
const path = require('path');
const { merge } = require("webpack-merge");

module.exports = merge(common, {
    entry: {
        "converse-headless": "@converse/headless/index.js",
        "converse-headless.min": "@converse/headless/index.js",
    },
    output: {
        path: path.resolve(__dirname, '../src/headless/dist'), // Output path for generated bundles
        filename: "[name].js",
        chunkFilename: '[name].js',
        globalObject: 'this',
        library: {
            name: 'converse',
            type: 'umd',
        },
    },
    mode: "production",
});
