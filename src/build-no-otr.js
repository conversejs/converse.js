({
    baseUrl: "../",
    name: "components/almond/almond.js",
    out: "../builds/converse-no-otr.min.js",
    include: ['main'],
    tpl: {
        // Use Mustache style syntax for variable interpolation
        templateSettings: {
            evaluate : /\{\[([\s\S]+?)\]\}/g,
            interpolate : /\{\{([\s\S]+?)\}\}/g
        }
    },
    paths: {
        "jquery": "components/jquery/dist/jquery",
        "jed": "components/jed/jed",
        "locales": "locale/locales",
        "af": "locale/af/LC_MESSAGES/af",
        "de": "locale/de/LC_MESSAGES/de",
        "en": "locale/en/LC_MESSAGES/en",
        "es": "locale/es/LC_MESSAGES/es",
        "fr": "locale/fr/LC_MESSAGES/fr",
        "he": "locale/he/LC_MESSAGES/he",
        "hu": "locale/hu/LC_MESSAGES/hu",
        "it": "locale/it/LC_MESSAGES/it",
        "id": "locale/id/LC_MESSAGES/id",
        "ja": "locale/ja/LC_MESSAGES/ja",
        "nl": "locale/nl/LC_MESSAGES/nl",
        "pt_BR": "locale/pt_BR/LC_MESSAGES/pt_BR", 
        "ru": "locale/ru/LC_MESSAGES/ru",
        "zh": "locale/zh/LC_MESSAGES/zh",
        "jquery.tinysort": "components/tinysort/src/jquery.tinysort",
        "underscore": "components/underscore/underscore",
        "backbone": "components/backbone/backbone",
        "backbone.browserStorage": "components/backbone.browserStorage/backbone.browserStorage",
        "backbone.overview": "components/backbone.overview/backbone.overview",
        "strophe": "components/strophe/strophe",
        "strophe.muc": "components/strophe.muc/index",
        "strophe.roster": "components/strophe.roster/index",
        "strophe.vcard": "components/strophe.vcard/index",
        "strophe.disco": "components/strophe.disco/index",
        "converse-dependencies": "src/deps-no-otr",
        "jquery.browser": "components/jquery.browser/dist/jquery.browser",
        "moment":"components/momentjs/moment",
        "converse-templates":"src/templates",
        "tpl": "components/requirejs-tpl-jcbrand/tpl",
        "text": "components/requirejs-text/text"
    }
})
