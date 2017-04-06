/*global config */

// Extra test dependencies
config.paths.mock = "tests/mock";
config.paths['wait-until-promise'] = "node_modules/wait-until-promise/index";
config.paths['test-utils'] = "tests/utils";
config.paths.sinon = "node_modules/sinon/pkg/sinon";
config.paths.transcripts = "converse-logs/converse-logs";
config.paths.jasmine = "node_modules/jasmine-core/lib/jasmine-core/jasmine";
config.paths.boot = "node_modules/jasmine-core/lib/jasmine-core/boot";
config.paths["jasmine-html"] = "node_modules/jasmine-core/lib/jasmine-core/jasmine-html";
// config.paths["console-runner"] = "node_modules/phantom-jasmine/lib/console-runner";
config.shim.jasmine = {
    exports: 'window.jasmineRequire'
};
config.shim['jasmine-html'] = {
    deps: ['jasmine'],
    exports: 'window.jasmineRequire'
};
config.shim.boot = {
    deps: ['jasmine', 'jasmine-html'],
    exports: 'window.jasmineRequire'
};
/*
config.shim['console-runner'] = {
    deps: ['jasmine']
};
*/
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

var specs = [
    //"spec/transcripts",
    // "spec/profiling",
    "spec/utils",
    "spec/converse",
    "spec/bookmarks",
    "spec/headline",
    "spec/disco",
    "spec/protocol",
    "spec/presence",
    "spec/eventemitter",
    "spec/ping",
    "spec/xmppstatus",
    "spec/mam",
    "spec/otr",
    "spec/controlbox",
    "spec/chatbox",
    "spec/chatroom",
    "spec/minchats",
    "spec/notification",
    "spec/register"
];

require(['jquery', 'mock', 'boot', 'sinon', 'wait-until-promise'],
        function($, mock, jasmine, sinon, waitUntilPromise) {
    window.sinon = sinon;
    window.waitUntilPromise = waitUntilPromise['default'];
    window.localStorage.clear();
    window.sessionStorage.clear();

    // Load the specs
    require(specs, function () {
            // Initialize the HTML Reporter and execute the environment (setup by `boot.js`)
            // http://stackoverflow.com/questions/19240302/does-jasmine-2-0-really-not-work-with-require-js
            window.onload();
        });
    }
);
