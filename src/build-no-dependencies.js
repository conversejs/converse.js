({
    baseUrl: "../",
    name: "almond",
    out: "../dist/converse-no-dependencies.min.js",
    include: ["converse"],
    excludeShallow: [
        "locales",
        "text!af",
        "text!de",
        "text!en",
        "text!es",
        "text!fr",
        "text!he",
        "text!hu",
        "text!id",
        "text!it",
        "text!ja",
        "text!nb",
        "text!nl",
        "text!pl",
        "text!pt_BR",
        "text!ru",
        "text!uk",
        "text!zh"
    ],
    exclude: [
        "awesomplete",
        "jquery",
        "jquery-private",
        "backbone.browserStorage",
        "backbone.overview",
        "moment_with_locales",
        "strophe",
        "strophe.disco",
        "strophe.rsm",
        "strophe.vcard",
        "strophe.ping",
        "otr",
        "lodash"
    ],
    wrap: {
        startFile: "start.frag",
        endFile: "end-no-dependencies.frag"
    },
    mainConfigFile: "config.js"
})
