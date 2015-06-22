define("converse-dependencies", [
    "jquery",
    "utils",
    "otr",
    "moment_with_locales",
    "strophe",
    "strophe.vcard",
    "strophe.disco",
    "strophe.ping",
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
