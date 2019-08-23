const common = require("./webpack.common.js");
const merge = require("webpack-merge");
const path = require('path');

module.exports = merge(common, {
    output: {
        path: path.resolve(__dirname, 'dist'), // Output path for generated bundles
        publicPath: '/dist/', // URL base path for all assets
        filename: 'converse.js',
        chunkFilename: '[name].js'
    },
    mode: "production",
    devtool: "source-map",
});

