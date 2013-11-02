require.config({
    paths: {
        "jquery": "components/jquery/jquery",
        "locales": "locale/locales",
        "jquery.tinysort": "components/tinysort/src/jquery.tinysort",
        "underscore": "components/underscore/underscore",
        "backbone": "components/backbone/backbone",
        "backbone.localStorage": "components/backbone.localStorage/backbone.localStorage",
        "strophe": "components/strophe/strophe",
        "strophe.muc": "components/strophe.muc/index",
        "strophe.roster": "components/strophe.roster/index",
        "strophe.vcard": "components/strophe.vcard/index",
        "strophe.disco": "components/strophe.disco/index",
        "otr": "components/otr/build/otr",
        "bigint": "components/otr/build/dep/bigint",
        "crypto": "components/otr/build/dep/crypto",
        "eventemitter": "components/otr/build/dep/eventemitter",
        "salsa20": "components/otr/build/dep/salsa20",
        "crypto.aes": "components/crypto-js/build/rollups/aes",
        // Extra test dependencies
        "mock": "tests/mock",
        "utils": "tests/utils",
        "jasmine": "components/jasmine/lib/jasmine-core/jasmine",
        "jasmine-html": "components/jasmine/lib/jasmine-core/jasmine-html",
        "jasmine-console-reporter": "node_modules/jasmine-reporters/src/jasmine.console_reporter",
        "jasmine-junit-reporter": "node_modules/jasmine-reporters/src/jasmine.junit_reporter"
    },

    // define module dependencies for modules not using define
    shim: {
        'backbone': {
            //These script dependencies should be loaded before loading
            //backbone.js
            deps: [
                'underscore',
                'jquery'
                ],
            //Once loaded, use the global 'Backbone' as the
            //module value.
            exports: 'Backbone'
        },
        'jquery.tinysort': { deps: ['jquery'] },
        'strophe': { deps: ['jquery'] },
        'underscore':   { exports: '_' },
        'strophe.muc':  { deps: ['strophe', 'jquery'] },
        'strophe.roster':   { deps: ['strophe'] },
        'strophe.vcard':    { deps: ['strophe'] },
        'strophe.disco':    { deps: ['strophe'] },
        // Extra test dependencies
        'jasmine-html': {
            deps: ['jasmine'],
            exports: 'jasmine'
        },
        'jasmine-console-reporter': {
            deps: ['jasmine-html'],
            exports: 'jasmine'
        },
        'jasmine-junit-reporter': {
            deps: ['jasmine-html'],
            exports: 'jasmine'
        }
    }
});

// Polyfill 'bind' which is not available in phantomjs < 2.0
if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
        if (typeof this !== "function") {
            // closest thing possible to the ECMAScript 5 internal IsCallable function
            throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
        }
        var aArgs = Array.prototype.slice.call(arguments, 1), 
            fToBind = this, 
            fNOP = function () {},
            fBound = function () {
            return fToBind.apply(this instanceof fNOP && oThis ? this : oThis,
                aArgs.concat(Array.prototype.slice.call(arguments)));
            };
        fNOP.prototype = this.prototype;
        fBound.prototype = new fNOP();
        return fBound;
    };
}

require([
    "jquery",
    "converse",
    "mock",
    "jasmine-html"
    ], function($, converse, mock, jasmine) {
        // Set up converse.js
        window.localStorage.clear();
        converse.initialize({
            prebind: false,
            xhr_user_search: false,
            auto_subscribe: false,
            animate: false,
            connection: mock.mock_connection,
            testing: true
        }, function (converse) {
            window.converse = converse;
            require([
                "jasmine-console-reporter",
                "jasmine-junit-reporter",
                "spec/MainSpec",
                "spec/ChatRoomSpec"
            ], function () {
                // Jasmine stuff
                var jasmineEnv = jasmine.getEnv();
                if (/PhantomJS/.test(navigator.userAgent)) {
                    jasmineEnv.addReporter(new jasmine.TrivialReporter());
                    jasmineEnv.addReporter(new jasmine.JUnitXmlReporter('./test-reports/'));
                    jasmineEnv.addReporter(new jasmine.ConsoleReporter());
                    jasmineEnv.updateInterval = 0;
                } else {
                    var htmlReporter = new jasmine.HtmlReporter();
                    jasmineEnv.addReporter(htmlReporter);
                    jasmineEnv.addReporter(new jasmine.ConsoleReporter());
                    jasmineEnv.specFilter = function(spec) {
                        return htmlReporter.specFilter(spec);
                    };
                    jasmineEnv.updateInterval = 20;
                }
                jasmineEnv.execute();
            });
        });
    }
);
