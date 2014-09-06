// Extra test dependencies
config.paths.mock = "tests/mock";
config.paths.test_utils = "tests/utils";
config.paths.jasmine = "components/jasmine/lib/jasmine-core/jasmine";
config.paths["jasmine-html"] = "components/jasmine/lib/jasmine-core/jasmine-html";
config.paths["console-runner"] = "node_modules/phantom-jasmine/lib/console-runner";
config.shim['jasmine-html'] = {
    deps: ['jasmine'],
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
        window.sessionStorage.clear();
        // XXX: call this to initialize Strophe plugins
        new Strophe.Connection('localhost');

        converse.initialize({
            prebind: false,
            xhr_user_search: false,
            auto_subscribe: false,
            animate: false,
            connection: mock.mock_connection,
            no_trimming: true
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
                "console-runner",
                "spec/converse",
                "spec/otr",
                "spec/eventemitter",
                "spec/controlbox",
                "spec/chatbox",
                "spec/chatroom",
                "spec/minchats"
            ], function () {
                // Make sure this callback is only called once.
                delete converse.callback;
                // Stub the trimChat method. It causes havoc when running with
                // phantomJS.
                converse.ChatBoxViews.prototype.trimChat = function () {};

                // Jasmine stuff
                var jasmineEnv = jasmine.getEnv();
                var reporter;
                if (/PhantomJS/.test(navigator.userAgent)) {
                    reporter = new jasmine.ConsoleReporter();
                    window.console_reporter = reporter;
                    jasmineEnv.addReporter(reporter);
                    jasmineEnv.updateInterval = 0;
                } else {
                    reporter = new jasmine.HtmlReporter();
                    jasmineEnv.addReporter(reporter);
                    jasmineEnv.specFilter = function(spec) {
                        return reporter.specFilter(spec);
                    };
                    jasmineEnv.updateInterval = 0;
                }
                jasmineEnv.execute();
            });
        });
    }
);
