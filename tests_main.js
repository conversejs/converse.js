require.config({
    paths: {
        "jasmine": "Libraries/jasmine-1.3.1/jasmine",
        "jasmine-html": "Libraries/jasmine-1.3.1/jasmine-html",
        "jasmine-console-reporter": "node_modules/jasmine-reporters/src/jasmine.console_reporter",
        "jasmine-junit-reporter": "node_modules/jasmine-reporters/src/jasmine.junit_reporter"
    },
    // define module dependencies for modules not using define
    shim: {
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
    "jasmine-html",
    "jasmine-console-reporter",
    "jasmine-junit-reporter",
    "spec/MainSpec",
    "spec/ChatRoomSpec"
    ], function($, converse, mock_connection, jasmine) {

    // Set up converse.js
    window.localStorage.clear();
    converse.initialize({
        prebind: false,
        xhr_user_search: false,
        auto_subscribe: false,
        animate: false
    });
    converse.onConnected(mock_connection);

    // Jasmine stuff
    var jasmineEnv = jasmine.getEnv();
    if (/PhantomJS/.test(navigator.userAgent)) {
        console.log('ehllo');
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
        jasmineEnv.updateInterval = 250;
    }
    jasmineEnv.execute();
});
