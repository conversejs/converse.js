({
    baseUrl: "../",
    name: "components/almond/almond.js",
    out: "../builds/converse.nojquery.min.js",
    include: ['main'],
    mainConfigFile: '../main.js',
    paths: {
        "jquery":                   "src/jquery-external",
        "jquery-private":           "src/jquery-private-external",
    }
})
