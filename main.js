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
        "crypto.md5": "components/crypto-js/src/md5",
        "crypto.evpkdf": "components/crypto-js/src/evpkdf",
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
        "converse-dependencies": "src/deps-full"
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
        'jquery.tinysort': { deps: ['jquery'] },
        'strophe': { deps: ['jquery'] },
        'underscore':   { exports: '_' },
        'strophe.muc':  { deps: ['strophe', 'jquery'] },
        'strophe.roster':   { deps: ['strophe'] },
        'strophe.vcard':    { deps: ['strophe'] },
        'strophe.disco':    { deps: ['strophe'] }
    }
});

require(["jquery", "converse"], function(require, $, converse) {
    window.converse = converse;
});
