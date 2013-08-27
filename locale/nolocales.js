/*
 * This file can be used if no locale support is required.
 */
(function (root, factory) {
    define("locales", ['jed'], function (jed) {
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
        root.locales = { 'en': factory(new Jed(translations)) };
    });
})(this);
