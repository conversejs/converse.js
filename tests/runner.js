var config = {
    baseUrl: '../',
    paths: {
        "console-reporter":         "tests/console-reporter",

        "IPv6":                     "node_modules/urijs/src/IPv6",
        "SecondLevelDomains":       "node_modules/urijs/src/SecondLevelDomains",
        "almond":                   "node_modules/almond/almond",
        "awesomplete":              "node_modules/awesomplete-avoid-xss/awesomplete",
        "babel":                    "node_modules/requirejs-babel/babel-5.8.34.min",
        "backbone":                 "node_modules/backbone/backbone",
        "backbone.browserStorage":  "node_modules/backbone.browserStorage/backbone.browserStorage",
        "backbone.nativeview":      "node_modules/backbone.nativeview/backbone.nativeview",
        "backbone.noconflict":      "src/backbone.noconflict",
        "backbone.orderedlistview": "node_modules/backbone.overview/dist/backbone.orderedlistview",
        "backbone.overview":        "node_modules/backbone.overview/dist/backbone.overview",
        "backbone.vdomview":        "node_modules/backbone.vdomview/dist/backbone.vdomview",
        "bootstrap":                "node_modules/bootstrap.native/dist/bootstrap-native-v4",
        "emojione":                 "node_modules/emojione/lib/js/emojione",
        "es6-promise":              "node_modules/es6-promise/dist/es6-promise.auto",
        "eventemitter":             "node_modules/otr/build/dep/eventemitter",
        "filesize":                 "node_modules/filesize/lib/filesize",
        "form-utils":               "src/utils/form",
        "i18n":                     "src/i18n",
        "jed":                      "node_modules/jed/jed",
        "jquery":                   "src/jquery-stub",
        "lodash":                   "node_modules/lodash/lodash",
        "lodash.converter":         "3rdparty/lodash.fp",
        "lodash.fp":                "src/lodash.fp",
        "lodash.noconflict":        "src/lodash.noconflict",
        "message-utils":            "src/utils/message",
        "muc-utils":                "src/utils/muc",
        "pluggable":                "node_modules/pluggable.js/dist/pluggable",
        "polyfill":                 "src/polyfill",
        "punycode":                 "node_modules/urijs/src/punycode",
        "sizzle":                   "node_modules/sizzle/dist/sizzle",
        "snabbdom":                 "node_modules/snabbdom/dist/snabbdom",
        "snabbdom-attributes":      "node_modules/snabbdom/dist/snabbdom-attributes",
        "snabbdom-class":           "node_modules/snabbdom/dist/snabbdom-class",
        "snabbdom-dataset":         "node_modules/snabbdom/dist/snabbdom-dataset",
        "snabbdom-eventlisteners":  "node_modules/snabbdom/dist/snabbdom-eventlisteners",
        "snabbdom-props":           "node_modules/snabbdom/dist/snabbdom-props",
        "snabbdom-style":           "node_modules/snabbdom/dist/snabbdom-style",
        "strophe":                  "node_modules/strophe.js/strophe",
        "strophe.ping":             "node_modules/strophejs-plugin-ping/strophe.ping",
        "strophe.rsm":              "node_modules/strophejs-plugin-rsm/strophe.rsm",
        "text":                     "node_modules/text/text",
        "tovnode":                  "node_modules/snabbdom/dist/tovnode",
        "tpl":                      "node_modules/lodash-template-loader/loader",
        "underscore":               "src/underscore-shim",
        "uri":                      "node_modules/urijs/src/URI",
        "utils":                    "src/utils/core",
        "vdom-parser":              "node_modules/vdom-parser/dist",
        "xss":                      "node_modules/xss/dist/xss",
        "xss.noconflict":           "src/xss.noconflict",

        // Converse
        "converse":                 "src/converse",

        "converse-bookmarks":       "src/converse-bookmarks",
        "converse-chatboxes":       "src/converse-chatboxes",
        "converse-caps":           "src/converse-caps",
        "converse-chatview":        "src/converse-chatview",
        "converse-controlbox":      "src/converse-controlbox",
        "converse-core":            "src/converse-core",
        "converse-disco":           "src/converse-disco",
        "converse-dragresize":      "src/converse-dragresize",
        "converse-embedded":        "src/converse-embedded",
        "converse-fullscreen":      "src/converse-fullscreen",
        "converse-headline":        "src/converse-headline",
        "converse-mam":             "src/converse-mam",
        "converse-message-view":    "src/converse-message-view",
        "converse-minimize":        "src/converse-minimize",
        "converse-modal":           "src/converse-modal",
        "converse-muc":             "src/converse-muc",
        "converse-muc-views":       "src/converse-muc-views",
        "converse-notification":    "src/converse-notification",
        "converse-otr":             "src/converse-otr",
        "converse-ping":            "src/converse-ping",
        "converse-profile":         "src/converse-profile",
        "converse-register":        "src/converse-register",
        "converse-roomslist":       "src/converse-roomslist",
        "converse-roster":          "src/converse-roster",
        "converse-rosterview":      "src/converse-rosterview",
        "converse-singleton":       "src/converse-singleton",
        "converse-vcard":           "src/converse-vcard",

        // Off-the-record-encryption
        // "bigint":               "node_modules/otr/build/dep/bigint",
        "bigint":               "3rdparty/bigint",
        "crypto":               "node_modules/otr/build/dep/crypto",
        "salsa20":              "node_modules/otr/build/dep/salsa20",
        "otr":                  "node_modules/otr/build/otr",
    },

    packages: [{
        'name': 'moment',
        'location': 'node_modules/moment',
        'main': 'moment'
    }],

    map: {
        // '*' means all modules will get the '*.noconflict' version
        // as their dependency.
        '*': {
            'backbone': 'backbone.noconflict',
            'lodash': 'lodash.noconflict'
         },
        // '*.noconflict' wants the real module
        // If this line was not here, there would
        // be an unresolvable cyclic dependency.
        'backbone.noconflict': { 'backbone': 'backbone' },
        'lodash.noconflict': { 'lodash': 'lodash' }
    },

    lodashLoader: {
        // Configuration for requirejs-tpl
        // Use Mustache style syntax for variable interpolation
        root: "src/templates/",
        templateSettings: {
            "escape": /\{\{\{([\s\S]+?)\}\}\}/g,
            "evaluate": /\{\[([\s\S]+?)\]\}/g,
            "interpolate": /\{\{([\s\S]+?)\}\}/g,
            // By default, template places the values from your data in the
            // local scope via the with statement. However, you can specify
            // a single variable name with the variable setting. This can
            // significantly improve the speed at which a template is able
            // to render.
            "variable": 'o'
        }
    },

    // define module dependencies for modules not using define
    shim: {
        'backbone.orderedlistview': { deps: ['backbone.nativeview'] },
        'backbone.overview':        { deps: ['backbone.nativeview'] },
        'backbone.vdomview':        { deps: ['backbone.nativeview'] },
        'awesomplete':              { exports: 'Awesomplete'},
        'emojione':                 { exports: 'emojione'},
        'xss':  {
            'init': function (xss_noconflict) {
                return {
                    filterXSS: window.filterXSS,
                    filterCSS: window.filterCSS
                }
            }
        }
    }
};

// Extra test dependencies
config.paths.jquery = "node_modules/jquery/dist/jquery";
config.paths.mock = "tests/mock";
config.paths['wait-until-promise'] = "node_modules/wait-until-promise/index";
config.paths['test-utils'] = "tests/utils";
config.paths.sinon = "node_modules/sinon/pkg/sinon";
config.paths.transcripts = "converse-logs/converse-logs";
config.paths["jasmine-core"] = "node_modules/jasmine-core/lib/jasmine-core/jasmine";
config.paths.jasmine = "node_modules/jasmine-core/lib/jasmine-core/boot";
config.paths["jasmine-console"] = "node_modules/jasmine-core/lib/console/console";
config.paths["jasmine-html"] = "node_modules/jasmine-core/lib/jasmine-core/jasmine-html";
config.shim.jasmine = {
    exports: 'window.jasmineRequire'
};
config.shim['jasmine-html'] = {
    deps: ['jasmine-core'],
    exports: 'window.jasmineRequire'
};
config.shim['jasmine-console'] = {
    deps: ['jasmine-core'],
    exports: 'window.jasmineRequire'
};
config.shim.jasmine = {
    deps: ['jasmine-core', 'jasmine-html', 'jasmine-console'],
    exports: 'window.jasmine'
};
require.config(config);

var specs = [
    "jasmine",
    //"spec/transcripts",
    "spec/spoilers",
    "spec/profiling",
    "spec/utils",
    "spec/converse",
    "spec/bookmarks",
    "spec/roomslist",
    "spec/headline",
    "spec/disco",
    "spec/protocol",
    "spec/presence",
    "spec/eventemitter",
    "spec/ping",
    "spec/push",
    "spec/xmppstatus",
    "spec/mam",
    // "spec/otr",
    "spec/controlbox",
    "spec/roster",
    "spec/chatbox",
    "spec/user-details-modal",
    "spec/messages",
    "spec/chatroom",
    "spec/autocomplete",
    "spec/minchats",
    "spec/notification",
    "spec/login",
    "spec/register",
    "spec/http-file-upload"
];

require(['console-reporter', 'mock', 'sinon', 'wait-until-promise', 'pluggable'],
        function(ConsoleReporter, mock, sinon, waitUntilPromise, pluggable) {

    if (window.view_mode) {
        mock.view_mode = window.view_mode;
    }
    window.sinon = sinon;
    window.waitUntilPromise = waitUntilPromise.default;
    window.localStorage.clear();
    window.sessionStorage.clear();
    // Load the specs
    require(specs, function (jasmine) {
        var jasmineEnv = jasmine.getEnv();
        jasmineEnv.addReporter(new ConsoleReporter());
        window.onload();
    });
});
