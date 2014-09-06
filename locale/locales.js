/*
 * This file specifies the language dependencies.
 *
 * Translations take up a lot of space and you are therefore advised to remove
 * from here any languages that you don't need.
 */

(function (root, factory) {
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
        'ru',
        'zh'
        ], function (jed, af, de, en, es, fr, he, hu, id, it, ja, nl, pt_BR, ru, zh) {
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
                'ru': ru,
                'zh':zh
            };
        });
})(this);
