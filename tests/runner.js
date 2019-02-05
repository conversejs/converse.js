var config = {
    baseUrl: '../',
    paths: {
        "console-reporter":         "tests/console-reporter",
        "es6-promise":              "node_modules/es6-promise/dist/es6-promise.auto",
        "jquery":                   "node_modules/jquery/dist/jquery",
        "lodash":                   "node_modules/lodash/lodash",
        "lodash.converter":         "3rdparty/lodash.fp",
        "lodash.fp":                "src/lodash.fp",
        "lodash.noconflict":        "node_modules/@converse/headless/lodash.noconflict",
        "pluggable":                "node_modules/pluggable.js/dist/pluggable",
        "sizzle":                   "node_modules/sizzle/dist/sizzle",
        "underscore":               "src/underscore-shim",
    },
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
    "spec/omemo",
    "spec/controlbox",
    "spec/roster",
    "spec/chatbox",
    "spec/user-details-modal",
    "spec/messages",
    "spec/muc",
    "spec/room_registration",
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
