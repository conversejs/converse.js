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
        "tpl!csn",
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
        tpl_csn,
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

            _converse.ViewWithAvatar = Backbone.NativeView.extend({

                renderAvatar () {
                    const canvas_el = this.el.querySelector('canvas');
                    if (_.isNull(canvas_el)) {
                        return;
                    }
                    const image_type = this.model.vcard.get('image_type'),
                          image = this.model.vcard.get('image'),
                          img_src = "data:" + image_type + ";base64," + image,
                          img = new Image();

                    img.onload = () => {
                        const ctx = canvas_el.getContext('2d'),
                              ratio = img.width / img.height;
                        ctx.clearRect(0, 0, canvas_el.width, canvas_el.height);
                        if (ratio < 1) {
                            ctx.drawImage(img, 0, 0, canvas_el.width, canvas_el.height * (1 / ratio));
                        } else {
                            ctx.drawImage(img, 0, 0, canvas_el.width, canvas_el.height * ratio);
                        }
                    };
                    img.src = img_src;
                },
            });

            _converse.MessageView = _converse.ViewWithAvatar.extend({

                initialize () {
                    this.model.vcard.on('change', this.render, this);
                    this.model.on('change:progress', this.renderFileUploadProgresBar, this);
                    this.model.on('change:type', this.render, this);
                    this.model.on('change:upload', this.render, this);
                    this.model.on('destroy', this.remove, this);
                    this.render();
                },

                render () {
                    if (this.model.isOnlyChatStateNotification()) {
                        return this.renderChatStateNotification()
                    } else if (this.model.get('file') && !this.model.get('oob_url')) {
                        return this.renderFileUploadProgresBar();
                    } else if (this.model.get('type') === 'error') {
                        return this.renderErrorMessage();
                    } else {
                        return this.renderChatMessage();
                    }
                },

                replaceElement (msg) {
                    if (!_.isNil(this.el.parentElement)) {
                        this.el.parentElement.replaceChild(msg, this.el);
                    }
                    this.setElement(msg);
                    return this.el;
                },

                renderChatMessage () {
                    let template, text = this.model.get('message');
                    if (this.isMeCommand()) {
                        template = tpl_action;
                        text = this.model.get('message').replace(/^\/me/, '');
                    } else {
                        template = this.model.get('is_spoiler') ? tpl_spoiler_message : tpl_message;
                    }

                    const moment_time = moment(this.model.get('time'));
                    const msg = u.stringToElement(template(
                        _.extend(this.model.toJSON(), {
                            'pretty_time': moment_time.format(_converse.time_format),
                            'time': moment_time.format(),
                            'extra_classes': this.getExtraMessageClasses(),
                            'label_show': __('Show more'),
                            'username': this.model.getDisplayName()
                        })
                    ));

                    var url = this.model.get('oob_url');
                    if (url) {
                        msg.querySelector('.chat-msg-media').innerHTML = _.flow(
                            _.partial(u.renderFileURL, _converse),
                            _.partial(u.renderMovieURL, _converse),
                            _.partial(u.renderAudioURL, _converse),
                            _.partial(u.renderImageURL, _converse))(url);
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
                    this.replaceElement(msg);

                    if (this.model.get('type') !== 'headline') {
                        this.renderAvatar();
                    }
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

                renderChatStateNotification () {
                    if (this.model.get('delayed')) {
                        return this.model.destroy();
                    }
                    let text;
                    const from = this.model.get('from'),
                          name = this.model.getDisplayName();

                    if (this.model.get('chat_state') === _converse.COMPOSING) {
                        if (this.model.get('sender') === 'me') {
                            text = __('Typing from another device');
                        } else {
                            text = name +' '+__('is typing');
                        }
                    } else if (this.model.get('chat_state') === _converse.PAUSED) {
                        if (this.model.get('sender') === 'me') {
                            text = __('Stopped typing on the other device');
                        } else {
                            text = name +' '+__('has stopped typing');
                        }
                    } else if (this.model.get('chat_state') === _converse.GONE) {
                        text = name +' '+__('has gone away');
                    } else {
                        return;
                    }
                    const isodate = moment().format();
                    this.replaceElement(
                          u.stringToElement(
                            tpl_csn({
                                'message': text,
                                'from': from,
                                'isodate': isodate
                            })));
                },

                renderFileUploadProgresBar () {
                    const msg = u.stringToElement(tpl_file_progress(
                        _.extend(this.model.toJSON(), {
                            'filesize': filesize(this.model.get('file').size),
                        })));
                    this.replaceElement(msg);
                    this.renderAvatar();
                },

                isMeCommand () {
                    const text = this.model.get('message');
                    if (!text) {
                        return false;
                    }
                    const match = text.match(/^\/(.*?)(?: (.*))?$/);
                    return match && match[1] === 'me';
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
