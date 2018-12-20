/*global path, __dirname, module, process */
'use strict'
const minimist = require('minimist');
const path = require('path');
const webpack = require('webpack');

const config = {

    entry: path.resolve(__dirname, 'tests/runner.js'),
    externals: [{
        "window": "window"
    }],
    output: {
        path: path.resolve(__dirname, 'tests'),
        filename: 'tests-bundle.js'
    },
    devtool: 'source-map',
    plugins: [
        new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
        new webpack.ProvidePlugin({
          'jasmineRequire': path.resolve(__dirname, "node_modules/jasmine-core/lib/jasmine-core/jasmine"),
        })
    ],
    module: {
        rules: [
        {
            test: path.resolve(__dirname, "node_modules/backbone.overview/backbone.orderedlistview"),
            use: 'imports-loader?backbone.nativeview'
        },
        {
            test: path.resolve(__dirname, "node_modules/backbone.overview/backbone.overview"),
            use: 'imports-loader?backbone.nativeview'
        },
        {
            test: path.resolve(__dirname, "node_modules/backbone.vdomview/backbone.vdomview"),
            use: 'imports-loader?backbone.nativeview'
        },
        {
            test: path.resolve(__dirname, "node_modules/awesomplete-avoid-xss/awesomplete"),
            use: "exports-loader?Awesomplete"
        },
        {
            test: path.resolve(__dirname, "node_modules/xss/dist/xss"),
            use: "exports-loader?filterXSS,filterCSS"
        },
        {
            test: /\.(html|svg)$/,
            exclude: /node_modules/,
            use: [{
                loader: 'lodash-template-webpack-loader',
                options: {
                    "escape": /\{\{\{([\s\S]+?)\}\}\}/g,
                    "evaluate": /\{\[([\s\S]+?)\]\}/g,
                    "interpolate": /\{\{([\s\S]+?)\}\}/g,
                    // By default, template places the values from your data in the
                    // local scope via the with statement. However, you can specify
                    // a single variable name with the variable setting. This can
                    // significantly improve the speed at which a template is able
                    // to render.
                    "variable": 'o',
                    "prependFilenameComment": __dirname
                }
            }]
        }, {
            test: /\.js$/,
            exclude: /(node_modules|spec|mockup)/,
            use: {
                loader: 'babel-loader',
                options: {
                    presets: [
                        ["@babel/preset-env", {
                            "targets": {
                                "browsers": [">1%", "not ie 11", "not op_mini all"]
                            }
                        }]
                    ]
                }
            }
        }],
    },
    resolve: {
        extensions: ['.js'],
        modules: [
            'node_modules',
            path.resolve(__dirname, "src")
        ],
        alias: {
            "IPv6":                     path.resolve(__dirname, "node_modules/urijs/src/IPv6"),
            "SecondLevelDomains":       path.resolve(__dirname, "node_modules/urijs/src/SecondLevelDomains"),
            "awesomplete":              path.resolve(__dirname, "node_modules/awesomplete-avoid-xss/awesomplete"),
            "bootstrap":                path.resolve(__dirname, "node_modules/bootstrap.native/dist/bootstrap-native-v4"),
            "formdata-polyfill":        path.resolve(__dirname, "node_modules/formdata-polyfill/FormData"),
            "jquery":                   path.resolve(__dirname, "node_modules/jquery/dist/jquery"),
            "pluggable":                path.resolve(__dirname, "node_modules/pluggable.js/dist/pluggable"),
            "punycode":                 path.resolve(__dirname, "node_modules/urijs/src/punycode"),
            "snabbdom":                 path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom"),
            "snabbdom-attributes":      path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-attributes"),
            "snabbdom-class":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-class"),
            "snabbdom-dataset":         path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-dataset"),
            "snabbdom-eventlisteners":  path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-eventlisteners"),
            "snabbdom-props":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-props"),
            "snabbdom-style":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-style"),
            "tovnode":                  path.resolve(__dirname, "node_modules/snabbdom/dist/tovnode"),
            "underscore":               path.resolve(__dirname, "src/underscore-shim"),
            "uri":                      path.resolve(__dirname, "node_modules/urijs/src/URI"),
            "vdom-parser":              path.resolve(__dirname, "node_modules/vdom-parser/dist"),
            "xss":                      path.resolve(__dirname, "node_modules/xss/dist/xss"),

            "mock": path.resolve(__dirname, "tests/mock"),
            "test-utils": path.resolve(__dirname, "tests/utils"),
            "jasmine": path.resolve(__dirname, "tests/jasmine"),
        }
    }
}

module.exports = config;
