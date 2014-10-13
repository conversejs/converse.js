define("converse-dependencies", [
    "jquery",
    "utils",
    "otr",
    "moment",
    "locales",
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "typeahead",
    "strophe",
    "strophe.muc",
    "strophe.roster",
    "strophe.vcard",
    "strophe.disco"
], function($, utils, otr, moment) {
    return {
        'jQuery': $,
        'moment': moment,
        'otr': otr,
        'utils': utils
    };
});
