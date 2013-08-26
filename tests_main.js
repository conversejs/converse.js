
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
        // Extra test dependencies
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
        'tinysort': { deps: ['jquery'] },
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

require([
    "jquery",
    "converse",
    "mock",
    "jasmine-html"
    ], function($, converse, mock_connection, jasmine) {
        // Set up converse.js
        window.localStorage.clear();
        converse.initialize({
            prebind: false,
            xhr_user_search: false,
            auto_subscribe: false,
            animate: false,
            connection: mock_connection,
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
                    jasmineEnv.updateInterval = 200;
                }
                jasmineEnv.execute();
            });
        });
    }
);
