/*global path, __dirname, module */
'use strict'
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
        rules: [{
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
        modules: [
            'node_modules',
            path.resolve(__dirname, "src"),
        ],
        alias: {
            "IPv6":                     path.resolve(__dirname, "node_modules/urijs/src/IPv6"),
            "SecondLevelDomains":       path.resolve(__dirname, "node_modules/urijs/src/SecondLevelDomains"),
            "awesomplete":              path.resolve(__dirname, "node_modules/awesomplete-avoid-xss/awesomplete"),
            "backbone":                 path.resolve(__dirname, "node_modules/backbone/backbone"),
            "backbone.browserStorage":  path.resolve(__dirname, "node_modules/backbone.browserStorage/backbone.browserStorage"),
            "backbone.nativeview":      path.resolve(__dirname, "node_modules/backbone.nativeview/backbone.nativeview"),
            "backbone.noconflict":      path.resolve(__dirname, "src/backbone.noconflict"),
            "backbone.orderedlistview": path.resolve(__dirname, "node_modules/backbone.overview/dist/backbone.orderedlistview"),
            "backbone.overview":        path.resolve(__dirname, "node_modules/backbone.overview/dist/backbone.overview"),
            "backbone.vdomview":        path.resolve(__dirname, "node_modules/backbone.vdomview/dist/backbone.vdomview"),
            "bootstrap":                path.resolve(__dirname, "node_modules/bootstrap.native/dist/bootstrap-native-v4"),
            "crypto":                   path.resolve(__dirname, "node_modules/otr/build/dep/crypto"),
            "emojione":                 path.resolve(__dirname, "node_modules/emojione/lib/js/emojione"),
            "es6-promise":              path.resolve(__dirname, "node_modules/es6-promise/dist/es6-promise.auto"),
            "filesize":                 path.resolve(__dirname, "node_modules/filesize/lib/filesize"),
            "form-utils":               path.resolve(__dirname, "src/utils/form"),
            "i18n":                     path.resolve(__dirname, "src/i18n"),
            "jed":                      path.resolve(__dirname, "node_modules/jed/jed"),
            "jquery":                   path.resolve(__dirname, "src/jquery-stub"),
            "lodash":                   path.resolve(__dirname, "node_modules/lodash/lodash"),
            "lodash.converter":         path.resolve(__dirname, "3rdparty/lodash.fp"),
            "lodash.fp":                path.resolve(__dirname, "src/lodash.fp"),
            "lodash.noconflict":        path.resolve(__dirname, "src/lodash.noconflict"),
            "message-utils":            path.resolve(__dirname, "src/utils/message"),
            "muc-utils":                path.resolve(__dirname, "src/utils/muc"),
            "pluggable":                path.resolve(__dirname, "node_modules/pluggable.js/dist/pluggable"),
            "polyfill":                 path.resolve(__dirname, "src/polyfill"),
            "punycode":                 path.resolve(__dirname, "node_modules/urijs/src/punycode"),
            "sizzle":                   path.resolve(__dirname, "node_modules/sizzle/dist/sizzle"),
            "snabbdom":                 path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom"),
            "snabbdom-attributes":      path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-attributes"),
            "snabbdom-class":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-class"),
            "snabbdom-dataset":         path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-dataset"),
            "snabbdom-eventlisteners":  path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-eventlisteners"),
            "snabbdom-props":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-props"),
            "snabbdom-style":           path.resolve(__dirname, "node_modules/snabbdom/dist/snabbdom-style"),
            "strophe":                  path.resolve(__dirname, "node_modules/strophe.js/strophe"),
            "strophe.ping":             path.resolve(__dirname, "node_modules/strophejs-plugin-ping/strophe.ping"),
            "strophe.rsm":              path.resolve(__dirname, "node_modules/strophejs-plugin-rsm/strophe.rsm"),
            "tovnode":                  path.resolve(__dirname, "node_modules/snabbdom/dist/tovnode"),
            "underscore":               path.resolve(__dirname, "src/underscore-shim"),
            "uri":                      path.resolve(__dirname, "node_modules/urijs/src/URI"),
            "utils":                    path.resolve(__dirname, "src/utils/core"),
            "vdom-parser":              path.resolve(__dirname, "node_modules/vdom-parser/dist"),
            "xss":                      path.resolve(__dirname, "node_modules/xss/dist/xss"),
            "xss.noconflict":           path.resolve(__dirname, "node_modules/xss.noconflict"),

            "converse-bookmarks":       path.resolve(__dirname, "src/converse-bookmarks"),
            "converse-chatboxes":       path.resolve(__dirname, "src/converse-chatboxes"),
            "converse-caps":            path.resolve(__dirname, "src/converse-caps"),
            "converse-chatview":        path.resolve(__dirname, "src/converse-chatview"),
            "converse-controlbox":      path.resolve(__dirname, "src/converse-controlbox"),
            "converse-core":            path.resolve(__dirname, "src/converse-core"),
            "converse-disco":           path.resolve(__dirname, "src/converse-disco"),
            "converse-dragresize":      path.resolve(__dirname, "src/converse-dragresize"),
            "converse-embedded":        path.resolve(__dirname, "src/converse-embedded"),
            "converse-fullscreen":      path.resolve(__dirname, "src/converse-fullscreen"),
            "converse-headline":        path.resolve(__dirname, "src/converse-headline"),
            "converse-mam":             path.resolve(__dirname, "src/converse-mam"),
            "converse-message-view":    path.resolve(__dirname, "src/converse-message-view"),
            "converse-minimize":        path.resolve(__dirname, "src/converse-minimize"),
            "converse-modal":           path.resolve(__dirname, "src/converse-modal"),
            "converse-muc":             path.resolve(__dirname, "src/converse-muc"),
            "converse-muc-views":       path.resolve(__dirname, "src/converse-muc-views"),
            "converse-notification":    path.resolve(__dirname, "src/converse-notification"),
            "converse-ping":            path.resolve(__dirname, "src/converse-ping"),
            "converse-profile":         path.resolve(__dirname, "src/converse-profile"),
            "converse-register":        path.resolve(__dirname, "src/converse-register"),
            "converse-roomslist":       path.resolve(__dirname, "src/converse-roomslist"),
            "converse-roster":          path.resolve(__dirname, "src/converse-roster"),
            "converse-rosterview":      path.resolve(__dirname, "src/converse-rosterview"),
            "converse-singleton":       path.resolve(__dirname, "src/converse-singleton"),
            "converse-vcard":           path.resolve(__dirname, "src/converse-vcard")
        }
    }
}

module.exports = config;
