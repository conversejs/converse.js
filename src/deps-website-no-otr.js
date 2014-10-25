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
