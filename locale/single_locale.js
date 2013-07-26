/*
 * This file specifies a single language dependency (for English).
 *
 * Translations take up a lot of space and you are therefore advised to remove
 * from here any languages that you don't need.
 */

(function (root, factory) {
    require.config({
        paths: {
            "jed": "Libraries/jed",
            "en": "locale/en/LC_MESSAGES/en"
        }
    });

    define("locales", [
        'jed',
        'en'
        ], function (jed, en) {
            root.locales = {};
            root.locales.en = en;
        });
})(this);
