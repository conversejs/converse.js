/* global __dirname, module, process */
const HTMLWebpackPlugin = require('html-webpack-plugin');
const minimist = require('minimist');
const path = require('path');
const webpack = require('webpack');

const config = {
    output: {
        path: path.resolve(__dirname, 'dist'), // Output path for generated bundles
        publicPath: '/dist/', // URL base path for all assets
        chunkFilename: '[name].js'
    },
    entry: path.resolve(__dirname, 'src/converse.js'),
    externals: [{
        "window": "window"
    }],
    watchOptions: {
        ignored: [/dist/, /spec/, /.*\~/]
    },
    module: {
        rules: [
        {
            test: path.resolve(__dirname, "node_modules/backbone.vdomview/backbone.vdomview"),
            use: 'imports-loader?backbone.nativeview'
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
            test: /LC_MESSAGES\/converse.po$/,
            type: "json",
            use: [
            {
                loader: 'po-loader',
                options: {
                    'format': 'jed',
                    'domain': 'converse'
                }
            }
            ]
        }, {
            test: /webfonts\/.*\.(woff(2)?|ttf|eot|truetype|svg)(\?v=\d+\.\d+\.\d+)?$/,
            use: [
            {
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]',
                    outputPath: 'webfonts/'
                }
            }
            ]
        }, {
            test: /\.scss$/,
            use: [
                'style-loader',
                {
                    loader: 'css-loader',
                    options: {
                        sourceMap: true
                    }
                },
                'postcss-loader',
                {
                    loader: 'sass-loader',
                    options: {
                        includePaths: [
                            path.resolve(__dirname, 'node_modules/'),
                        ],
                        sourceMap: true
                    }
                }
            ]
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
                    ],
                    plugins: ['@babel/plugin-syntax-dynamic-import']
                }
            }
        }, {
            test: /bootstrap\.native/,
            use: {
                loader: 'bootstrap.native-loader',
                options: {
                    bs_version: 4,
                    ignore: ['carousel', 'scrollspy']
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
            "formdata-polyfill":        path.resolve(__dirname, "node_modules/formdata-polyfill/FormData"),
            "jquery":                   path.resolve(__dirname, "src/jquery-stub"),
            "punycode":                 path.resolve(__dirname, "node_modules/urijs/src/punycode"),
            "snabbdom":                 path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom"),
            "snabbdom-attributes":      path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-attributes"),
            "snabbdom-class":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-class"),
            "snabbdom-dataset":         path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-dataset"),
            "snabbdom-eventlisteners":  path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-eventlisteners"),
            "snabbdom-props":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-props"),
            "snabbdom-style":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-style"),
            "tovnode":                  path.resolve(__dirname, "node_modules/snabbdom/dist/tovnode"),
            "underscore":               path.resolve(__dirname, "src/underscore-shim")
        }
    }
}

function extend (o1, o2) {
    for (var i in o2) {
        if (Object.prototype.hasOwnProperty.call(o2, i)) {
            o1[i] = o2[i];
        }
    }
}

function parameterize () {
    const type = minimist(process.argv.slice(2)).type;
    const mode = minimist(process.argv.slice(2)).mode;
    const lang = minimist(process.argv.slice(2)).lang;
    if (type === 'headless') {
        console.log("Making a headless build");
        config.entry = "@converse/headless/headless.js";
        config.output.filename = 'converse-headless.js';
    }
}

parameterize();

module.exports = config;
