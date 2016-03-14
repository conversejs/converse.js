// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define("converse-headline", [
            "converse-core",
            "converse-api",
            // TODO: remove this dependency
            "converse-chatview"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";

    converse_api.plugins.add('headline', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            // TODO
        }
    });
}));
