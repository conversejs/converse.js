define("converse-dependencies", [
    "otr",
    "moment",
    "locales",
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "jquery.fastLiveFilter",
    "strophe",
    "strophe.muc",
    "strophe.roster",
    "strophe.vcard",
    "strophe.disco"
], function(otr, moment) {
    return {
        'otr': otr,
        'moment': moment
    };
});
