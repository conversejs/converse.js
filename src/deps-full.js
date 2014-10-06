define("converse-dependencies", [
    "jquery",
    "otr",
    "moment",
    "locales",
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "typeahead",
    "utils",
    "strophe",
    "strophe.muc",
    "strophe.roster",
    "strophe.vcard",
    "strophe.disco"
], function($, otr, moment) {
    return {
        'jQuery': $,
        'otr': otr,
        'moment': moment
    };
});
