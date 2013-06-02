(function (root, factory) {
    require.config({
        paths: {
            "jed": "Libraries/jed",
            "af": "locale/af/LC_MESSAGES/af",
            "en": "locale/en/LC_MESSAGES/en",
            "de": "locale/de/LC_MESSAGES/de"
        }
    });

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
