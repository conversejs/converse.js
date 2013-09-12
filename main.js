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
        "strophe.disco": "components/strophe.disco/index"
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
