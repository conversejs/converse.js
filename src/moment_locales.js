/*
 * This file specifies the supported locales for moment.js.
 *
 * Translations take up a lot of space and you are therefore advised to remove
 * from here any languages that you don't need.
 *
 * See also src/locales.js
 */
(function (root, factory) {
    define("moment_with_locales", [
        'moment',   // Everything below can be removed except for moment itself.
        'moment_af',
        'moment_de',
        'moment_es',
        'moment_fr',
        'moment_he',
        'moment_hu',
        'moment_id',
        'moment_it',
        'moment_ja',
        'moment_nb',
        'moment_nl',
        'moment_pl',
        'moment_pt-br',
        'moment_ru',
        'moment_uk',
        'moment_zh'
        ], function (moment) {
            return moment;
        });
})(this);
