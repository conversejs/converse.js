define("converse-dependencies", [
    "jquery",
    "underscore",
    "utils",
    "otr",
    "moment",
    "strophe",
    "strophe.vcard",
    "strophe.disco",
	"strophe.ping",
    "bootstrapJS", // XXX: Only for https://conversejs.org
    "backbone.browserStorage",
    "backbone.overview",
    "jquery.browser",
    "jquery.easing", // XXX: Only for https://conversejs.org
    "typeahead"
], function($, _, utils, otr, moment, Strophe) {
    return _.extend({
        'underscore': _,
        'jQuery': $,
        'otr': otr,
        'moment': moment,
        'utils': utils
    }, Strophe);
});
