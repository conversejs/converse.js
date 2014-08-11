({
    baseUrl: "../",
    name: "components/almond/almond.js",
    out: "../builds/converse-no-locales-no-otr.min.js",
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
        "locales": "locale/nolocales",
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
        "utils": "src/utils",
        "moment":"components/momentjs/moment",
        "converse-templates":"src/templates",
        "tpl": "components/requirejs-tpl-jcbrand/tpl",
        "text": "components/requirejs-text/text"
    }
})
