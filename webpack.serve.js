/* global module */
const HTMLWebpackPlugin = require('html-webpack-plugin');
const common = require("./webpack.common.js");
const { merge } = require("webpack-merge");

module.exports = merge(common, {
    mode: "development",
    devtool: "inline-source-map",
    devServer: {
        contentBase: "./"
    },
    plugins: [
        new HTMLWebpackPlugin({
            title: 'Converse.js Dev',
            template: 'webpack.html'
        })
    ],
});
