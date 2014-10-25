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
    "components/strophejs-plugins/vcard/strophe.vcard",
    "components/strophejs-plugins/disco/strophe.disco"
], function($, utils, otr, moment) {
    return {
        'jQuery': $,
        'moment': moment,
        'otr': otr,
        'utils': utils
    };
});
