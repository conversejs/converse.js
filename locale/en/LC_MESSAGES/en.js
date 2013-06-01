(function (root, factory) {
    define("en", ['jed'], function () {
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
        return factory(en);
    });
}(this, function (en) { 
    return en;
}));
