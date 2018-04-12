/**
 * Adds Support for Http File Upload (XEP-0363)
 *
 * @see {@link http://xmpp.org/extensions/xep-0363.html}
 */
(function (root, factory) {
    define([
        "converse-core",
        "tpl!toolbar_fileupload"
    ], factory);
}(this, function (
        converse,
        tpl_toolbar_fileupload
    ) {
    "use strict";
    const { $msg, Backbone, Strophe, _, b64_sha1, moment, utils } = converse.env;
    Strophe.addNamespace('HTTPUPLOAD', 'urn:xmpp:http:upload');

    converse.plugins.add('converse-http-file-upload', {

        dependencies: ["converse-chatboxes", "converse-chatview", "converse-muc-views"],

        overrides: {
            ChatBoxView:  {

                events: {
                    'click .toggle-fileUpload': 'toggleFileUpload',
                    'change .fileUpload_input': 'handleFileSelect'
                },

                addFileUploadButton (options) {
                    const { __ } = this.__super__._converse;
                    this.el.querySelector('.chat-toolbar').insertAdjacentHTML(
                        'beforeend',
                        tpl_toolbar_fileupload({'label_upload_file': __('Choose a file to send')}));
                },

                renderToolbar (toolbar, options) {
                    const { _converse } = this.__super__;
                    const result = this.__super__.renderToolbar.apply(this, arguments);
                    _converse.api.disco.supports(Strophe.NS.HTTPUPLOAD, 'upload.' + _converse.domain)
                        .then((result) => {
                            if (result.supported) {
                                this.addFileUploadButton();
                            }
                        });
                    return result;
                },

                toggleFileUpload (ev) {
                    this.el.querySelector('.fileUpload_input').click();
                },

                handleFileSelect (evt) {
                    var files = evt.target.files;
                    var file = files[0];
                    this.model.sendFile(file, this);
                }
            },

            ChatRoomView: {
                events: {
                    'click .toggle-fileUpload': 'toggleFileUpload',
                    'change .fileUpload_input': 'handleFileSelect',
                }
            }
        },

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                { __ } = _converse;
        }
    });
    
    return converse;
}));
