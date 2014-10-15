define("converse-dependencies", [
    "jquery",
    "utils",
    "moment",
    "locales",
    "bootstrapJS", // XXX: Can be removed, only for https://conversejs.org
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "jquery.easing", // XXX: Can be removed, only for https://conversejs.org
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
