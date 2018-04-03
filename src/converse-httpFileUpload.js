/*
    The MIT License (MIT)

    Copyright (c) 2014 Klaus Herberth <klaus@jsxc.org>

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
*/

/**
 * Implements Http File Upload (XEP-0363)
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

    var requestSlotUrl; 
    var ready;
    var httpUploadOption = {
        enable: true
    }

    converse.plugins.add('converse-httpFileUpload', {

        dependencies: ["converse-chatboxes", "converse-disco"],

        initialize() {
            const { _converse } = this,
                { __ } = _converse;
            var connection = _converse.connection;
            var domain;
            var file;
            var chatBox;
            
            _converse.FileUpload = Backbone.NativeView.extend({
                /**
                * Set up http file upload.
                * 
                * @param {*} connection the current strophe-connection
                */
                initFiletransfer () {
                    connection = _converse.connection;
                    domain = _converse.connection.domain; 

                    if (httpUploadOption && requestSlotUrl != undefined) {
                        ready = true;
                        return;
                    }
                    this.discoverUploadService();
                },
                
                /**
                * Discover upload service for http upload.
                *
                */
                discoverUploadService () {
                    var self = this;
                    console.log('discover http upload service');
                    connection.disco.items(domain, null, function(items) {
                        var childs = items.getElementsByTagName('item');
                        for(var i = 0; i < childs.length; i++){
                            var jid = childs[i].attributes.jid.value; 
                            if (ready) {
                                // abort, because we already found a service
                                return false;
                            }
                            self.queryItemForUploadService(jid);
                        }
                    });
                },
                
                /**
                 * Query item for upload service.
                 *
                 * @param {String} jid of the logged-in user
                 * @param {Function} cb Callback on success
                */
                queryItemForUploadService (jid) {
                    var self = this;
                    console.log('query ' + jid + ' for upload service');
                
                    connection.disco.info(jid, null, function(info) {
                        var httpUploadFeature;
                        var temp = info.getElementsByTagName('feature');
                        for(var i = 0; i < temp.length; i++){
                            var feature = temp[i].attributes.var;
                            if(feature != undefined && feature.value === Strophe.NS.HTTPUPLOAD){
                                requestSlotUrl = jid;
                                ready = true;
                                self.sendFile();
                            }
                        }
                    });
                },

                /**
                 * Saves the file the user has picked.
                 * 
                 * @param {*} file the name of the file the user has picked.
                 * @param {*} chatBox the chatbox from which the user initiated the file-upload
                 */
                setFile (file1, chatBox1){
                    file = file1;
                    chatBox = chatBox1;
                    this.sendFile();
                },
                
                /**
                * Upload file.
                * Waits till the Upload-Service is discovered and till the user has picked a file.
                *
                */
                sendFile () {
                    var self = this;
                    if(file === undefined){
                        console.log("waiting to choose a file");
                        return;
                    }
                    else if(requestSlotUrl === undefined){
                        console.log("waiting for service discovery");
                        return;
                    }

                    console.log('Send file via http upload');
                    chatBox.showHelpMessages([__('The file upload starts now')],'info');
                    this.requestSlot(file, function(data) {
                        if (!data) {
                            // general error
                            console.log('Unknown error while requesting upload slot.');
                            alert(__('File upload failed. Please check the log.'));
                        } else if (data.error) {
                            // specific error
                            console.log('The XMPP-Server return an error of the type: ' + data.error.type);
                            alert(__('File upload failed. Please check the log.'));
                        } else if (data.get && data.put) {
                            console.log('slot received, start upload to ' + data.put);
                            self.uploadFile(data.put, file, function() {
                                console.log(data.put);
                                
                                chatBox.onMessageSubmitted(data.put, null, file);
                                file = undefined;
                            });
                        }
                    });
                },

                /**
                * Request upload slot from xmpp-server
                *
                * @param  {File} file the file the user picked
                * @param  {Function} cb Callback after finished request
                */
                requestSlot (file, cb) {
                    var self = this;
                    console.log("try sending file to: " + requestSlotUrl);
                    var iq = converse.env.$iq({
                        to: requestSlotUrl,
                        type: 'get'
                    }).c('request', {
                        xmlns: Strophe.NS.HTTPUPLOAD
                    }).c('filename').t(file.name)
                    .up()
                    .c('size').t(file.size);
                
                    connection.sendIQ(iq, function(stanza) {
                        self.successfulRequestSlotCB(stanza, cb);
                    }, function(stanza) {
                        self.failedRequestSlotCB(stanza, cb);
                    });
                },
                
                /**
                 * Upload the given file to the given url.
                *
                * @param  {String} url upload url
                * @param  {File} file the file the user picked
                * @param  {Function} success_cb callback on successful transition
                */
                uploadFile (url, file, success_cb) {
                    console.log("uploadFile start");
                    var xmlhttp = new XMLHttpRequest();
                    var type = 'PUT';
                    var contentType = 'application/octet-stream';
                    var data = file;
                    var processData = false;
                    xmlhttp.onreadystatechange = function() {
                        if (xmlhttp.readyState == XMLHttpRequest.DONE) {   
                            console.log("Status: " + xmlhttp.status);
                            if (xmlhttp.status == 200 || xmlhttp.status == 201) {
                                console.log('file successful uploaded');
                                if (success_cb) {
                                    success_cb();
                                }    
                            }
                            else {
                                console.log('error while uploading file to ' + url);
                                alert(__('Could not upload File please try again.'));
                            }
                        }
                    };
                
                    xmlhttp.open(type, url, true);
                    xmlhttp.setRequestHeader("Content-type", contentType);
                    xmlhttp.send(data);

                    console.log("uploadFile end");
                },
                
                /**
                * Process successful response to slot request.
                *
                * @param {String} stanza
                * @param {Function} cb
                */
                successfulRequestSlotCB (stanza, cb) {
                    var slot = stanza.getElementsByTagName('slot')[0];
                
                    if (slot != undefined) {
                        var put = slot.getElementsByTagName('put')[0].textContent;
                        var get = slot.getElementsByTagName('get')[0].textContent;
                        cb({
                            put: put,
                            get: get
                        });
                    } else {
                        this.failedRequestSlotCB(stanza, cb);
                    }
                },
                
                /**
                * Process failed response to slot request.
                *
                * @param  {String} stanza
                * @param  {Function} cb
                */
                failedRequestSlotCB (stanza, cb) {
                    chatBox.showHelpMessages([__('Fileupload failed')],'info');
                }
            })
        }
    });
    
    return converse;
}));