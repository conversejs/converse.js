({
    baseUrl: "../",
    name: "components/almond/almond.js",
    out: "../builds/converse.nojquery.min.js",
    include: ['main'],
    tpl: {
        // Use Mustache style syntax for variable interpolation
        templateSettings: {
            evaluate : /\{\[([\s\S]+?)\]\}/g,
            interpolate : /\{\{([\s\S]+?)\}\}/g
        }
    },
    mainConfigFile: '../main.js',
    paths: {
        "converse-dependencies":    "src/deps-full",
        "jquery":                   "src/jquery-external"
    }
})
