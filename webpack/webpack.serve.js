/* global module, __dirname */
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
        allowedHosts: ['localhost'],
    }
});
