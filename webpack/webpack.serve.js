/* global module, __dirname */
const HTMLWebpackPlugin = require('html-webpack-plugin');
const common = require("./webpack.common.js");
const { merge } = require("webpack-merge");
const path = require("path");

module.exports = merge(common, {
    mode: "development",
    entry: {
        "converse": path.resolve(__dirname, "../src/entry.js"),
    },
    devtool: "inline-source-map",
    devServer: {
        static: [ path.resolve(__dirname, '../') ],
        port: 3003,
        allowedHosts: ['chat.example.org'],
        // https: {
        //     key: './certs/chat.example.org.key',
        //     cert: './certs/chat.example.org.crt',
        //     requestCert: true,
        // },
    },
    plugins: [
        new HTMLWebpackPlugin({
            title: 'Converse.js Dev',
            template: 'webpack.html',
            filename: 'index.html'
        })
    ],
});
