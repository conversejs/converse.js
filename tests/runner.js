var config = {
    baseUrl: '../',
    paths: {
        'console-reporter': 'tests/console-reporter',
        'es6-promise': 'node_modules/es6-promise/dist/es6-promise.auto',
        'jasmine-console': 'node_modules/jasmine-core/lib/console/console',
        'jasmine-core': 'node_modules/jasmine-core/lib/jasmine-core/jasmine',
        'jasmine-html': 'node_modules/jasmine-core/lib/jasmine-core/jasmine-html',
        'jasmine':'node_modules/jasmine-core/lib/jasmine-core/boot',
        'mock': 'tests/mock',
        'sinon': 'node_modules/sinon/pkg/sinon',
        'test-utils': 'tests/utils',
        'transcripts': 'converse-logs/converse-logs'
    },
    shim: {
        'jasmine-html': {
            deps: ['jasmine-core'],
            exports: 'window.jasmineRequire'
        },
        'jasmine-console': {
            deps: ['jasmine-core'],
            exports: 'window.jasmineRequire'
        },
        'jasmine': {
            deps: ['jasmine-core', 'jasmine-html', 'jasmine-console'],
            exports: 'window.jasmine'
        },
    }
};
require.config(config);

var specs = [
    "jasmine",
    //"spec/transcripts",
    "spec/spoilers",
    "spec/roomslist",
    "spec/profiling",
    "spec/utils",
    "spec/converse",
    "spec/bookmarks",
    "spec/headline",
    "spec/disco",
    "spec/protocol",
    "spec/presence",
    "spec/eventemitter",
    "spec/smacks",
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
    "spec/modtools",
    "spec/room_registration",
    "spec/autocomplete",
    "spec/minchats",
    "spec/notification",
    "spec/login",
    "spec/register",
    "spec/http-file-upload"
];

require(['console-reporter', 'mock', 'sinon'], (ConsoleReporter, mock, sinon) => {
    if (window.view_mode) {
        mock.view_mode = window.view_mode;
    }
    window.sinon = sinon;
    // Load the specs
    require(specs, jasmine => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000;
        const jasmineEnv = jasmine.getEnv();
        jasmineEnv.addReporter(new ConsoleReporter());
        window.onload();
    });
});
