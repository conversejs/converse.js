(function (root, factory) {
    define(["converse-core"], factory);
}(this, function (converse) {
    "use strict";

    const { Promise, Strophe, _ } = converse.env;
    const u = converse.env.utils;

    Strophe.addNamespace('HTTPUPLOAD', 'urn:xmpp:http:upload:0');

    converse.plugins.add('converse-http-file-upload', {
        /* Plugin dependencies are other plugins which might be
         * overridden or relied upon, and therefore need to be loaded before
         * this plugin.
         *
         * If the setting "strict_plugin_dependencies" is set to true,
         * an error will be raised if the plugin is not found. By default it's
         * false, which means these plugins are only loaded opportunistically.
         *
         * NB: These plugins need to have already been loaded via require.js.
         */
        dependencies: ["converse-chatview"],

        overrides: {

            ChatBoxView:  {
                addFileUploadButton (options) {
                },

                renderToolbar (toolbar, options) {
                    const { _converse } = this.__super__;
                    const result = this.__super__.renderToolbar.apply(this, arguments);
                    // TODO: check results.length
                    _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain)
                        .then(this.addFileUploadButton.bind(this));
                    return result;
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this;
        }
    });
}));
