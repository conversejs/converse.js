/*
 * This file specifies the language dependencies.
 *
 * Translations take up a lot of space and you are therefore advised to remove
 * from here any languages that you don't need.
 *
 * See also src/moment_locales.js
 */
(function (root, factory) {
    define("locales", ['jed',
        'text!af',
        'text!ca',
        'text!de',
        'text!en',
        'text!es',
        'text!fr',
        'text!he',
        'text!hu',
        'text!id',
        'text!it',
        'text!ja',
        'text!nb',
        'text!nl',
        'text!pl',
        'text!pt_BR',
        'text!ru',
        'text!uk',
        'text!zh'
        ], function ($, Jed) {
            root.locales = {
                'af':     arguments[1],
                'ca':     arguments[2],
                'de':     arguments[3],
                'en':     arguments[4],
                'es':     arguments[5],
                'fr':     arguments[6],
                'he':     arguments[7],
                'hu':     arguments[8],
                'id':     arguments[9],
                'it':     arguments[10],
                'ja':     arguments[11],
                'nb':     arguments[12],
                'nl':     arguments[13],
                'pl':     arguments[14],
                'pt-br':  arguments[15],
                'ru':     arguments[16],
                'uk':     arguments[17],
                'zh':     arguments[18]
            };
            return root.locales;
        });
})(this);
