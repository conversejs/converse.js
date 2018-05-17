/*global config */

// Extra test dependencies
config.baseUrl = '../';
config.paths.jquery = "node_modules/jquery/dist/jquery";
config.paths.mock = "tests/mock";
config.paths['wait-until-promise'] = "node_modules/wait-until-promise/index";
config.paths['test-utils'] = "tests/utils";
config.paths.sinon = "node_modules/sinon/pkg/sinon";
config.paths.transcripts = "converse-logs/converse-logs";
config.paths["jasmine-core"] = "node_modules/jasmine-core/lib/jasmine-core/jasmine";
config.paths.jasmine = "node_modules/jasmine-core/lib/jasmine-core/boot";
config.paths["jasmine-console"] = "node_modules/jasmine-core/lib/console/console";
config.paths["console-reporter"] = "tests/console-reporter";
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
    "spec/xmppstatus",
    "spec/mam",
    "spec/otr",
    "spec/controlbox",
    "spec/roster",
    "spec/chatbox",
    "spec/user-details-modal",
    "spec/messages",
    "spec/chatroom",
    "spec/minchats",
    "spec/notification",
    "spec/login",
    "spec/register",
    "spec/http-file-upload"
];

require(['console-reporter', 'mock', 'sinon', 'wait-until-promise', 'pluggable'],
        function(ConsoleReporter, mock, sinon, waitUntilPromise, pluggable) {

    if (config.view_mode) {
        mock.view_mode = config.view_mode;
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
