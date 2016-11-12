({
    baseUrl: "../",
    name: "almond",
    out: "../dist/converse-mobile.min.js",
    mainConfigFile: '../config.js',
    excludeShallow: [
        "converse-minimize",
        "converse-dragresize"
    ],
    include: ['converse'],
    insertRequire: ['converse'],
    wrap: {
        endFile: ["wrapper-mobile.js"]
    },
})
