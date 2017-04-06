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
        'moment/locale/af',
        'moment/locale/de',
        'moment/locale/es',
        'moment/locale/fr',
        'moment/locale/he',
        'moment/locale/hu',
        'moment/locale/id',
        'moment/locale/it',
        'moment/locale/ja',
        'moment/locale/nb',
        'moment/locale/nl',
        'moment/locale/pl',
        'moment/locale/pt-br',
        'moment/locale/ru',
        'moment/locale/uk',
        // 'moment/locale/zh' (No longer in locales, now only with
        // country codes, e.g. zh-cn.js zh-hk.js zh-tw.js).
        ], function (moment) {
            return moment;
        });
})(this);
