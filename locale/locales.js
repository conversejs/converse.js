(function (root, factory) {
    require.config({
        paths: {
            "jed": "Libraries/jed",
            "af": "locale/af/LC_MESSAGES/af",
            "en": "locale/en/LC_MESSAGES/en",
            "de": "locale/de/LC_MESSAGES/de",
            "hu": "locale/hu/LC_MESSAGES/hu",
            "ptbr": "locale/pt_BR/LC_MESSAGES/pt-br"
        }
    });

    define("locales", [
        'jed',
        'af',
        'en',
        'de',
        'hu',
        'ptbr'
        ], function (jed, af, en, de, hu, ptbr) {
            root.locales = {};
            root.locales.af = af;
            root.locales.en = en;
            root.locales.de = de;
            root.locales.hu = hu;
            root.locales.ptbr = ptbr;
        });
})(this);
