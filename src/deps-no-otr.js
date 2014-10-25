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
    "components/strophejs-plugins/vcard/strophe.vcard",
    "components/strophejs-plugins/disco/strophe.disco"
], function($, utils, moment) {
    return {
        'jQuery': $,
        'otr': undefined,
        'moment': moment,
        'utils': utils
    };
});
