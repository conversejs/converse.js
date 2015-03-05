define("converse-dependencies", [
    "jquery",
    "utils",
    "otr",
    "moment",
    "strophe",
    "strophe.roster",
    "strophe.vcard",
    "strophe.disco",
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "typeahead"
], function($, utils, otr, moment, Strophe) {
    return _.extend({
        'underscore': _,
        'jQuery': $,
        'otr': otr,
        'moment': moment,
        'utils': utils
    }, Strophe);
});
