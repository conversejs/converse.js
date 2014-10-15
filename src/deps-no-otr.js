define("converse-dependencies", [
    "jquery",
    "utils",
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
], function($, utils, moment) {
    return {
        'jQuery': $,
        'otr': undefined,
        'moment': moment,
        'utils': utils
    };
});
