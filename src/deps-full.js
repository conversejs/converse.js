define("converse-dependencies", [
    "jquery",
    "utils",
    "otr",
    "moment",
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "typeahead",
    "strophe",
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
