/*
 * This file specifies the language dependencies.
 *
 * Translations take up a lot of space and you are therefore advised to remove
 * from here any languages that you don't need.
 */

(function (root, factory) {
    require.config({
        paths: {
            "jed": "components/jed/jed",
            "af": "locale/af/LC_MESSAGES/af",
            "en": "locale/en/LC_MESSAGES/en",
            "es": "locale/es/LC_MESSAGES/es",
            "de": "locale/de/LC_MESSAGES/de",
            "it": "locale/it/LC_MESSAGES/it",
            "pt_BR": "locale/pt_BR/LC_MESSAGES/pt_BR"
        }
    });

    define("locales", [
        'jed',
        'af',
        'en',
        'es',
        'de',
        "it",
        "pt_BR"
        ], function (jed, af, en, es, de, it, pt_BR) {
            root.locales = {};
            root.locales.af = af;
            root.locales.en = en;
            root.locales.es = es;
            root.locales.de = de;
            root.locales.it = it;
            root.locales.pt_BR = pt_BR;
        });
})(this);
