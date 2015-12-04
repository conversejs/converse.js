define("converse-dependencies", [
    "jquery",
    "underscore",
    "polyfill",
    "utils",
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
], function($, _, dummy, utils, moment, Strophe) {
    return _.extend({
        'underscore': _,
        'jQuery': $,
        'otr': undefined,
        'moment': moment,
        'utils': utils
    }, Strophe);
});
