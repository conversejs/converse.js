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
            "he": "locale/he/LC_MESSAGES/he",
            "hu": "locale/hu/LC_MESSAGES/hu",
            "id": "locale/id/LC_MESSAGES/id",
            "it": "locale/it/LC_MESSAGES/it",
            "ja": "locale/ja/LC_MESSAGES/ja",
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
        'he',
        'hu',
        'id',
        'it',
        'ja',
        'nl',
        'pt_BR',
        'ru'
        ], function (jed, af, de, en, es, fr, he, hu, id, it, ja, nl, pt_BR, ru) {
            root.locales = {
                'af': af,
                'de': de,
                'en': en,
                'es': es,
                'fr': fr,
                'he': he,
                'hu': hu,
                'id': id,
                'it': it,
                'ja': ja,
                'nl': nl,
                'pt-br': pt_BR,
                'ru': ru
            };
        });
})(this);
