/*global path, __dirname, module, process */
'use strict'
const minimist = require('minimist');
const path = require('path');

const config = {
    entry: path.resolve(__dirname, 'src/converse.js'),
    externals: [{
        "window": "window"
    }],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'converse.js'
    },
    devtool: 'source-map',
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
            test: /\.html$/,
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
            "backbone":                 path.resolve(__dirname, "node_modules/backbone/backbone"),
            "backbone.browserStorage":  path.resolve(__dirname, "node_modules/backbone.browserStorage/backbone.browserStorage"),
            "backbone.nativeview":      path.resolve(__dirname, "node_modules/backbone.nativeview/backbone.nativeview"),
            "backbone.orderedlistview": path.resolve(__dirname, "node_modules/backbone.overview/backbone.orderedlistview"),
            "backbone.overview":        path.resolve(__dirname, "node_modules/backbone.overview/backbone.overview"),
            "backbone.vdomview":        path.resolve(__dirname, "node_modules/backbone.vdomview/backbone.vdomview"),
            "bootstrap":                path.resolve(__dirname, "node_modules/bootstrap.native/dist/bootstrap-native-v4"),
            "crypto":                   path.resolve(__dirname, "node_modules/otr/build/dep/crypto"),
            "es6-promise":              path.resolve(__dirname, "node_modules/es6-promise/dist/es6-promise.auto"),
            "filesize":                 path.resolve(__dirname, "node_modules/filesize/lib/filesize"),
            "fast-text-encoding":       path.resolve(__dirname, "node_modules/fast-text-encoding/text"),
            "formdata-polyfill":        path.resolve(__dirname, "node_modules/formdata-polyfill/FormData"),
            "jed":                      path.resolve(__dirname, "node_modules/jed/jed"),
            "jquery":                   path.resolve(__dirname, "src/jquery-stub"),
            "lodash":                   path.resolve(__dirname, "node_modules/lodash/lodash"),
            "lodash.converter":         path.resolve(__dirname, "3rdparty/lodash.fp"),
            "pluggable":                path.resolve(__dirname, "node_modules/pluggable.js/dist/pluggable"),
            "punycode":                 path.resolve(__dirname, "node_modules/urijs/src/punycode"),
            "sizzle":                   path.resolve(__dirname, "node_modules/sizzle/dist/sizzle"),
            "snabbdom":                 path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom"),
            "snabbdom-attributes":      path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-attributes"),
            "snabbdom-class":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-class"),
            "snabbdom-dataset":         path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-dataset"),
            "snabbdom-eventlisteners":  path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-eventlisteners"),
            "snabbdom-props":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-props"),
            "snabbdom-style":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-style"),
            "strophe":                  path.resolve(__dirname, "node_modules/strophe.js/dist/strophe"),
            "strophe.ping":             path.resolve(__dirname, "node_modules/strophejs-plugin-ping/strophe.ping"),
            "strophe.rsm":              path.resolve(__dirname, "node_modules/strophejs-plugin-rsm/strophe.rsm"),
            "tovnode":                  path.resolve(__dirname, "node_modules/snabbdom/dist/tovnode"),
            "underscore":               path.resolve(__dirname, "src/underscore-shim"),
            "uri":                      path.resolve(__dirname, "node_modules/urijs/src/URI"),
            "utils/core":               path.resolve(__dirname, "src/utils/core"),
            "utils/emoji":              path.resolve(__dirname, "src/utils/emoji"),
            "utils/form":               path.resolve(__dirname, "src/utils/form"),
            "utils/muc":                path.resolve(__dirname, "src/utils/muc"),
            "vdom-parser":              path.resolve(__dirname, "node_modules/vdom-parser/dist"),
            "xss":                      path.resolve(__dirname, "node_modules/xss/dist/xss")
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
        extend(config, {
            entry: path.resolve(__dirname, 'src/headless.js'),
            output: {
                path: path.resolve(__dirname, 'dist'),
                filename: 'converse-headless.js'
            },
        });
    }

    if (type === 'nodeps') {
        console.log("Making a build without 3rd party dependencies");
        extend(config, {
            entry: path.resolve(__dirname, 'src/converse.js'),
            externals: [{
                "awesomplete": "awesomplete",
                "backbone.browserStorage": "backbone.browserStorage",
                "backbone.overview": "backbone.overview",
                "es6-promise": "es6-promise",
                "lodash": "lodash",
                "lodash.converter": "lodash.converter",
                "lodash.noconflict": "lodash.noconflict",
                "moment": "moment",
                "strophe": "strophe",
                "strophe.ping": "strophe.ping",
                "strophe.rsm": "strophe.rsm",
                "window": "window"
            }],
            output: {
                path: path.resolve(__dirname, 'dist'),
                filename: 'converse-no-dependencies.js'
            },
        });
    }

    if (mode === 'production') {
        console.log("Making a production build");
        const fn = config.output.filename;
        config.output.filename = `${fn.replace(/\.js$/, '')}.min.js`;
    }

    if (lang === 'es2015') {
        console.log("Making an es2015 build");
        config.module.rules.forEach((rule) => {
            if (rule.use.loader === 'babel-loader') {
                rule.use.options.presets = [
                    ["@babel/preset-es2015"]
                ]
            }
        });
    }
}

parameterize();

module.exports = config;
