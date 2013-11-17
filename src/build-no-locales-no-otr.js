({
    baseUrl: "../",
    name: "components/almond/almond.js",
    out: "../builds/converse-no-locales-no-otr.min.js",
    include: ['main'],
    paths: {
        "jquery": "components/jquery/jquery",
        "jed": "components/jed/jed",
        "locales": "locale/nolocales",
        "pt_BR": "locale/pt_BR/LC_MESSAGES/pt_BR", 
        "ru": "locale/ru/LC_MESSAGES/ru",
        "jquery.tinysort": "components/tinysort/src/jquery.tinysort",
        "underscore": "components/underscore/underscore",
        "backbone": "components/backbone/backbone",
        "backbone.localStorage": "components/backbone.localStorage/backbone.localStorage",
        "strophe": "components/strophe/strophe",
        "strophe.muc": "components/strophe.muc/index",
        "strophe.roster": "components/strophe.roster/index",
        "strophe.vcard": "components/strophe.vcard/index",
        "strophe.disco": "components/strophe.disco/index",
        "converse-dependencies": "src/deps-no-otr"
    }
})
