config = {
    baseUrl: '.',
    paths: {
        "jquery": "components/jquery/dist/jquery",
        "jquery.tinysort": "components/tinysort/src/jquery.tinysort",
        "jquery.browser": "components/jquery.browser/dist/jquery.browser",
        "locales": "locale/locales",
        "underscore": "components/underscore/underscore",
        "backbone": "components/backbone/backbone",
        "backbone.localStorage": "components/backbone.localStorage/backbone.localStorage",
        "text": 'components/requirejs-text/text',
        "tpl": 'components/requirejs-tpl-jcbrand/tpl',
        "converse-templates": "src/templates",
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
        "moment": "components/momentjs/moment",
        "otr": "components/otr/build/otr",
        "converse-dependencies": "src/deps-full"
    },

    tpl: {
        // Use Mustache style syntax for variable interpolation
        templateSettings: {
            evaluate : /\{\[([\s\S]+?)\]\}/g,
            interpolate : /\{\{([\s\S]+?)\}\}/g
        }
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
        'jquery.browser':       { deps: ['jquery'] },
        'strophe':              { deps: ['jquery'] },
        'strophe.disco':        { deps: ['strophe'] },
        'strophe.muc':          { deps: ['strophe', 'jquery'] },
        'strophe.roster':       { deps: ['strophe'] },
        'strophe.vcard':        { deps: ['strophe'] }
    }
};

if (typeof(require) !== 'undefined') {
    require.config(config);
    require(["jquery", "converse"], function(require, $, converse) {
        window.converse = converse;
    });
}
