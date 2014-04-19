define("converse-dependencies", [
    "otr",
    "moment",
    "locales",
    "backbone.localStorage",
    "jquery.tinysort",
    "jquery.browser",
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
