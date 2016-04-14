({
    baseUrl: "../",
    name: "components/almond/almond.js",
    out: "../dist/converse-no-dependencies.min.js",
    include: ['converse'],
    excludeShallow: [
        'locales',
        'text!af',
        'text!de',
        'text!en',
        'text!es',
        'text!fr',
        'text!he',
        'text!hu',
        'text!id',
        'text!it',
        'text!ja',
        'text!nb',
        'text!nl',
        'text!pl',
        'text!pt_BR',
        'text!ru',
        'text!uk',
        'text!zh'
    ],
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
        endFile: ["wrapper-no-jquery.js", "wrapper-no-deps.js"]
    },
    insertRequire: ['converse'],
    mainConfigFile: '../converse.js'
})
