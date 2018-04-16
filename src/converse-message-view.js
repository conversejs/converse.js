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
        "tpl!action",
        "tpl!message",
        "tpl!spoiler_message"
    ], factory);
}(this, function (
            converse,
            xss,
            emojione,
            tpl_action,
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
                    this.model.collection.chatbox.on('change:fullname', this.render, this);
                    this.render();
                },

                render () {
                    /* Renders a chat message based on the passed in attributes.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     *
                     *  Returns:
                     *      The DOM element representing the message.
                     */
                    const chatbox = this.model.collection.chatbox;

                    let text = this.model.get('message'),
                        fullname = chatbox.get('fullname') || chatbox.get('jid'),
                        template, username;

                    const match = text.match(/^\/(.*?)(?: (.*))?$/);
                    if ((match) && (match[1] === 'me')) {
                        text = text.replace(/^\/me/, '');
                        template = tpl_action;
                        if (this.model.get('sender') === 'me') {
                            fullname = _converse.xmppstatus.get('fullname') || this.model.get('fullname');
                            username = _.isNil(fullname)? _converse.bare_jid: fullname;
                        } else {
                            username = this.model.get('fullname');
                        }
                    } else {
                        username = this.model.get('sender') === 'me' && __('me') || fullname;
                        template = this.model.get('is_spoiler') ? tpl_spoiler_message : tpl_message;
                    }
                    text = u.geoUriToHttp(text, _converse);

                    const msg_time = moment(this.model.get('time')) || moment;
                    const msg = u.stringToElement(template(
                        _.extend(this.model.toJSON(), {
                            'time': msg_time.format(_converse.time_format),
                            'isodate': msg_time.format(),
                            'username': username,
                            'extra_classes': this.getExtraMessageClasses(),
                            'label_show': __('Show hidden message')
                        })
                    ));
                    if (_converse.show_message_load_animation) {
                        window.setTimeout(_.partial(u.removeClass, 'onload', msg), 2000);
                    }
                    const msg_content = msg.querySelector('.chat-msg-content');
                    msg_content.innerHTML = u.addEmoji(
                        _converse, emojione, u.addHyperlinks(xss.filterXSS(text, {'whiteList': {}}))
                    );

                    if (msg_content.textContent.endsWith('mp4')) {
                        msg_content.innerHTML = u.renderMovieURLs(msg_content);
                    } else if (msg_content.textContent.endsWith('mp3')) {
                        msg_content.innerHTML = u.renderAudioURLs(msg_content);
                    } else {
                        u.renderImageURLs(msg_content).then(() => {
                            this.model.collection.trigger('rendered');
                        });
                    }
                    if (!_.isNil(this.el.parentElement)) {
                        this.el.parentElement.replaceChild(msg, this.el);
                    }
                    this.setElement(msg);
                    return this.el;
                },

                getExtraMessageTemplateAttributes () {
                    /* Provides a hook for sending more attributes to the
                     * message template.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing message attributes.
                     */
                    if (this.model.get('is_spoiler')) {
                        return {};
                    } else {
                        return {}
                    }
                },

                getExtraMessageClasses () {
                    let extra_classes;
                    if (_converse.show_message_load_animation) {
                        extra_classes =  'onload ' + (this.model.get('delayed') && 'delayed' || '');
                    } else {
                        extra_classes = this.model.get('delayed') && 'delayed' || '';
                    }
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
