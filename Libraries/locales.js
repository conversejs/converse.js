(function (root, factory) {
    define("locales", [
        'jed',
        'af',
        'en'
        ], function (jed, af, en) {
            root.locales = {};
            root.locales.af = af;
            root.locales.en = en;
        });
})(this);
