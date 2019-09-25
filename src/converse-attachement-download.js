// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//

import converse from "@converse/headless/converse-core";
import dayjs from "dayjs";
import jszip from "jszip";
import jszip_utils from "jszip_utils";
import { saveAs } from 'file-saver';
import tpl_download_dialog from "templates/download_dialog.html";
import tpl_download_in_progress from "templates/download_in_progress.html";
import tpl_download_table_row from "templates/download_table_row.html";

const { Backbone, Promise, _, utils } = converse.env;

const URL_REGEX = /\b(https?\:\/\/|www\.|https?:\/\/www\.)[^\s<>]{2,200}\b\/?/g;

converse.plugins.add('converse-attachement-download', {
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
    dependencies: ["converse-chatboxes", "converse-disco", "converse-chatview", "converse-muc-views"],

    overrides: {
        ChatBoxView: {
            events: {
                'click .toggle-download': 'downloadAttachements',
            },

            getToolbarOptions () {
                const { _converse } = this.__super__,
                    { __ } = _converse;

                return Object.assign(
                    this.__super__.getToolbarOptions.apply(this, arguments),
                    {
                      'label_file_download': __('Start Download-Dialog'),
                      'show_download_button': _converse.visible_toolbar_buttons.download
                    }
                );
            }
        },

        ChatRoomView: {
            events: {
                'click .toggle-download': 'downloadAttachements',
            },
        },

        MessageView: {
            async renderChatMessage () {
                await this.__super__.renderChatMessage.apply(this, arguments);

                // don't know why this.model works two lines above but not now (sometimes)
                const { _converse } = this.__super__;
                if(!_.isNil(this.model)) {
                    var tMessage = this.model.attributes.message;
                    var forwarded_message = this.model.attributes.original_message;

                    _converse.allowed_download_servers.forEach(server => {
                        // find all downloadable elements inside normal chat-messages
                        if (URL_REGEX.test(tMessage) && tMessage.includes(server) === true) {
                            this.model.set({
                                downloadable: true
                            }, {silent: true});
                        }
                        // find all downloadable elements inside forwarded chat-messages
                        if (URL_REGEX.test(forwarded_message) && forwarded_message.includes(server) === true) {
                            this.model.set({
                                downloadable_forwarded_message: true
                            }, {silent: true});
                        }
                    });
                }
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
            * loaded by converse.js's plugin machinery.
            */
        const { _converse } = this,
            { __ } = _converse;

        _converse.api.settings.update({
            'allowed_download_servers': [], // list for addresses that are considered inside the download-dialog
            'visible_toolbar_buttons': {
                'download': true
            }
        });
        
        const DOWNLOAD_DIALOG = {
            downloadAttachements () {
                var downloadable = this.model.messages.filter(function(message) { 
                    return message.get('downloadable') || message.get('downloadable_forwarded_message')
                });
                if (downloadable.length === 0) {
                    this.showHelpMessages([__('There are no files to download.')], 'error');
                    return;
                }

                const chat_name = this.model.attributes.name === undefined ? this.model.attributes.user_id : this.model.attributes.name;
                _converse.multimediaDownloadModel = new _converse.MultimediaDownloadModel(downloadable, chat_name);
                _converse.multimediaDownloadModel.downloadAttachements();
            }
        };
        Object.assign(_converse.ChatBoxView.prototype, DOWNLOAD_DIALOG);

        _converse.MultimediaFile = Backbone.Model.extend({ });

        _converse.MultimediaFileView = Backbone.NativeView.extend({
            tagName: 'tr',
            events: {
                'click .checkbox-for-download': 'checkboxClicked',
                'change .download-file-input': 'updateFilename'
            },

            initialize (options) {
                this.error_msg = options.error_msg;
            },

            render () {
                var checked;
                if (this.model.attributes.checked) {
                    checked = "checked";
                } else {
                    checked = "";
                }

                var columns = tpl_download_table_row({
                    'checked': checked,
                    'timestamp': this.model.attributes.timestamp,
                    'author': this.model.attributes.author,
                    'link': this.model.attributes.link,
                    'filename': this.model.attributes.filename,
                    'type': this.model.attributes.type
                });
                this.el.innerHTML = columns;
                return this.el;
            },

            checkboxClicked () {
                this.model.attributes.checked = !this.model.attributes.checked;
            },

            updateFilename () {
                var filename = this.el.querySelector('.download-file-input').value;
                if (!(/^[0-9a-zäöüßA-ZÄÖÜ_\-. ]+$/).test(filename)) {
                    this.error_msg.updateError(__("The Filename ") + filename + __(" is invalid. Recovering last valid Filename."));
                    this.el.querySelector('.download-file-input').value = this.model.attributes.filename;
                    return;
                } else {
                    this.error_msg.updateError();
                    this.model.attributes.filename = this.el.querySelector('.download-file-input').value;
                }
            }
        });

        _converse.MultimediaFileCollection = Backbone.Collection.extend({ });

        _converse.MultimediaDownloadModel = Backbone.Model.extend({
            
            initialize (downloadable_files, chat_name) {
                this.downloadable = downloadable_files;
                this.chat_name = chat_name;
            },

            downloadAttachements () {
                _converse.multimedia_files_from_chat = new _converse.MultimediaFileCollection();
                this.downloadable.forEach((message) => {
                    let model;
                    if (message.get('downloadable_forwarded_message')) {
                        model = this.getModelFromForwardedChatMessage(message);
                    } else {
                        model = this.getModelFromNormalChatMessage(message);
                    }
                    _converse.multimedia_files_from_chat.add(model);
                });

                // remove old download-dialog if still present
                var download_dialog_element = document.body.querySelector('.download-popup');
                if (!_.isNil(download_dialog_element)) {
                    download_dialog_element.parentElement.removeChild(download_dialog_element); 
                }

                var download_window = new _converse.MultimediaDownloadView({collection: _converse.multimedia_files_from_chat, chat_name_string: this.chat_name});
                document.body.querySelector('#conversejs').insertAdjacentElement('beforeend', download_window.render());
                download_window.show();
            },

            getModelFromNormalChatMessage (message_model) {
                return new _converse.MultimediaFile({
                    author: message_model.get('from'),
                    link: message_model.get('message'),
                    timestamp: dayjs(message_model.get('time')).format('YYYYMMDD_HHmm'),
                    filename: this.generateFilename(message_model.get('message'), message_model.get('time')),
                    default_name: this.generateFilename(message_model.get('message')),
                    type: this.getFileType(message_model.get('message')),
                    checked: true
                });
            },

            getModelFromForwardedChatMessage (message_model) {
                return new _converse.MultimediaFile({
                    author: message_model.get('sender'),
                    link: message_model.get('original_message'),
                    timestamp: dayjs(message_model.get('time')).format('YYYYMMDD_HHmm'),
                    filename: this.generateFilename(message_model.get('original_message'), message_model.get('time')),
                    default_name: this.generateFilename(message_model.get('original_message')),
                    type: this.getFileType(message_model.get('original_message')),
                    checked: true
                });
            },

            generateFilename (message_text, timestamp) {
                var time = dayjs(timestamp).format('YYYYMMDD_HHmm');
                //var link = this.getMessageText(element);
                var startindex_filename = message_text.lastIndexOf('/');
                
                // if the input-box contains a filename
                if (startindex_filename !== -1) {
                    var filename = message_text.substring(startindex_filename + 1);
                    var startindex_file_ending = filename.lastIndexOf('.');
                    // if the input-box contains a file-ending 
                    if (startindex_file_ending !== -1) {
                        return time + "_" + filename.substring(0, startindex_file_ending);
                    } else { // if the input-box does not contain a file-ending
                        return time + '_' + filename;
                    }
                } else {
                    return time + "_no_Filename.txt";
                }
            },

            getFileType (message_text) {
                var startindex_filename = message_text.lastIndexOf('/') + 1;
                var filename = message_text.substring(startindex_filename);
                
                var startindex_file_ending = filename.lastIndexOf('.');
                if (startindex_file_ending !== -1) {
                    return filename.substring(startindex_file_ending);
                } else {
                    return '';
                }
            }
        });

        _converse.DownloadAttachementsErrorMessage = Backbone.NativeView.extend({
            tagName: 'div',
            className: 'attachement-download-error',
            msg_span_start: '<p class="attachement-download-error-msg">',
            msg_span_end: '</p>',

            initialize (options) {
                this.html_element = options.html_element; 
                this.adjacent_position = options.adjacent_position;
                this.ignore = false;
            },  

            render (error_msg) {
                this.updateError(error_msg);
                return this.el;
            },

            ignoreErrorMessage () {
                this.ignore = true;
            },

            unignoreErrorMessage () {
                this.ignore = false;
            },

            updateError (error_msg) {
                this.ignore = false;
                this.error_msg = error_msg;
                if (!_.isNil(this.error_msg)) {
                    this.showError();
                } else {
                    this.hideError();
                }
                return this.el;
            },

            showError () {
                this.el.classList.remove('collapsed');
                this.reRender();
            },

            hideError () {
                this.el.classList.add('collapsed');
            },

            reRender () {
                if (!_.isNil(this.error_msg) && !this.ignore) {
                    this.el.innerHTML = this.msg_span_start + this.error_msg + this.msg_span_end;
                    this.html_element.querySelector('.attachement-header').insertAdjacentElement('beforeend', this.el);
                }
            },

            existsError () {
                return (!_.isNil(this.error_msg) && !this.ignore);
            },

            getError () {
                return this.error_msg;
            }
        });

        _converse.DownloadInProgress = Backbone.NativeView.extend({
            tagName: 'div',
            className: 'dark-background-full',
            events: {},

            initialize () {},

            render () {
                var modal_window = tpl_download_in_progress({
                    'loadingInProgressMessage': __('Download in Progress...')
                });
                this.el.insertAdjacentHTML('beforeend', modal_window);

                return this.el;
            },

            show () {
                this.el.classList.remove('collapsed');
            },

            hide (ev) {
                if (!_.isNil(ev)) { ev.stopPropagation(); }
                this.el.parentElement.removeChild(this.el);
            },
        });

        _converse.MultimediaDownloadView = Backbone.NativeView.extend({
            tagName: 'div',
            className: 'dark-background-full download-popup',
            events: {
                'click .close-popup': 'hide',
                'click #download-select-all': 'selectOrDeselectAll',
                'click .download-files-button': 'downloadAllFiles',
                'change .zipfile-name-input': 'zipfile_nameChanged'
            },
            
            initialize (options) {
                this.chat_name_string = options.chat_name_string;
                this.error_msg = new _converse.DownloadAttachementsErrorMessage({html_element: this.el, adjacent_position: 'afterbegin'});
                this.zipfile_name = this.getZipfileName();
            },

            render () {
                this.el.innerHTML = "";
                var zipfile_name = this.getZipfileName();
                var table = tpl_download_dialog({
                    'timestampCaption': __('Timestamp'),
                    'userCaption': __('User'),
                    'fileCaption': __('File'),
                    'filenameCaption': __('Filename'),
                    'chatCaption': __('Attachements from the Chat'),
                    'zipfile_name': zipfile_name || '',
                    'zipfilePlaceholder': __("Please enter the name of the zip file."),
                    'downloadButtonCaption': __("Download attachements")
                });
                this.el.insertAdjacentHTML('beforeend', table);

                this.error_msg.reRender();

                var self = this;
                var table_body = this.el.querySelector('.download-table-body');
                _.each(this.collection.models, function (row) {
                    var view = new _converse.MultimediaFileView({model: row, error_msg: self.error_msg});
                    table_body.insertAdjacentElement('beforeend', view.render());
                });
                
                return this.el;
            },

            show () {
                this.el.classList.remove('collapsed');
            },

            hide (ev) {
                if (!_.isNil(ev)) { ev.stopPropagation(); }
                this.el.classList.add('collapsed');
            },

            selectOrDeselectAll (ev) {
                ev.stopPropagation();
                // save the state of the top checkbox. the value is needed 
                var checked = this.el.querySelector('#download-select-all').checked;

                _.each(this.collection.models, function (model) {
                    if (checked) {
                        model.set({ checked: true}, {silent: true});
                    } else {
                        model.set({ checked: false}, {silent: true});
                    }
                });
                this.render();
                this.el.querySelector('#download-select-all').checked = checked; //re-setting checkbox after re-rendering
            },

            downloadAllFiles () {
                var self = this;
                
                // get the user-selected files
                var selected = this.collection.where({checked: true});
                
                var no_files_selected_error = __("No Files for Download selected!");
                if (selected.length === 0) {
                    this.error_msg.updateError(no_files_selected_error);
                    return;
                } else {
                    this.error_msg.updateError();
                }

                // checking for duplicate filenames
                _.each(selected, function (model) {                        
                    var current = model;
                    var duplicate_counter = 0;
                    _.each(selected, function (model) {
                        // comparing whole filename and obj regarding equality
                        if((current.attributes.filename + current.attributes.type) ===
                            (model.attributes.filename + model.attributes.type) &&
                            !(_.isEqual(current, model))) 
                        {    
                            duplicate_counter++;
                            model.attributes.filename = model.attributes.filename + '(' + duplicate_counter + ')';
                        }
                    });
                });
                
                // hide download-dialog and start loading-screen
                self.hide();
                var loading_sceen = new _converse.DownloadInProgress();
                var element = document.body.querySelector('.loading-screen');
                
                if (!_.isNil(element)) {
                    element.parentElement.removeChild(element); 
                }
                document.body.querySelector('#conversejs').insertAdjacentElement('beforeend', loading_sceen.render());

                var zip = new jszip();
                var i = 0;

                _.each(selected, function (model) {
                    
                    var filename = model.attributes.filename + model.attributes.type;
                    if (_.isNil(filename) || filename === '') {
                        filename = model.attributes.default_name + model.attributes.type;
                    }

                    jszip_utils.getBinaryContent(model.attributes.link, function (err, data) {
                        if (err || data.byteLength === 0) {
                            zip.file(model.attributes.filename + "_ERROR.txt", "The file " + model.attributes.link + " could not be downloaded\n");
                        } else {
                            zip.file(filename, data, {binary:true});
                        }
                        i++;
                    
                        if (i === selected.length) {
                            zip.generateAsync({type:"blob"}).then(function (content) {
                                saveAs(content, self.getZipfileName() + ".zip");
                                loading_sceen.hide();
                            });
                        }
                    });
                });
            },

            zipfile_nameChanged () {
                var filename = this.el.querySelector('.zipfile-name-input').value;
                if (this.isValidFilename(filename)) {
                    this.zipfile_name = filename; 
                }
                this.el.querySelector('.zipfile-name-input').value = this.zipfile_name;
            },

            getZipfileName () {
                if (_.isNil(this.zipfile_name) || this.zipfile_name === '') {
                    var timestamp = dayjs(Date.now()).format('YYYYMMDD_HHmm');
                    var CONVERSE_STRING = 'conversejs_';
                    return CONVERSE_STRING + timestamp + this.chat_name_string;
                } else {
                    return this.zipfile_name;
                }
            },

            isValidFilename (filename) {
                var zip = (/^[0-9a-zäöüßA-ZÄÖÜ_\-. ]+$/).test(filename);
                if (!zip) {
                    this.error_msg.updateError(__("The Filename ") + filename + __(" is invalid. Recovering last valid Filename."));
                } else {
                    this.error_msg.updateError();
                }
                return zip;
            }                
        });

        _converse.api.listen.on('connected', function () {
            if (_converse.allowed_download_servers.length < 1 ) {
                _converse.allowed_download_servers.push(_converse.domain);
            }
        });
    }
});
