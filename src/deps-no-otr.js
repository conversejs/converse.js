define("converse-dependencies", [
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
], function(moment) {
    return {
        'otr': undefined,
        'moment': moment
    };
});
