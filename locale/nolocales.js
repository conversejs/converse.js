/*
 * This file can be used if no locale support is required.
 */
(function (root, factory) {
    define("locales", [
            'jed',
            "locale/en/LC_MESSAGES/en"
        ], function (jed, en) {
            root.locales = { 'en': en };
    });
})(this);
