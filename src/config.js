var config;
if (typeof(require) === 'undefined') {
    /* XXX: Hack to work around r.js's stupid parsing.
     * We want to save the configuration in a variable so that we can reuse it in
     * tests/main.js.
     */
    // eslint-disable-next-line
    require = { // jshint ignore:line
        config: function (c) {
            config = c;
        }
    };
}

require.config({
    baseUrl: '.',
    paths: {
        "almond":                   "node_modules/almond/almond",
        "awesomplete":              "node_modules/awesomplete-avoid-xss/awesomplete",
        "babel":                    "node_modules/requirejs-babel/babel-5.8.34.min",
        "backbone":                 "node_modules/backbone/backbone",
        "backbone.browserStorage":  "node_modules/backbone.browserStorage/backbone.browserStorage",
        "backbone.noconflict":      "src/backbone.noconflict",
        "backbone.overview":        "node_modules/backbone.overview/backbone.overview",
        "emojione":                 "node_modules/emojione/lib/js/emojione",
        "es6-promise":              "node_modules/es6-promise/dist/es6-promise.auto",
        "eventemitter":             "node_modules/otr/build/dep/eventemitter",
        "form-utils":               "src/form-utils",
        "jquery":                   "node_modules/jquery/dist/jquery",
        "jquery.browser":           "node_modules/jquery.browser/dist/jquery.browser",
        "jquery.noconflict":        "src/jquery.noconflict",
        "lodash":                   "node_modules/lodash/lodash",
        "lodash.converter":         "3rdparty/lodash.fp",
        "lodash.fp":                "src/lodash.fp",
        "lodash.noconflict":        "src/lodash.noconflict",
        "pluggable":                "node_modules/pluggable.js/dist/pluggable",
        "polyfill":                 "src/polyfill",
        "sizzle":                   "node_modules/jquery/sizzle/dist/sizzle",
        "strophe":                  "node_modules/strophe.js/strophe",
        "strophe.disco":            "node_modules/strophejs-plugin-disco/strophe.disco",
        "strophe.ping":             "node_modules/strophejs-plugin-ping/strophe.ping",
        "strophe.rsm":              "node_modules/strophejs-plugin-rsm/strophe.rsm",
        "strophe.vcard":            "node_modules/strophejs-plugin-vcard/strophe.vcard",
        "text":                     "node_modules/text/text",
        "tpl":                      "node_modules/lodash-template-loader/loader",
        "typeahead":                "components/typeahead.js/index",
        "underscore":               "src/underscore-shim",
        "utils":                    "src/utils",
        "xss":                      "node_modules/xss/dist/xss",
        "xss.noconflict":           "src/xss.noconflict",

        // Converse
        "converse":                 "src/converse",
        "inverse":                  "src/inverse",

        "converse-bookmarks":       "src/converse-bookmarks",
        "converse-chatboxes":       "src/converse-chatboxes",
        "converse-chatview":        "src/converse-chatview",
        "converse-controlbox":      "src/converse-controlbox",
        "converse-core":            "src/converse-core",
        "converse-disco":           "src/converse-disco",
        "converse-dragresize":      "src/converse-dragresize",
        "converse-headline":        "src/converse-headline",
        "converse-inverse":         "src/converse-inverse",
        "converse-mam":             "src/converse-mam",
        "converse-minimize":        "src/converse-minimize",
        "converse-muc":             "src/converse-muc",
        "converse-muc-embedded":    "src/converse-muc-embedded",
        "converse-notification":    "src/converse-notification",
        "converse-otr":             "src/converse-otr",
        "converse-ping":            "src/converse-ping",
        "converse-register":        "src/converse-register",
        "converse-roomslist":       "src/converse-roomslist",
        "converse-rosterview":      "src/converse-rosterview",
        "converse-singleton":       "src/converse-singleton",
        "converse-vcard":           "src/converse-vcard",

        // Off-the-record-encryption
        // "bigint":               "node_modules/otr/build/dep/bigint",
        "bigint":               "3rdparty/bigint",
        "crypto":               "node_modules/otr/build/dep/crypto",
        "salsa20":              "node_modules/otr/build/dep/salsa20",
        "otr":                  "node_modules/otr/build/otr",

        // Locales paths
        "locales":   "src/locales",
        "jed":       "node_modules/jed/jed",
        "af":        "locale/af/LC_MESSAGES/converse.json",
        "ca":        "locale/ca/LC_MESSAGES/converse.json",
        "de":        "locale/de/LC_MESSAGES/converse.json",
        "es":        "locale/es/LC_MESSAGES/converse.json",
        "fr":        "locale/fr/LC_MESSAGES/converse.json",
        "he":        "locale/he/LC_MESSAGES/converse.json",
        "hu":        "locale/hu/LC_MESSAGES/converse.json",
        "id":        "locale/id/LC_MESSAGES/converse.json",
        "it":        "locale/it/LC_MESSAGES/converse.json",
        "ja":        "locale/ja/LC_MESSAGES/converse.json",
        "nb":        "locale/nb/LC_MESSAGES/converse.json",
        "nl":        "locale/nl/LC_MESSAGES/converse.json",
        "pl":        "locale/pl/LC_MESSAGES/converse.json",
        "pt_BR":     "locale/pt_BR/LC_MESSAGES/converse.json",
        "ru":        "locale/ru/LC_MESSAGES/converse.json",
        "uk":        "locale/uk/LC_MESSAGES/converse.json",
        "zh":        "locale/zh/LC_MESSAGES/converse.json",

        "moment_with_locales": "3rdparty/moment_locales",
    },

    packages: [{
        'name': 'moment',
        // This location is relative to baseUrl. Choose bower_components
        // or node_modules, depending on how moment was installed.
        'location': 'node_modules/moment',
        'main': 'moment'
    }],

    map: {
        // '*' means all modules will get the '*.noconflict' version
        // as their dependency.
        '*': {
            'jquery': 'jquery.noconflict',
            'backbone': 'backbone.noconflict',
            'lodash': 'lodash.noconflict'
         },
        // '*.noconflict' wants the real module
        // If this line was not here, there would
        // be an unresolvable cyclic dependency.
        'backbone.noconflict': { 'backbone': 'backbone' },
        'jquery.noconflict': { 'jquery': 'jquery' },
        'lodash.noconflict': { 'lodash': 'lodash' }
    },

    lodashLoader: {
        // Configuration for requirejs-tpl
        // Use Mustache style syntax for variable interpolation
        root: "src/templates/",
        templateSettings: {
            "escape": /\{\{\{([\s\S]+?)\}\}\}/g,
            "evaluate": /\{\[([\s\S]+?)\]\}/g,
            "interpolate": /\{\{([\s\S]+?)\}\}/g
        }
    },

    // define module dependencies for modules not using define
    shim: {
        'awesomplete':          { exports: 'Awesomplete'},
        'emojione':             { exports: 'emojione'},
        'xss':                  {
            init: function (xss_noconflict) {
                return {
                    filterXSS: window.filterXSS,
                    filterCSS: window.filterCSS
                }
            }
        }
    }
});
