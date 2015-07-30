({
    baseUrl: "../",
    name: "components/almond/almond.js",
    out: "../builds/converse-no-locales-no-otr.min.js",
    include: ['main'],
    mainConfigFile: '../main.js',
    paths: {
        "moment_with_locales":    "components/momentjs/moment",
        "converse-dependencies":  "src/deps-no-otr",
        "locales":                "locale/nolocales"
    }
})
