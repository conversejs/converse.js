/*
 * This file specifies the language dependencies.
 *
 * Translations take up a lot of space and you are therefore advised to remove
 * from here any languages that you don't need.
 *
 * See also src/moment_locales.js
 */
/*global define */
(function (root, factory) {
    define(['jed',
        'text!af',
        'text!ca',
        'text!de',
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
                'en':     {},
                'af':     arguments[1],
                'ca':     arguments[2],
                'de':     arguments[3],
                'es':     arguments[4],
                'fr':     arguments[5],
                'he':     arguments[6],
                'hu':     arguments[7],
                'id':     arguments[8],
                'it':     arguments[9],
                'ja':     arguments[10],
                'nb':     arguments[11],
                'nl':     arguments[12],
                'pl':     arguments[13],
                'pt-br':  arguments[14],
                'ru':     arguments[15],
                'uk':     arguments[16],
                'zh':     arguments[17]
            };
            return root.locales;
        });
})(this);
