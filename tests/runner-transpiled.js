/*global config */

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
config.paths["console-reporter"] = "tests/console-reporter";
config.paths["jasmine-html"] = "node_modules/jasmine-core/lib/jasmine-core/jasmine-html";

config.paths.converse =                 "builds/converse";
config.paths.utils =                    "builds/utils";
config.paths["converse-bookmarks"] =    "builds/converse-bookmarks";
config.paths["converse-chatboxes"] =    "builds/converse-chatboxes";
config.paths["converse-chatview"] =     "builds/converse-chatview";
config.paths["converse-controlbox"] =   "builds/converse-controlbox";
config.paths["converse-core"] =         "builds/converse-core";
config.paths["converse-disco"] =        "builds/converse-disco";
config.paths["converse-dragresize"] =   "builds/converse-dragresize";
config.paths["converse-headline"] =     "builds/converse-headline";
config.paths["converse-fullscreen"] =   "builds/converse-fullscreen";
config.paths["converse-mam"] =          "builds/converse-mam";
config.paths["converse-minimize"] =     "builds/converse-minimize";
config.paths["converse-muc"] =          "builds/converse-muc";
config.paths["converse-muc-embedded"] = "builds/converse-muc-embedded";
config.paths["converse-notification"] = "builds/converse-notification";
config.paths["converse-otr"] =          "builds/converse-otr";
config.paths["converse-ping"] =         "builds/converse-ping";
config.paths["converse-profile"] =      "builds/converse-profile";
config.paths["converse-register"] =     "builds/converse-register";
config.paths["converse-roomslist"] =    "builds/converse-roomslist";
config.paths["converse-rosterview"] =   "builds/converse-rosterview";
config.paths["converse-singleton"] =    "builds/converse-singleton";
config.paths["converse-vcard"] =        "builds/converse-vcard";


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
    "spec/chatroom",
    "spec/minchats",
    "spec/notification",
    "spec/register"
];

require(['console-reporter', 'mock', 'sinon', 'wait-until-promise', 'pluggable'],
        function(ConsoleReporter, mock, sinon, waitUntilPromise, pluggable) {
    window.sinon = sinon;
    waitUntilPromise.setPromiseImplementation(window.Promise);
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
