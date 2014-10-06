define("converse-dependencies", [
    "jquery",
    "otr",
    "moment",
    "locales",
    "bootstrap", // XXX: Only for https://conversejs.org
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "jquery.easing", // XXX: Only for https://conversejs.org
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
