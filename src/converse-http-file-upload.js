(function (root, factory) {
    define([
        "converse-core",
        "tpl!toolbar_fileupload"
    ], factory);
}(this, function (converse, tpl_toolbar_fileupload) {
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
                    const { __ } = this.__super__._converse;
                    this.el.querySelector('.chat-toolbar').insertAdjacentHTML(
                        'beforeend',
                        tpl_toolbar_fileupload({'tooltip_upload_file': __('Choose a file to send')}));
                },

                renderToolbar (toolbar, options) {
                    const { _converse } = this.__super__;
                    const result = this.__super__.renderToolbar.apply(this, arguments);
                    _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, _converse.domain)
                        .then((result) => {
                            if (result.length) {
                                this.addFileUploadButton();
                            }
                        });
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
