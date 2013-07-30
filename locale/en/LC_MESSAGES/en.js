(function (root, factory) {
    var translations = {
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
    };
    if (typeof define === 'function' && define.amd) {
        define("en", ['jed'], function () {
            return factory(new Jed(translations));
        });
    } else {
        if (!window.locales) {
            window.locales = {};
        }
        window.locales.en = factory(new Jed(translations));
    }
}(this, function (en) { 
    return en;
}));
