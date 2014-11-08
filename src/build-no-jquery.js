({
    baseUrl: "../",
    name: "components/almond/almond.js",
    out: "../builds/converse.nojquery.min.js",
    include: ['main'],
    mainConfigFile: '../main.js',
    paths: {
        "converse-dependencies":    "src/deps-full",
        "jquery":                   "src/jquery-external",
        "jquery-private":           "src/jquery-private-external",
    }
})
