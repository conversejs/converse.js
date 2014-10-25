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
    "components/strophejs-plugins/vcard/strophe.vcard",
    "components/strophejs-plugins/disco/strophe.disco"
], function($, utils, otr, moment) {
    return {
        'jQuery': $,
        'otr': otr,
        'moment': moment,
        'utils': utils
    };
});
