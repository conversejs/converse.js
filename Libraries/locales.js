(function (root, factory) {
    define("locales", [
        'jed',
        'af',
        'en',
        'de'
        ], function (jed, af, en, de) {
            root.locales = {};
            root.locales.af = af;
            root.locales.en = en;
            root.locales.de = de;
        });
})(this);
