define("converse-dependencies", [
    "jquery",
    "utils",
    "moment",
    "strophe",
    "strophe.vcard",
    "strophe.disco",
    "strophe.ping",
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "typeahead"
], function($, utils, moment, Strophe) {
    return _.extend({
        'underscore': _,
        'jQuery': $,
        'otr': undefined,
        'moment': moment,
        'utils': utils
    }, Strophe);
});
