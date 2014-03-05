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
        "salsa20": "components/otr/build/dep/salsa20",
        "bigint": "src/bigint",
        "crypto.core": "components/otr/vendor/cryptojs/core",
        "crypto.enc-base64": "components/otr/vendor/cryptojs/enc-base64",
        "crypto.md5": "components/crypto-js-evanvosberg/src/md5",
        "crypto.evpkdf": "components/crypto-js-evanvosberg/src/evpkdf",
        "crypto.cipher-core": "components/otr/vendor/cryptojs/cipher-core",
        "crypto.aes": "components/otr/vendor/cryptojs/aes",
        "crypto.sha1": "components/otr/vendor/cryptojs/sha1",
        "crypto.sha256": "components/otr/vendor/cryptojs/sha256",
        "crypto.hmac": "components/otr/vendor/cryptojs/hmac",
        "crypto.pad-nopadding": "components/otr/vendor/cryptojs/pad-nopadding",
        "crypto.mode-ctr": "components/otr/vendor/cryptojs/mode-ctr",
        "crypto": "src/crypto",
        "eventemitter": "components/otr/build/dep/eventemitter",
        "otr": "components/otr/build/otr",
        "converse-dependencies": "src/deps-full",
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
        'underscore':           { exports: '_' },
        'crypto.aes':           { deps: ['crypto.cipher-core'] },
        'crypto.cipher-core':   { deps: ['crypto.enc-base64', 'crypto.evpkdf'] },
        'crypto.enc-base64':    { deps: ['crypto.core'] },
        'crypto.evpkdf':        { deps: ['crypto.md5'] },
        'crypto.hmac':          { deps: ['crypto.core'] },
        'crypto.md5':           { deps: ['crypto.core'] },
        'crypto.mode-ctr':      { deps: ['crypto.cipher-core'] },
        'crypto.pad-nopadding': { deps: ['crypto.cipher-core'] },
        'crypto.sha1':          { deps: ['crypto.core'] },
        'crypto.sha256':        { deps: ['crypto.core'] },
        'jquery.tinysort':      { deps: ['jquery'] },
        'strophe':              { deps: ['jquery'] },
        'strophe.disco':        { deps: ['strophe'] },
        'strophe.muc':          { deps: ['strophe', 'jquery'] },
        'strophe.roster':       { deps: ['strophe'] },
        'strophe.vcard':        { deps: ['strophe'] },

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
