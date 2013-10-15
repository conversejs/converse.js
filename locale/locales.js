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
            "hu": "locale/hu/LC_MESSAGES/hu",
            "it": "locale/it/LC_MESSAGES/it",
            "nl": "locale/nl/LC_MESSAGES/nl",
            "pt_BR": "locale/pt_BR/LC_MESSAGES/pt_BR",
            "ru": "locale/ru/LC_MESSAGES/ru"
        }
    });

    define("locales", [
        'jed',
        'af',
        'de',
        'en',
        'es',
        'fr',
        'hu',
        'it',
        'nl',
        'pt_BR',
        'ru'
        ], function (jed, af, de, en, es, fr, hu, it, nl, pt_BR, ru) {
            root.locales = {
                'af': af,
                'de': de,
                'en': en,
                'es': es,
                'fr': fr,
                'hu': hu,
                'it': it,
                'nl': nl,
                'pt-br': pt_BR,
                'ru': ru
            };
        });
})(this);
