define("converse-dependencies", [
    "jquery",
    "utils",
    "otr",
    "moment",
    "locales",
    "bootstrapJS", // XXX: Only for https://conversejs.org
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "jquery.easing", // XXX: Only for https://conversejs.org
    "typeahead",
    "strophe",
    "strophe.muc",
    "strophe.roster",
    "strophe.vcard",
    "strophe.disco"
], function($, utils, otr, moment) {
    return {
        'jQuery': $,
        'otr': otr,
        'moment': moment,
        'utils': utils
    };
});
