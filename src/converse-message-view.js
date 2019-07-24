// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-message-view
 */
import URI from "urijs";
import converse from  "@converse/headless/converse-core";
import filesize from "filesize";
import html from "./utils/html";
import tpl_csn from "templates/csn.html";
import tpl_file_progress from "templates/file_progress.html";
import tpl_info from "templates/info.html";
import tpl_message from "templates/message.html";
import tpl_message_versions_modal from "templates/message_versions_modal.html";
import u from "@converse/headless/utils/emoji";
import xss from "xss/dist/xss";

const { Backbone, _, dayjs } = converse.env;


converse.plugins.add('converse-message-view', {

    dependencies: ["converse-modal", "converse-chatboxviews"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;
        const { __ } = _converse;


        function onTagFoundDuringXSSFilter (tag, html, options) {
            /* This function gets called by the XSS library whenever it finds
             * what it thinks is a new HTML tag.
             *
             * It thinks that something like <https://example.com> is an HTML
             * tag and then escapes the <> chars.
             *
             * We want to avoid this, because it prevents these URLs from being
             * shown properly (whithout the trailing &gt;).
             *
             * The URI lib correctly trims a trailing >, but not a trailing &gt;
             */
            if (options.isClosing) {
                // Closing tags don't match our use-case
                return;
            }
            const uri = new URI(tag);
            const protocol = uri.protocol().toLowerCase();
            if (!_.includes(["https", "http", "xmpp", "ftp"], protocol)) {
                // Not a URL, the tag will get filtered as usual
                return;
            }
            if (uri.equals(tag) && `<${tag}>` === html.toLocaleLowerCase()) {
                // We have something like <https://example.com>, and don't want
                // to filter it.
                return html;
            }
        }


        _converse.api.settings.update({
            'show_images_inline': true
        });

        _converse.MessageVersionsModal = _converse.BootstrapModal.extend({
            toHTML () {
                return tpl_message_versions_modal(Object.assign(
                    this.model.toJSON(), {
                    '__': __,
                    'dayjs': dayjs
                }));
            }
        });


        _converse.MessageView = _converse.ViewWithAvatar.extend({
            events: {
                'click .chat-msg__edit-modal': 'showMessageVersionsModal'
            },

            initialize () {
                this.debouncedRender = _.debounce(() => {
                    // If the model gets destroyed in the meantime,
                    // it no longer has a collection
                    if (this.model.collection) {
                        this.render();
                    }
                }, 50);

                if (this.model.vcard) {
                    this.model.vcard.on('change', this.debouncedRender, this);
                }

                if (this.model.rosterContactAdded) {
                    this.model.rosterContactAdded.then(() => {
                        this.model.contact.on('change:nickname', this.debouncedRender, this);
                        this.debouncedRender();
                    });
                }

                if (this.model.occupantAdded) {
                    this.model.occupantAdded.then(() => {
                        this.model.occupant.on('change:role', this.debouncedRender, this);
                        this.model.occupant.on('change:affiliation', this.debouncedRender, this);
                        this.debouncedRender();
                    });
                }

                this.model.on('change', this.onChanged, this);
                this.model.on('destroy', this.fadeOut, this);
            },

            async render () {
                const is_followup = u.hasClass('chat-msg--followup', this.el);
                if (this.model.isOnlyChatStateNotification()) {
                    this.renderChatStateNotification()
                } else if (this.model.get('file') && !this.model.get('oob_url')) {
                    if (!this.model.file) {
                        _converse.log("Attempted to render a file upload message with no file data");
                        return this.el;
                    }
                    this.renderFileUploadProgresBar();
                } else if (this.model.get('type') === 'error') {
                    this.renderErrorMessage();
                } else if (this.model.get('type') === 'info') {
                    this.renderInfoMessage();
                } else {
                    await this.renderChatMessage();
                }
                if (is_followup) {
                    u.addClass('chat-msg--followup', this.el);
                }
                return this.el;
            },

            async onChanged (item) {
                // Jot down whether it was edited because the `changed`
                // attr gets removed when this.render() gets called further
                // down.
                const edited = item.changed.edited;
                if (this.model.changed.progress) {
                    return this.renderFileUploadProgresBar();
                }
                if (_.filter(['correcting', 'message', 'type', 'upload', 'received'],
                             prop => Object.prototype.hasOwnProperty.call(this.model.changed, prop)).length) {
                    await this.debouncedRender();
                }
                if (edited) {
                    this.onMessageEdited();
                }
            },

            fadeOut () {
                if (_converse.animate) {
                    setTimeout(() => this.remove(), 600);
                    u.addClass('fade-out', this.el);
                } else {
                    this.remove();
                }
            },

            onMessageEdited () {
                if (this.model.get('is_archived')) {
                    return;
                }
                this.el.addEventListener(
                    'animationend',
                    () => u.removeClass('onload', this.el),
                    {'once': true}
                );
                u.addClass('onload', this.el);
            },

            replaceElement (msg) {
                if (!_.isNil(this.el.parentElement)) {
                    this.el.parentElement.replaceChild(msg, this.el);
                }
                this.setElement(msg);
                return this.el;
            },

            async renderChatMessage () {
                const is_me_message = this.isMeCommand();
                const time = dayjs(this.model.get('time'));
                const role = this.model.vcard ? this.model.vcard.get('role') : null;
                const roles = role ? role.split(',') : [];

                const msg = u.stringToElement(tpl_message(
                    Object.assign(
                        this.model.toJSON(), {
                        '__': __,
                        'is_groupchat_message': this.model.get('type') === 'groupchat',
                        'occupant': this.model.occupant,
                        'is_me_message': is_me_message,
                        'roles': roles,
                        'pretty_time': time.format(_converse.time_format),
                        'time': time.toISOString(),
                        'extra_classes': this.getExtraMessageClasses(),
                        'label_show': __('Show more'),
                        'username': this.model.getDisplayName()
                    })
                ));

                const url = this.model.get('oob_url');
                if (url) {
                    msg.querySelector('.chat-msg__media').innerHTML = _.flow(
                        _.partial(u.renderFileURL, _converse),
                        _.partial(u.renderMovieURL, _converse),
                        _.partial(u.renderAudioURL, _converse),
                        _.partial(u.renderImageURL, _converse))(url);
                }

                let text = this.getMessageText();
                const msg_content = msg.querySelector('.chat-msg__text');
                if (text && text !== url) {
                    if (is_me_message) {
                        text = text.substring(4);
                    }
                    text = xss.filterXSS(text, {'whiteList': {}, 'onTag': onTagFoundDuringXSSFilter});
                    msg_content.innerHTML = _.flow(
                        _.partial(u.geoUriToHttp, _, _converse.geouri_replacement),
                        _.partial(u.addMentionsMarkup, _, this.model.get('references'), this.model.collection.chatbox),
                        u.addHyperlinks,
                        u.renderNewLines,
                        _.partial(u.addEmoji, _converse, _)
                    )(text);
                }
                const promise = u.renderImageURLs(_converse, msg_content);
                if (this.model.get('type') !== 'headline') {
                    this.renderAvatar(msg);
                }
                await promise;
                this.replaceElement(msg);
                if (this.model.collection) {
                    // If the model gets destroyed in the meantime, it no
                    // longer has a collection.
                    this.model.collection.trigger('rendered', this);
                }
            },

            renderInfoMessage () {
                const msg = u.stringToElement(
                    tpl_info(Object.assign(this.model.toJSON(), {
                        'extra_classes': 'chat-info',
                        'isodate': dayjs(this.model.get('time')).toISOString()
                    }))
                );
                return this.replaceElement(msg);
            },

            renderErrorMessage () {
                const msg = u.stringToElement(
                    tpl_info(Object.assign(this.model.toJSON(), {
                        'extra_classes': 'chat-error',
                        'isodate': dayjs(this.model.get('time')).toISOString()
                    }))
                );
                return this.replaceElement(msg);
            },

            renderChatStateNotification () {
                let text;
                const from = this.model.get('from'),
                      name = this.model.getDisplayName();

                if (this.model.get('chat_state') === _converse.COMPOSING) {
                    if (this.model.get('sender') === 'me') {
                        text = __('Typing from another device');
                    } else {
                        text = __('%1$s is typing', name);
                    }
                } else if (this.model.get('chat_state') === _converse.PAUSED) {
                    if (this.model.get('sender') === 'me') {
                        text = __('Stopped typing on the other device');
                    } else {
                        text = __('%1$s has stopped typing', name);
                    }
                } else if (this.model.get('chat_state') === _converse.GONE) {
                    text = __('%1$s has gone away', name);
                } else {
                    return;
                }
                const isodate = (new Date()).toISOString();
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
                    Object.assign(this.model.toJSON(), {
                        '__': __,
                        'filename': this.model.file.name,
                        'filesize': filesize(this.model.file.size)
                    })));
                this.replaceElement(msg);
                this.renderAvatar();
            },

            showMessageVersionsModal (ev) {
                ev.preventDefault();
                if (_.isUndefined(this.model.message_versions_modal)) {
                    this.model.message_versions_modal = new _converse.MessageVersionsModal({'model': this.model});
                }
                this.model.message_versions_modal.show(ev);
            },

            getMessageText () {
                if (this.model.get('is_encrypted')) {
                    return this.model.get('plaintext') ||
                           (_converse.debug ? __('Unencryptable OMEMO message') : null);
                }
                return this.model.get('message');
            },

            isMeCommand () {
                const text = this.getMessageText();
                if (!text) {
                    return false;
                }
                return text.startsWith('/me ');
            },

            processMessageText () {
                var text = this.get('message');
                text = u.geoUriToHttp(text, _converse.geouri_replacement);
            },

            getExtraMessageClasses () {
                let extra_classes = this.model.get('is_delayed') && 'delayed' || '';

                if (this.model.get('type') === 'groupchat') {
                    if (this.model.occupant) {
                        extra_classes += ` ${this.model.occupant.get('role') || ''} ${this.model.occupant.get('affiliation') || ''}`;
                    }
                    if (this.model.get('sender') === 'them' && this.model.collection.chatbox.isUserMentioned(this.model)) {
                        // Add special class to mark groupchat messages
                        // in which we are mentioned.
                        extra_classes += ' mentioned';
                    }
                }
                if (this.model.get('correcting')) {
                    extra_classes += ' correcting';
                }
                return extra_classes;
            }
        });
    }
});
