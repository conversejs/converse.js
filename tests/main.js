// Extra test dependencies
config.paths.mock = "tests/mock";
config.paths.test_utils = "tests/utils";
config.paths.sinon = "components/sinon/lib/sinon";
config.paths.jasmine = "components/jasmine/lib/jasmine-core/jasmine";
config.paths.transcripts = "converse-logs/converse-logs";
config.paths["jasmine-html"] = "components/jasmine/lib/jasmine-core/jasmine-html";
config.paths["console-runner"] = "node_modules/phantom-jasmine/lib/console-runner";
config.shim['jasmine-html'] = {
    deps: ['jasmine'],
    exports: 'jasmine'
};
config.shim['console-runner'] = {
    deps: ['jasmine']
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
    "mock",
    "jasmine-html",
    "sinon",
    "console-runner",
    //"spec/transcripts",
    "spec/utils",
    "spec/converse",
    "spec/bookmarks",
    "spec/headline",
    "spec/disco",
    "spec/protocol",
    "spec/mam",
    "spec/otr",
    "spec/eventemitter",
    "spec/controlbox",
    "spec/chatbox",
    "spec/chatroom",
    "spec/minchats",
    "spec/notification",
    "spec/profiling",
    "spec/ping",
    "spec/register",
    "spec/xmppstatus"
    ], function($, mock, jasmine, sinon) {
        window.sinon = sinon;
        window.localStorage.clear();
        window.sessionStorage.clear();
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
    }
);
