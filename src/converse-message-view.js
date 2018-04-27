// Converse.js
// https://conversejs.org
//
// Copyright (c) 2012-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

(function (root, factory) {
    define([
        "converse-core",
        "xss",
        "emojione",
        "filesize",
        "tpl!action",
        "tpl!file_progress",
        "tpl!info",
        "tpl!message",
        "tpl!spoiler_message"
    ], factory);
}(this, function (
        converse,
        xss,
        emojione,
        filesize,
        tpl_action,
        tpl_file_progress,
        tpl_info,
        tpl_message,
        tpl_spoiler_message
    ) {
    "use strict";
    const { Backbone, _, moment } = converse.env;
    const u = converse.env.utils;


    converse.plugins.add('converse-message-view', {

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                { __ } = _converse;

            _converse.MessageView = Backbone.NativeView.extend({

                initialize () {
                    this.chatbox = this.model.collection.chatbox;
                    this.chatbox.on('change:fullname', (chatbox) => this.model.save('fullname', chatbox.get('fullname')));

                    this.model.on('change:fullname', this.render, this);
                    this.model.on('change:progress', this.renderFileUploadProgresBar, this);
                    this.model.on('change:type', this.render, this);
                    this.model.on('change:upload', this.render, this);
                    this.render();
                },

                render () {
                    if (this.model.get('file') && !this.model.get('message')) {
                        return this.renderFileUploadProgresBar();
                    } else if (this.model.get('type') === 'error') {
                        return this.renderErrorMessage();
                    }

                    let template, username, image, image_type,
                        text = this.model.get('message');

                    // TODO: store proper username on the message itself
                    if (this.isMeCommand()) {
                        const arr = this.getValuesForMeCommand();
                        template = arr[0];
                        username = arr[1];
                        text = arr[2];
                    } else {
                        username = this.model.get('fullname') || this.model.get('from');
                        template = this.model.get('is_spoiler') ? tpl_spoiler_message : tpl_message;

                        if (this.model.get('type') !== 'headline') {
                            if (this.model.get('sender') === 'me') {
                                image_type = _converse.xmppstatus.get('image_type');
                                image = _converse.xmppstatus.get('image');
                            } else {
                                image_type = this.chatbox.get('image_type');
                                image = this.chatbox.get('image');
                            }
                        }
                    }
                    const moment_time = moment(this.model.get('time'));
                    const msg = u.stringToElement(template(
                        _.extend(this.model.toJSON(), {
                            'pretty_time': moment_time.format(_converse.time_format),
                            'time': moment_time.format(),
                            'username': username,
                            'extra_classes': this.getExtraMessageClasses(),
                            'label_show': __('Show more'),
                            'image_type': image_type,
                            'image': image
                        })
                    ));

                    var url = this.model.get('oob_url');
                    if (url) {
                        const msg_media = msg.querySelector('.chat-msg-media');
                        msg_media.innerHTML = _.flow(
                            _.partial(u.renderFileURL, _converse),
                            _.partial(u.renderMovieURL, _converse),
                            _.partial(u.renderAudioURL, _converse),
                            _.partial(u.renderImageURL, _converse)
                        )(url);
                    }

                    const msg_content = msg.querySelector('.chat-msg-text');
                    if (text !== url) {
                        text = xss.filterXSS(text, {'whiteList': {}});
                        msg_content.innerHTML = _.flow(
                            _.partial(u.geoUriToHttp, _, _converse.geouri_replacement),
                            u.addHyperlinks,
                            _.partial(u.addEmoji, _converse, emojione, _)
                        )(text);
                    }
                    u.renderImageURLs(_converse, msg_content).then(() => {
                        this.model.collection.trigger('rendered');
                    });
                    return this.replaceElement(msg);
                },

                replaceElement (msg) {
                    if (!_.isNil(this.el.parentElement)) {
                        this.el.parentElement.replaceChild(msg, this.el);
                    }
                    this.setElement(msg);
                    return this.el;
                },

                renderErrorMessage () {
                    const moment_time = moment(this.model.get('time')),
                          msg = u.stringToElement(
                        tpl_info(_.extend(this.model.toJSON(), {
                            'extra_classes': 'chat-error',
                            'isodate': moment_time.format(),
                            'data': ''
                        })));
                    return this.replaceElement(msg);
                },

                renderFileUploadProgresBar () {
                    const msg = u.stringToElement(tpl_file_progress(
                        _.extend(this.model.toJSON(),
                            {'filesize': filesize(this.model.get('file').size)}
                        )));
                    return this.replaceElement(msg);
                },

                isMeCommand () {
                    const match = this.model.get('message').match(/^\/(.*?)(?: (.*))?$/);
                    return match && match[1] === 'me';
                },

                getValuesForMeCommand() {
                    let username, text;
                    const match = this.model.get('message').match(/^\/(.*?)(?: (.*))?$/);
                    if (match && match[1] === 'me') {
                        text = this.model.get('message').replace(/^\/me/, '');
                    }
                    if (this.model.get('sender') === 'me') {
                        const fullname = _converse.xmppstatus.get('fullname') || this.model.get('fullname');
                        username = _.isNil(fullname) ? _converse.bare_jid : fullname;
                    } else {
                        username = this.model.get('fullname') || this.model.get('from');
                    }
                    return [tpl_action, username, text]
                },

                processMessageText () {
                    var text = this.get('message');
                    text = u.geoUriToHttp(text, _converse.geouri_replacement);
                },

                getExtraMessageClasses () {
                    let extra_classes = this.model.get('delayed') && 'delayed' || '';
                    if (this.model.get('type') === 'groupchat' && this.model.get('sender') === 'them') {
                        if (this.model.collection.chatbox.isUserMentioned(this.model.get('message'))) {
                            // Add special class to mark groupchat messages
                            // in which we are mentioned.
                            extra_classes += ' mentioned';
                        }
                    }
                    return extra_classes;
                }
            });
        }
    });
    return converse;
}));
