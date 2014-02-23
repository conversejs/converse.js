// Extra test dependencies
config.paths.mock = "tests/mock";
config.paths.utils = "tests/utils";
config.paths.jasmine = "components/jasmine/lib/jasmine-core/jasmine";
config.paths["jasmine-html"] = "components/jasmine/lib/jasmine-core/jasmine-html";
config.paths["jasmine-console-reporter"] = "node_modules/jasmine-reporters/src/jasmine.console_reporter";
config.paths["jasmine-junit-reporter"] = "node_modules/jasmine-reporters/src/jasmine.junit_reporter";

config.shim['jasmine-html'] = {
    deps: ['jasmine'],
    exports: 'jasmine'
};
config.shim['jasmine-console-reporter'] = {
    deps: ['jasmine-html'],
    exports: 'jasmine'
};
config.shim['jasmine-junit-reporter'] = {
    deps: ['jasmine-html'],
    exports: 'jasmine'
};
require.config(config);

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
        window.converse_api = converse;
        window.localStorage.clear();
        converse.initialize({
            prebind: false,
            xhr_user_search: false,
            auto_subscribe: false,
            animate: false,
            show_call_button: true,
            connection: mock.mock_connection,
            testing: true
        }, function (converse) {
            window.converse = converse;
            window.crypto = {
                getRandomValues: function (buf) {
                    var i;
                    for (i=0, len=buf.length; i<len; i++) {
                        buf[i] = Math.floor(Math.random()*256);
                    } 
                }
            };
            require([
                "jasmine-console-reporter",
                "jasmine-junit-reporter",
                "spec/converse",
                "spec/otr",
                "spec/eventemitter",
                "spec/controlbox",
                "spec/chatbox",
                "spec/chatroom"
            ], function () {
                // Make sure this callback is only called once.
                delete converse.callback;

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
                    jasmineEnv.updateInterval = 100;
                }
                jasmineEnv.execute();
            });
        });
    }
);
