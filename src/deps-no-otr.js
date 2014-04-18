define("converse-dependencies", [
    "moment",
    "locales",
    "backbone.localStorage",
    "jquery.tinysort",
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
