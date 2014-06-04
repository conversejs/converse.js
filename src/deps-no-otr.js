define("converse-dependencies", [
    "moment",
    "locales",
    "backbone.localStorage",
    "backbone.overview",
    "jquery.tinysort",
    "jquery.browser",
    "strophe",
    "strophe.muc",
    "strophe.roster",
    "strophe.vcard",
    "strophe.disco"
], function(moment) {
    return {
        'otr': undefined,
        'moment': moment
    };
});
