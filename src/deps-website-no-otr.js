define("converse-dependencies", [
    "jquery",
    "utils",
    "moment_with_locales",
    "strophe",
    "strophe.vcard",
    "strophe.disco",
    "strophe.ping",
    "bootstrapJS", // XXX: Can be removed, only for https://conversejs.org
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "jquery.easing", // XXX: Can be removed, only for https://conversejs.org
    "typeahead"
], function($, utils, moment, Strophe) {
    return _.extend({
        'underscore': _,
        'jQuery': $,
        'otr': otr,
        'moment': moment,
        'utils': utils
    }, Strophe);
});
