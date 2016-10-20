({
    baseUrl: "../",
    name: "almond",
    out: "../dist/converse-mobile.min.js",
    mainConfigFile: '../config.js',
    excludeShallow: [
        "converse-minimize",
        "converse-dragresize"
    ],
    include: ['src/converse'],
    insertRequire: ['converse'],
    wrap: {
        endFile: ["wrapper-mobile.js"]
    },
})
