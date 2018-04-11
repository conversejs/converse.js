/**
 * Adds Support for Http File Upload (XEP-0363)
 *
 * @see {@link http://xmpp.org/extensions/xep-0363.html}
 */
(function (root, factory) {
    define([
        "converse-core",
    ], factory);
}(this, function (
        converse
    ) {
    "use strict";
    const { $msg, Backbone, Strophe, _, b64_sha1, moment, utils } = converse.env;
    Strophe.addNamespace('HTTPUPLOAD', 'urn:xmpp:http:upload');

    converse.plugins.add('converse-http-file-upload', {

        dependencies: ["converse-chatboxes", "converse-chatview"],

        initialize () {
            const { _converse } = this,
                { __ } = _converse;
            
            _converse.FileUpload = Backbone.NativeView.extend({       
                /**
                * Request upload slot from xmpp-server
                */
                
            })
        }
    });
    
    return converse;
}));
