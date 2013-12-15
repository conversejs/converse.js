define("converse-dependencies", [
    "otr",
    "locales",
    "backbone.localStorage",
    "jquery.eventemitter",
    "jquery.tinysort",
    "strophe",
    "strophe.muc",
    "strophe.roster",
    "strophe.vcard",
    "strophe.disco"
], function(otr) {
    return otr;
});
