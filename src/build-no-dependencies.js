({
    baseUrl: "../",
    name: "components/almond/almond.js",
    out: "../builds/converse-no-dependencies.min.js",
    include: ['converse'],
    exclude: [
        'jquery',
        'jquery-private',
        "backbone.browserStorage",
        "backbone.overview",
        "moment_with_locales",
        "strophe",
        "strophe.disco",
        "strophe.rsm",
        "strophe.vcard",
        "strophe.ping",
        "typeahead",
        "otr",
        "underscore"
    ],
    wrap: {
        endFile: "wrapper-end.js"
    },
    insertRequire: ['converse'],
    mainConfigFile: '../main.js'
})
