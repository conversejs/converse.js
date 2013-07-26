(function (root, factory) {
    var en = new Jed({
        "domain": "converse",
        "locale_data": {
            "converse": {
                "": {
                    "domain": "converse",
                    "lang": "en",
                    "plural_forms": "nplurals=2; plural=(n != 1);"
                }
            }
        }
    });
    if (typeof define === 'function' && define.amd) {
        define("en", ['jed'], function () {
            return factory(en);
        });
    } else {
        if (!window.locales) {
            window.locales = {};
        }
        window.locales.en = en;
    }
}(this, function (en) { 
    return en;
}));
