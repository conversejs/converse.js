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
            "de": "locale/de/LC_MESSAGES/de",
            "en": "locale/en/LC_MESSAGES/en",
            "es": "locale/es/LC_MESSAGES/es",
            "fr": "locale/fr/LC_MESSAGES/fr",
            "it": "locale/it/LC_MESSAGES/it",
            "pt_BR": "locale/pt_BR/LC_MESSAGES/pt_BR"
        }
    });

    define("locales", [
        'jed',
        'af',
        'de',
        'en',
        'es',
        'fr',
        'it',
        'pt_BR'
        ], function (jed, af, de, en, es, fr, it, pt_BR) {
            root.locales = {
                'af': af,
                'de': de,
                'en': en,
                'es': es,
                'fr': fr,
                'it': it,
                'pt-br': pt_BR
            };
        });
})(this);
