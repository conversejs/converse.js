define("converse-dependencies", [
    "otr",
    "moment",
    "locales",
    "bootstrap",
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.tinysort",
    "jquery.browser",
    "jquery.easing",
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
