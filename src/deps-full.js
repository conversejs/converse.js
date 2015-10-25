define("converse-dependencies", [
    "jquery",
    "underscore",
    "polyfill",
    "utils",
    "otr",
    "moment_with_locales",
    "strophe",
    "strophe.disco",
    "strophe.ping",
    "strophe.rsm",
    "strophe.vcard",
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "typeahead"
], function($, _, dummy, utils, otr, moment, Strophe) {
    return _.extend({
        'underscore': _,
        'jQuery': $,
        'otr': otr,
        'moment': moment,
        'utils': utils
    }, Strophe);
});
