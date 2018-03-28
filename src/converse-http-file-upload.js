(function (root, factory) {
    define(["converse-http-file-upload"], factory);
}(this, function (converse) {
    "use strict";

    converse.plugins.add('converse-http-file-upload', {

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this;

        }
    });
}));
