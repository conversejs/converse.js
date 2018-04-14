// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define([
            "converse-core",
            "bootstrap",
            "emojione",
            "xss",
            "tpl!action",
            "tpl!chatbox",
            "tpl!chatbox_head",
            "tpl!chatbox_message_form",
            "tpl!csn",
            "tpl!emojis",
            "tpl!error_message",
            "tpl!help_message",
            "tpl!info",
            "tpl!message",
            "tpl!new_day",
            "tpl!spinner",
            "tpl!spoiler_button",
            "tpl!spoiler_message",
            "tpl!status_message",
            "tpl!toolbar",
            "converse-http-file-upload",
            "converse-chatboxes"
    ], factory);
}(this, function (
            converse,
            bootstrap,
            emojione,
            xss,
            tpl_action,
            tpl_chatbox,
            tpl_chatbox_head,
            tpl_chatbox_message_form,
            tpl_csn,
            tpl_emojis,
            tpl_error_message,
            tpl_help_message,
            tpl_info,
            tpl_message,
            tpl_new_day,
            tpl_spinner,
            tpl_spoiler_button,
            tpl_spoiler_message,
            tpl_status_message,
            tpl_toolbar,
            filetransfer
    ) {
    "use strict";
    const { $msg, Backbone, Promise, Strophe, _, b64_sha1, f, sizzle, moment } = converse.env;
    const u = converse.env.utils;
    const KEY = {
        ENTER: 13,
        FORWARD_SLASH: 47
    };

    converse.plugins.add('converse-chatview', {
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
        dependencies: ["converse-chatboxes", "converse-disco"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
            //
            ChatBoxViews: {
                onChatBoxAdded (item) {
                    const { _converse } = this.__super__;
                    let view = this.get(item.get('id'));
                    if (!view) {
                        view = new _converse.ChatBoxView({model: item});
                        this.add(item.get('id'), view);
                        return view;
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
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
                'use_emojione': false,
                'emojione_image_path': emojione.imagePathPNG,
                'chatview_avatar_height': 32,
                'chatview_avatar_width': 32,
                'show_toolbar': true,
                'show_message_load_animation': false,
                'time_format': 'HH:mm',
                'visible_toolbar_buttons': {
                    'call': false,
                    'clear': true,
                    'emoji': true,
                    'spoiler': true
                },
            });
            emojione.imagePathPNG = _converse.emojione_image_path;
            emojione.ascii = true;

            function onWindowStateChanged (data) {
                _converse.chatboxviews.each(function (chatboxview) {
                    chatboxview.onWindowStateChanged(data.state);
                });
            }
            _converse.api.listen.on('windowStateChanged', onWindowStateChanged);

            _converse.EmojiPicker = Backbone.Model.extend({
                defaults: {
                    'current_category': 'people',
                    'current_skintone': '',
                    'scroll_position': 0
                },
                initialize () {
                    const id = `converse.emoji-${_converse.bare_jid}`;
                    this.id = id;
                    this.browserStorage = new Backbone.BrowserStorage[_converse.storage](id);
                }
            });

            _converse.EmojiPickerView = Backbone.VDOMView.extend({
                className: 'emoji-picker-container',
                events: {
                    'click .emoji-category-picker li.emoji-category': 'chooseCategory',
                    'click .emoji-skintone-picker li.emoji-skintone': 'chooseSkinTone'
                },

                initialize () {
                    this.model.on('change:current_skintone', this.render, this);
                    this.model.on('change:current_category', this.render, this);
                },

                toHTML () {
                    return tpl_emojis(
                        _.extend(
                            this.model.toJSON(), {
                                'transform': _converse.use_emojione ? emojione.shortnameToImage : emojione.shortnameToUnicode,
                                'emojis_by_category': u.getEmojisByCategory(_converse, emojione),
                                'toned_emojis': u.getTonedEmojis(_converse),
                                'skintones': ['tone1', 'tone2', 'tone3', 'tone4', 'tone5'],
                                'shouldBeHidden': this.shouldBeHidden
                            }
                        ));
                },

                shouldBeHidden (shortname, current_skintone, toned_emojis) {
                    /* Helper method for the template which decides whether an
                     * emoji should be hidden, based on which skin tone is
                     * currently being applied.
                     */
                    if (_.includes(shortname, '_tone')) {
                        if (!current_skintone || !_.includes(shortname, current_skintone)) {
                            return true;
                        }
                    } else {
                        if (current_skintone && _.includes(toned_emojis, shortname)) {
                            return true;
                        }
                    }
                    return false;
                },

                chooseSkinTone (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const target = ev.target.nodeName === 'IMG' ?
                        ev.target.parentElement : ev.target;
                    const skintone = target.getAttribute("data-skintone").trim();
                    if (this.model.get('current_skintone') === skintone) {
                        this.model.save({'current_skintone': ''});
                    } else {
                        this.model.save({'current_skintone': skintone});
                    }
                },

                chooseCategory (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const target = ev.target.nodeName === 'IMG' ?
                        ev.target.parentElement : ev.target;
                    const category = target.getAttribute("data-category").trim();
                    this.model.save({
                        'current_category': category,
                        'scroll_position': 0
                    });
                }
            });

            _converse.ChatBoxHeading = Backbone.NativeView.extend({

                initialize () {
                    this.model.on('change:image', this.render, this);
                    this.model.on('change:status', this.onStatusMessageChanged, this);
                    this.model.on('change:fullname', this.render, this);
                },

                render () {
                    this.el.innerHTML = tpl_chatbox_head(
                        _.extend(this.model.toJSON(), {
                            '_converse': _converse,
                            'avatar_width': _converse.chatview_avatar_width,
                            'avatar_height': _converse.chatview_avatar_height,
                            'info_close': __('Close this chat box'),
                        })
                    );
                    return this;
                },

                onStatusMessageChanged (item) {
                    this.render();
                    _converse.emit('contactStatusMessageChanged', {
                        'contact': item.attributes,
                        'message': item.get('status')
                    });
                }
            });

            _converse.ChatBoxView = Backbone.NativeView.extend({
                length: 200,
                className: 'chatbox hidden',
                is_chatroom: false,  // Leaky abstraction from MUC

                events: {
                    'click .close-chatbox-button': 'close',
                    'click .new-msgs-indicator': 'viewUnreadMessages',
                    'click .send-button': 'onFormSubmitted',
                    'click .toggle-call': 'toggleCall',
                    'click .toggle-clear': 'clearMessages',
                    'click .toggle-smiley ul.emoji-picker li': 'insertEmoji',
                    'click .toggle-smiley': 'toggleEmojiMenu',
                    'click .toggle-spoiler': 'toggleSpoilerMessage',
                    'click .toggle-compose-spoiler': 'toggleComposeSpoilerMessage',
                    'keypress .chat-textarea': 'keyPressed'
                },

                initialize () {
                    this.scrollDown = _.debounce(this._scrollDown, 250);
                    this.markScrolled = _.debounce(this._markScrolled, 100);
                    this.createEmojiPicker();
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.remove, this);
                    // TODO check for changed fullname as well
                    this.model.on('change:chat_state', this.sendChatState, this);
                    this.model.on('change:chat_status', this.onChatStatusChanged, this);
                    this.model.on('showHelpMessages', this.showHelpMessages, this);
                    this.model.on('sendMessage', this.sendMessage, this);
                    this.render();
                    this.fetchMessages();
                    _converse.emit('chatBoxOpened', this);
                    _converse.emit('chatBoxInitialized', this);
                },

                render () {
                    // XXX: Is this still needed?
                    this.el.setAttribute('id', this.model.get('box_id'));
                    this.el.innerHTML = tpl_chatbox(
                        _.extend(this.model.toJSON(), {
                                unread_msgs: __('You have unread messages')
                            }
                        ));
                    this.content = this.el.querySelector('.chat-content');
                    this.renderMessageForm();
                    this.insertHeading();
                    return this;
                },

                renderToolbar (toolbar, options) {
                    if (!_converse.show_toolbar) {
                        return this;
                    }
                    toolbar = toolbar || tpl_toolbar;
                    options = _.assign(
                        this.model.toJSON(),
                        this.getToolbarOptions(options || {})
                    );
                    this.el.querySelector('.chat-toolbar').innerHTML = toolbar(options);
                    this.addSpoilerButton(options);
                    this.insertEmojiPicker();
                    return this;
                },

                renderMessageForm () {
                    let placeholder;
                    if (this.model.get('composing_spoiler')) {
                        placeholder = __('Hidden message');
                    } else {
                        placeholder = __('Personal message');
                    }
                    const form_container = this.el.querySelector('.message-form-container');
                    form_container.innerHTML = tpl_chatbox_message_form(
                        _.extend(this.model.toJSON(), {
                            'hint_value': _.get(this.el.querySelector('.spoiler-hint'), 'value'),
                            'label_personal_message': placeholder,
                            'label_send': __('Send'),
                            'label_spoiler_hint': __('Optional hint'),
                            'message_value': _.get(this.el.querySelector('.chat-textarea'), 'value'),
                            'show_send_button': _converse.show_send_button,
                            'show_toolbar': _converse.show_toolbar,
                            'unread_msgs': __('You have unread messages')
                        }));
                    this.renderToolbar();
                },

                addSpoilerButton (options) {
                    /* Asynchronously adds a button for writing spoiler
                     * messages, based on whether the contact's client supports
                     * it.
                     */
                    if (!options.show_spoiler_button || this.model.get('type') === 'chatroom') {
                        return;
                    }
                    const contact_jid = this.model.get('jid');
                    const resources = this.model.get('resources');
                    if (_.isEmpty(resources)) {
                        return;
                    }
                    Promise.all(_.map(_.keys(resources), (resource) =>
                        _converse.api.disco.supports(Strophe.NS.SPOILER, `${contact_jid}/${resource}`)
                    )).then((results) => {
                        const supported = _.every(f.map(f.get('supported'))(results));
                        if (supported) {
                            const html = tpl_spoiler_button(this.model.toJSON());
                            if (_converse.visible_toolbar_buttons.emoji) {
                                this.el.querySelector('.toggle-smiley').insertAdjacentHTML('afterEnd', html);
                            } else {
                                this.el.querySelector('.chat-toolbar').insertAdjacentHTML('afterBegin', html);
                            }
                        }
                    });
                },

                insertHeading () {
                    this.heading = new _converse.ChatBoxHeading({'model': this.model});
                    this.heading.render();
                    this.heading.chatview = this;

                    const flyout = this.el.querySelector('.flyout');
                    flyout.insertBefore(this.heading.el, flyout.querySelector('.chat-body'));
                    return this;
                },

                getToolbarOptions (options) {
                    let label_toggle_spoiler;
                    if (this.model.get('composing_spoiler')) {
                        label_toggle_spoiler = __('Click to write as a normal (non-spoiler) message');
                    } else {
                        label_toggle_spoiler = __('Click to write your message as a spoiler');
                    }
                    return _.extend(options || {}, {
                        'label_clear': __('Clear all messages'),
                        'label_insert_smiley': __('Insert a smiley'),
                        'label_start_call': __('Start a call'),
                        'label_toggle_spoiler': label_toggle_spoiler,
                        'show_call_button': _converse.visible_toolbar_buttons.call,
                        'show_spoiler_button': _converse.visible_toolbar_buttons.spoiler,
                        'use_emoji': _converse.visible_toolbar_buttons.emoji,
                    });
                },

                afterMessagesFetched () {
                    this.insertIntoDOM();
                    this.scrollDown();
                    this.content.addEventListener('scroll', this.markScrolled.bind(this));
                    _converse.emit('afterMessagesFetched', this);
                },

                fetchMessages () {
                    this.model.messages.fetch({
                        'add': true,
                        'success': this.afterMessagesFetched.bind(this),
                        'error': this.afterMessagesFetched.bind(this),
                    });
                    return this;
                },

                insertIntoDOM () {
                    /* This method gets overridden in src/converse-controlbox.js
                     * as well as src/converse-muc.js (if those plugins are
                     * enabled).
                     */
                    _converse.chatboxviews.insertRowColumn(this.el);
                    return this;
                },

                showChatEvent (message, data='') {
                    const isodate = moment().format();
                    this.content.insertAdjacentHTML(
                        'beforeend',
                        tpl_info({
                            'extra_classes': 'chat-event',
                            'message': message,
                            'isodate': isodate,
                            'data': data
                        }));
                    this.insertDayIndicator(this.content.lastElementChild);
                    this.scrollDown();
                    return isodate;
                },

                showErrorMessage (message) {
                    this.content.insertAdjacentHTML(
                        'beforeend',
                        tpl_error_message({'message': message, 'isodate': moment().format() })
                    );
                    this.scrollDown();
                },

                addSpinner (append=false) {
                    if (_.isNull(this.el.querySelector('.spinner'))) {
                        if (append) {
                            this.content.insertAdjacentHTML('beforeend', tpl_spinner());
                            this.scrollDown();
                        } else {
                            this.content.insertAdjacentHTML('afterbegin', tpl_spinner());
                        }
                    }
                },

                clearSpinner () {
                    _.each(
                        this.content.querySelectorAll('span.spinner'),
                        (el) => el.parentNode.removeChild(el)
                    );
                },

                insertDayIndicator (next_msg_el) {
                    /* Inserts an indicator into the chat area, showing the
                     * day as given by the passed in date.
                     *
                     * The indicator is only inserted if necessary.
                     *
                     * Parameters:
                     *  (HTMLElement) next_msg_el - The message element before
                     *      which the day indicator element must be inserted.
                     *      This element must have a "data-isodate" attribute
                     *      which specifies its creation date.
                     */
                    const prev_msg_el = u.getPreviousElement(next_msg_el, ".message:not(.chat-state-notification)"),
                          prev_msg_date = _.isNull(prev_msg_el) ? null : prev_msg_el.getAttribute('data-isodate'),
                          next_msg_date = next_msg_el.getAttribute('data-isodate');

                    if (_.isNull(prev_msg_date) || moment(next_msg_date).isAfter(prev_msg_date, 'day')) {
                        const day_date = moment(next_msg_date).startOf('day');
                        next_msg_el.insertAdjacentHTML('beforeBegin',
                            tpl_new_day({
                                'isodate': day_date.format(),
                                'datestring': day_date.format("dddd MMM Do YYYY")
                            })
                        );
                    }
                },

                getLastMessageDate (cutoff) {
                    /* Return the ISO8601 format date of the latest message.
                     *
                     * Parameters:
                     *  (Object) cutoff: Moment Date cutoff date. The last
                     *      message received cutoff this date will be returned.
                     */
                    const first_msg = u.getFirstChildElement(this.content, '.message:not(.chat-state-notification)'),
                          oldest_date = first_msg ? first_msg.getAttribute('data-isodate') : null;
                    if (!_.isNull(oldest_date) && moment(oldest_date).isAfter(cutoff)) {
                        return null;
                    }
                    const last_msg = u.getLastChildElement(this.content, '.message:not(.chat-state-notification)'),
                          most_recent_date = last_msg ? last_msg.getAttribute('data-isodate') : null;
                    if (_.isNull(most_recent_date) || moment(most_recent_date).isBefore(cutoff)) {
                        return most_recent_date;
                    }
                    /* XXX: We avoid .chat-state-notification messages, since they are
                     * temporary and get removed once a new element is
                     * inserted into the chat area, so we don't query for
                     * them here, otherwise we get a null reference later
                     * upon element insertion.
                     */
                    const msg_dates = _.invokeMap(
                        sizzle('.message:not(.chat-state-notification)', this.content),
                        Element.prototype.getAttribute, 'data-isodate'
                    )
                    if (_.isObject(cutoff)) {
                        cutoff = cutoff.format();
                    }
                    msg_dates.push(cutoff);
                    msg_dates.sort();
                    const idx = msg_dates.lastIndexOf(cutoff);
                    if (idx === 0) {
                        return null;
                    } else {
                        return msg_dates[idx-1];
                    }
                },

                showMessage (attrs) {
                    /* Inserts a chat message into the content area of the chat box.
                     * Will also insert a new day indicator if the message is on a
                     * different day.
                     *
                     * The message to show may either be newer than the newest
                     * message, or older than the oldest message.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message
                     *      attributes.
                     */
                    const current_msg_date = moment(attrs.time) || moment,
                        previous_msg_date = this.getLastMessageDate(current_msg_date),
                        message_el = this.renderMessage(attrs);

                    if (_.isNull(previous_msg_date)) {
                        this.content.insertAdjacentElement('afterbegin', message_el);
                    } else {
                        const previous_msg_el = sizzle(`[data-isodate="${previous_msg_date}"]:last`, this.content).pop();
                        previous_msg_el.insertAdjacentElement('afterend', message_el);
                    }
                    this.insertDayIndicator(message_el);
                    this.clearChatStateNotification(attrs.from);
                    this.setScrollPosition(message_el);
                },

                setScrollPosition (message_el) {
                    /* Given a newly inserted message, determine whether we
                     * should keep the scrollbar in place (so as to not scroll
                     * up when using infinite scroll).
                     */
                    if (this.model.get('scrolled')) {
                        const next_msg_el = u.getNextElement(message_el, ".chat-message");
                        if (next_msg_el) {
                            // The currently received message is not new, there
                            // are newer messages after it. So let's see if we
                            // should maintain our current scroll position.
                            if (this.content.scrollTop === 0 || this.model.get('top_visible_message')) {
                                const top_visible_message = this.model.get('top_visible_message') || next_msg_el;

                                this.model.set('top_visible_message', top_visible_message);
                                this.content.scrollTop = top_visible_message.offsetTop - 30;
                            }
                        }
                    } else {
                        this.scrollDown();
                    }
                },

                getExtraMessageTemplateAttributes (attrs) {
                    /* Provides a hook for sending more attributes to the
                     * message template.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing message attributes.
                     */
                    if (attrs.is_spoiler) {
                        return {'label_show': __('Show hidden message')};
                    } else {
                        return {}
                    }
                },

                getExtraMessageClasses (attrs) {
                    if (_converse.show_message_load_animation) {
                        return 'onload ' + (attrs.delayed && 'delayed' || '');
                    } else {
                        return attrs.delayed && 'delayed' || '';
                    }
                },

                renderSpoilerMessage (msg, attrs) {
                    /* Render a "spoiler" message, as defined in XEP-0382
                     *
                     * Parameters:
                     *  (HTMLElement) msg: The chat message DOM element
                     *  (Object) attrs: An object containing the message attributes.
                     */
                    const hint = msg.querySelector('.spoiler-hint');
                    hint.appendChild(document.createTextNode(attrs.spoiler_hint || ''));
                },

                renderMessage (attrs) {
                    /* Renders a chat message based on the passed in attributes.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     *
                     *  Returns:
                     *      The DOM element representing the message.
                     */
                    let text = attrs.message,
                        fullname = this.model.get('fullname') || attrs.fullname,
                        template, username;

                    const match = text.match(/^\/(.*?)(?: (.*))?$/);
                    if ((match) && (match[1] === 'me')) {
                        text = text.replace(/^\/me/, '');
                        template = tpl_action;
                        if (attrs.sender === 'me') {
                            fullname = _converse.xmppstatus.get('fullname') || attrs.fullname;
                            username = _.isNil(fullname)? _converse.bare_jid: fullname;
                        } else {
                            username = attrs.fullname;
                        }
                    } else {
                        username = attrs.sender === 'me' && __('me') || fullname;
                        template = attrs.is_spoiler ? tpl_spoiler_message : tpl_message;
                    }

                    text = u.geoUriToHttp(text, _converse);

                    const msg_time = moment(attrs.time) || moment;
                    const msg = u.stringToElement(template(
                        _.extend(this.getExtraMessageTemplateAttributes(attrs), {
                            'msgid': attrs.msgid,
                            'sender': attrs.sender,
                            'time': msg_time.format(_converse.time_format),
                            'isodate': msg_time.format(),
                            'username': username,
                            'extra_classes': this.getExtraMessageClasses(attrs)
                        })
                    ));
                    if (_converse.show_message_load_animation) {
                        window.setTimeout(
                            _.partial(u.removeClass, 'onload', msg), 2000);
                    }
                    const msg_content = msg.querySelector('.chat-msg-content');
                    msg_content.innerHTML = u.addEmoji(
                        _converse, emojione, u.addHyperlinks(xss.filterXSS(text, {'whiteList': {}}))
                    );
                    if (attrs.is_spoiler) {
                        this.renderSpoilerMessage(msg, attrs)
                    }
                    
                    if (msg_content.textContent.endsWith('mp4')) {
                        msg_content.innerHTML = u.renderMovieURLs(msg_content);
                    } else if (msg_content.textContent.endsWith('mp3')) {
                        msg_content.innerHTML = u.renderAudioURLs(msg_content); 
                    } else {
                        u.renderImageURLs(msg_content).then(this.scrollDown.bind(this));
                    }
                    return msg;
                },

                showHelpMessages (msgs, type, spinner) {
                    _.each(msgs, (msg) => {
                        this.content.insertAdjacentHTML(
                            'beforeend',
                            tpl_help_message({
                                'isodate': moment().format(),
                                'type': type||'info',
                                'message': xss.filterXSS(msg, {'whiteList': {'strong': []}})
                            })
                        );
                    });
                    if (spinner === true) {
                        this.addSpinner();
                    } else if (spinner === false) {
                        this.clearSpinner();
                    }
                    return this.scrollDown();
                },

                clearChatStateNotification (from, isodate) {
                    if (isodate) {
                        _.each(
                            sizzle(`.chat-state-notification[data-csn="${from}"][data-isodate="${isodate}"]`, this.content),
                            u.removeElement
                        );
                    } else {
                        _.each(sizzle(`.chat-state-notification[data-csn="${from}"]`, this.content), u.removeElement);
                    }
                },

                showChatStateNotification (message) {
                    /* Support for XEP-0085, Chat State Notifications */
                    let text;
                    const from = message.get('from');
                    const data = `data-csn=${from}`;
                    this.clearChatStateNotification(from);

                    if (message.get('chat_state') === _converse.COMPOSING) {
                        if (message.get('sender') === 'me') {
                            text = __('Typing from another device');
                        } else {
                            text = message.get('fullname')+' '+__('is typing');
                        }
                    } else if (message.get('chat_state') === _converse.PAUSED) {
                        if (message.get('sender') === 'me') {
                            text = __('Stopped typing on the other device');
                        } else {
                            text = message.get('fullname')+' '+__('has stopped typing');
                        }
                    } else if (message.get('chat_state') === _converse.GONE) {
                        text = message.get('fullname')+' '+__('has gone away');
                    } else {
                        return;
                    }
                    const isodate = moment().format();
                    this.content.insertAdjacentHTML(
                        'beforeend',
                        tpl_csn({
                            'message': text,
                            'from': from,
                            'isodate': isodate
                        }));
                    this.scrollDown();

                    this.clear_status_timeout = window.setTimeout(
                        this.clearChatStateNotification.bind(this, from, isodate),
                        30000
                    );
                    return message;
                },

                shouldShowOnTextMessage () {
                    return !u.isVisible(this.el);
                },

                handleTextMessage (message) {
                    this.showMessage(_.clone(message.attributes));
                    if (u.isNewMessage(message)) {
                        if (message.get('sender') === 'me') {
                            // We remove the "scrolled" flag so that the chat area
                            // gets scrolled down. We always want to scroll down
                            // when the user writes a message as opposed to when a
                            // message is received.
                            this.model.set('scrolled', false);
                        } else if (this.model.get('scrolled', true)) {
                            this.showNewMessagesIndicator();
                        }
                    }
                    if (this.shouldShowOnTextMessage()) {
                        this.show();
                    } else {
                        this.scrollDown();
                    }
                },

                handleErrorMessage (message) {
                    const message_el = this.content.querySelector(`[data-msgid="${message.get('msgid')}"]`);
                    if (!_.isNull(message_el)) {
                        message_el.insertAdjacentHTML(
                            'afterend',
                            tpl_info({
                                'extra_classes': 'chat-error',
                                'message': message.get('message'),
                                'isodate': moment().format(),
                                'data': ''
                            }));
                        this.scrollDown();
                    }
                },

                onMessageAdded (message) {
                    /* Handler that gets called when a new message object is created.
                     *
                     * Parameters:
                     *    (Object) message - The message Backbone object that was added.
                     */
                    if (!_.isUndefined(this.clear_status_timeout)) {
                        window.clearTimeout(this.clear_status_timeout);
                        delete this.clear_status_timeout;
                    }
                    if (message.get('type') === 'error') {
                        this.handleErrorMessage(message);
                    } else {
                        if (message.get('chat_state')) {
                            this.showChatStateNotification(message);
                        }
                        if (message.get('message')) {
                            this.handleTextMessage(message);
                        }
                    }
                    _converse.emit('messageAdded', {
                        'message': message,
                        'chatbox': this.model
                    });
                },

                createMessageStanza (message) {
                    const stanza = $msg({
                            'from': _converse.connection.jid,
                            'to': this.model.get('jid'),
                            'type': 'chat',
                            'id': message.get('msgid')
                        }).c('body').t(message.get('message')).up()
                          .c(_converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();

                    if (message.get('is_spoiler')) {
                        if (message.get('spoiler_hint')) {
                            stanza.c('spoiler', {'xmlns': Strophe.NS.SPOILER }, message.get('spoiler_hint'));
                        } else {
                            stanza.c('spoiler', {'xmlns': Strophe.NS.SPOILER });
                        }
                    }
                    return stanza;
                },

                sendMessage (message, file = null) {
                    /* Responsible for sending off a text message.
                     *
                     *  Parameters:
                     *    (Message) message - The chat message
                     */
                    // TODO: We might want to send to specfic resources.
                    // Especially in the OTR case.
                    var messageStanza;
                    if (file !== null) {
                        messageStanza = this.model.createFileMessageStanza(message, this.model.get('jid'));
                    }
                    else {
                        messageStanza = this.createMessageStanza(message);
                    }
                    _converse.connection.send(messageStanza);
                    if (_converse.forward_messages) {
                        // Forward the message, so that other connected resources are also aware of it.
                        _converse.connection.send(
                            $msg({ to: _converse.bare_jid, type: 'chat', id: message.get('msgid') })
                            .c('forwarded', {'xmlns': Strophe.NS.FORWARD})
                            .c('delay', {
                                'xmns': Strophe.NS.DELAY,
                                'stamp': moment().format()
                            }).up()
                            .cnode(messageStanza.tree())
                        );
                    }
                },

                parseMessageForCommands (text) {
                    const match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/);
                    if (match) {
                        if (match[1] === "clear") {
                            this.clearMessages();
                            return true;
                        }
                        else if (match[1] === "help") {
                            const msgs = [
                                `<strong>/clear</strong>: ${__('Remove messages')}`,
                                `<strong>/me</strong>: ${__('Write in the third person')}`,
                                `<strong>/help</strong>: ${__('Show this menu')}`
                                ];
                            this.showHelpMessages(msgs);
                            return true;
                        }
                    }
                },

                onMessageSubmitted (text, spoiler_hint, file = null) {
                    /* This method gets called once the user has typed a message
                     * and then pressed enter in a chat box.
                     *
                     *  Parameters:
                     *    (String) text - The chat message text.
                     *    (String) spoiler_hint - A hint in case the message
                     *      text is a hidden/spoiler message. See XEP-0382
                     */
                    if (!_converse.connection.authenticated) {
                        return this.showHelpMessages(
                            ['Sorry, the connection has been lost, '+
                                'and your message could not be sent'],
                            'error'
                        );
                    }
                    if (this.parseMessageForCommands(text)) {
                        return;
                    }
                    const attrs = this.getOutgoingMessageAttributes(text, spoiler_hint);
                    const message = this.model.messages.create(attrs);
                    this.sendMessage(message, file);
                },

                getOutgoingMessageAttributes (text, spoiler_hint) {
                    /* Overridable method which returns the attributes to be
                     * passed to Backbone.Message's constructor.
                     */
                    const fullname = _converse.xmppstatus.get('fullname'),
                        is_spoiler = this.model.get('composing_spoiler'),
                        attrs = {
                            'fullname': _.isEmpty(fullname) ? _converse.bare_jid : fullname,
                            'sender': 'me',
                            'time': moment().format(),
                            'message': u.httpToGeoUri(emojione.shortnameToUnicode(text), _converse),
                            'is_spoiler': is_spoiler
                        };
                    if (is_spoiler) {
                        attrs.spoiler_hint = spoiler_hint;
                    }
                    return attrs;
                },

                sendChatState () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    _converse.connection.send(
                        $msg({'to':this.model.get('jid'), 'type': 'chat'})
                            .c(this.model.get('chat_state'), {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },

                setChatState (state, no_save) {
                    /* Mutator for setting the chat state of this chat session.
                     * Handles clearing of any chat state notification timeouts and
                     * setting new ones if necessary.
                     * Timeouts are set when the  state being set is COMPOSING or PAUSED.
                     * After the timeout, COMPOSING will become PAUSED and PAUSED will become INACTIVE.
                     * See XEP-0085 Chat State Notifications.
                     *
                     *  Parameters:
                     *    (string) state - The chat state (consts ACTIVE, COMPOSING, PAUSED, INACTIVE, GONE)
                     *    (Boolean) no_save - Just do the cleanup or setup but don't actually save the state.
                     */
                    if (!_.isUndefined(this.chat_state_timeout)) {
                        window.clearTimeout(this.chat_state_timeout);
                        delete this.chat_state_timeout;
                    }
                    if (state === _converse.COMPOSING) {
                        this.chat_state_timeout = window.setTimeout(
                            this.setChatState.bind(this),
                            _converse.TIMEOUTS.PAUSED,
                            _converse.PAUSED
                        );
                    } else if (state === _converse.PAUSED) {
                        this.chat_state_timeout = window.setTimeout(
                            this.setChatState.bind(this),
                            _converse.TIMEOUTS.INACTIVE,
                            _converse.INACTIVE
                        );
                    }
                    if (!no_save && this.model.get('chat_state') !== state) {
                        this.model.set('chat_state', state);
                    }
                    return this;
                },

                onFormSubmitted (ev) {
                    ev.preventDefault();
                    const textarea = this.el.querySelector('.chat-textarea'),
                          message = textarea.value;

                    let spoiler_hint;
                    if (this.model.get('composing_spoiler')) {
                        const hint_el = this.el.querySelector('form.sendXMPPMessage input.spoiler-hint');
                        spoiler_hint = hint_el.value;
                        hint_el.value = '';
                    }
                    textarea.value = '';
                    textarea.focus();
                    if (message !== '') {
                        this.onMessageSubmitted(message, spoiler_hint);
                        _converse.emit('messageSend', message);
                    }
                    this.setChatState(_converse.ACTIVE);
                },

                keyPressed (ev) {
                    /* Event handler for when a key is pressed in a chat box textarea.
                     */
                    if (ev.keyCode === KEY.ENTER) {
                        this.onFormSubmitted(ev);
                    } else {
                        // Set chat state to composing if keyCode is not a forward-slash
                        // (which would imply an internal command and not a message).
                        this.setChatState(_converse.COMPOSING, ev.keyCode === KEY.FORWARD_SLASH);
                    }
                },

                clearMessages (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    const result = confirm(__("Are you sure you want to clear the messages from this chat box?"));
                    if (result === true) {
                        this.content.innerHTML = '';
                        this.model.messages.reset();
                        this.model.messages.browserStorage._clear();
                    }
                    return this;
                },

                insertIntoTextArea (value) {
                    const textbox_el = this.el.querySelector('.chat-textarea');
                    let existing = textbox_el.value;
                    if (existing && (existing[existing.length-1] !== ' ')) {
                        existing = existing + ' ';
                    }
                    textbox_el.value = existing+value+' ';
                    textbox_el.focus()
                },

                createEmojiPicker () {
                    if (_.isUndefined(_converse.emojipicker)) {
                        _converse.emojipicker = new _converse.EmojiPicker();
                        _converse.emojipicker.fetch();
                    }
                    this.emoji_picker_view = new _converse.EmojiPickerView({
                        'model': _converse.emojipicker
                    });
                },

                insertEmoji (ev) {
                    ev.stopPropagation();
                    const target = ev.target.nodeName === 'IMG' ? ev.target.parentElement : ev.target;
                    this.insertIntoTextArea(target.getAttribute('data-emoji'));
                },

                toggleEmojiMenu (ev) {
                    if (_.isUndefined(this.emoji_dropdown)) {
                        ev.stopPropagation();
                        const dropdown_el = this.el.querySelector('.toggle-smiley.dropup');
                        this.emoji_dropdown = new bootstrap.Dropdown(dropdown_el, true);
                        this.emoji_dropdown.toggle();
                    }
                },

                toggleCall (ev) {
                    ev.stopPropagation();
                    _converse.emit('callButtonClicked', {
                        connection: _converse.connection,
                        model: this.model
                    });
                },

                toggleComposeSpoilerMessage () {
                    this.model.set('composing_spoiler', !this.model.get('composing_spoiler'));
                    this.renderMessageForm();
                    this.focus();
                },

                toggleSpoilerMessage (ev) {
                    if (ev && ev.preventDefault) {
                        ev.preventDefault();
                    }
                    const toggle_el = ev.target;
                    u.slideToggleElement(
                        toggle_el.parentElement.querySelector('.spoiler')
                    );
                    if (toggle_el.getAttribute("data-toggle-state") == "closed") {
                        toggle_el.textContent = __('Hide hidden message');
                        toggle_el.classList.remove("icon-eye");
                        toggle_el.classList.add("icon-eye-blocked");
                        toggle_el.setAttribute("data-toggle-state", "open");
                    } else {
                        toggle_el.textContent = __('Show hidden message');
                        toggle_el.classList.remove("icon-eye-blocked");
                        toggle_el.classList.add("icon-eye");
                        toggle_el.setAttribute("data-toggle-state", "closed");
                    }
                },

                onChatStatusChanged (item) {
                    const chat_status = item.get('chat_status');
                    let fullname = item.get('fullname');
                    let text;

                    fullname = _.isEmpty(fullname)? item.get('jid'): fullname;
                    if (u.isVisible(this.el)) {
                        if (chat_status === 'offline') {
                            text = fullname+' '+__('has gone offline');
                        } else if (chat_status === 'away') {
                            text = fullname+' '+__('has gone away');
                        } else if ((chat_status === 'dnd')) {
                            text = fullname+' '+__('is busy');
                        } else if (chat_status === 'online') {
                            text = fullname+' '+__('is online');
                        }
                        if (text) {
                            this.content.insertAdjacentHTML(
                                'beforeend',
                                tpl_status_message({
                                    'message': text,
                                    'isodate': moment().format(),
                                }));
                            this.scrollDown();
                        }
                    }
                },

                close (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (Backbone.history.getFragment() === "converse/chat?jid="+this.model.get('jid')) {
                        _converse.router.navigate('');
                    }
                    if (_converse.connection.connected) {
                        // Immediately sending the chat state, because the
                        // model is going to be destroyed afterwards.
                        this.setChatState(_converse.INACTIVE);
                        this.sendChatState();
                    }
                    try {
                        this.model.destroy();
                    } catch (e) {
                        _converse.log(e, Strophe.LogLevel.ERROR);
                    }
                    this.remove();
                    _converse.emit('chatBoxClosed', this);
                    return this;
                },

                renderEmojiPicker () {
                    this.emoji_picker_view.render();
                },

                insertEmojiPicker () {
                    var picker_el = this.el.querySelector('.emoji-picker');
                    if (!_.isNull(picker_el)) {
                        picker_el.innerHTML = '';
                        picker_el.appendChild(this.emoji_picker_view.el);
                    }
                },

                focus () {
                    const textarea_el = this.el.querySelector('.chat-textarea');
                    if (!_.isNull(textarea_el)) {
                        textarea_el.focus();
                        _converse.emit('chatBoxFocused', this);
                    }
                    return this;
                },

                hide () {
                    this.el.classList.add('hidden');
                    return this;
                },

                afterShown () {
                    if (u.isPersistableModel(this.model)) {
                        this.model.clearUnreadMsgCounter();
                        this.model.save();
                    }
                    this.setChatState(_converse.ACTIVE);
                    this.renderEmojiPicker();
                    this.scrollDown();
                    this.focus();
                },

                _show (f) {
                    /* Inner show method that gets debounced */
                    if (u.isVisible(this.el)) {
                        this.focus();
                        return;
                    }
                    u.fadeIn(this.el, _.bind(this.afterShown, this));
                },

                show () {
                    if (_.isUndefined(this.debouncedShow)) {
                        /* We wrap the method in a debouncer and set it on the
                         * instance, so that we have it debounced per instance.
                         * Debouncing it on the class-level is too broad.
                         */
                        this.debouncedShow = _.debounce(this._show, 250, {'leading': true});
                    }
                    this.debouncedShow.apply(this, arguments);
                    return this;
                },

                showNewMessagesIndicator () {
                    u.showElement(this.el.querySelector('.new-msgs-indicator'));
                },

                hideNewMessagesIndicator () {
                    const new_msgs_indicator = this.el.querySelector('.new-msgs-indicator');
                    if (!_.isNull(new_msgs_indicator)) {
                        new_msgs_indicator.classList.add('hidden');
                    }
                },

                _markScrolled: function (ev) {
                    /* Called when the chat content is scrolled up or down.
                     * We want to record when the user has scrolled away from
                     * the bottom, so that we don't automatically scroll away
                     * from what the user is reading when new messages are
                     * received.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    let scrolled = true;
                    const is_at_bottom =
                        (this.content.scrollTop + this.content.clientHeight) >=
                            this.content.scrollHeight - 62; // sigh...

                    if (is_at_bottom) {
                        scrolled = false;
                        this.onScrolledDown();
                    }
                    u.safeSave(this.model, {
                        'scrolled': scrolled,
                        'top_visible_message': null
                    });
                },

                viewUnreadMessages () {
                    this.model.save({
                        'scrolled': false,
                        'top_visible_message': null
                    });
                    this.scrollDown();
                },

                _scrollDown () {
                    /* Inner method that gets debounced */
                    if (_.isUndefined(this.content)) {
                        return;
                    }
                    if (u.isVisible(this.content) && !this.model.get('scrolled')) {
                        this.content.scrollTop = this.content.scrollHeight;
                    }
                },

                onScrolledDown () {
                    this.hideNewMessagesIndicator();
                    if (_converse.windowState !== 'hidden') {
                        this.model.clearUnreadMsgCounter();
                    }
                    _converse.emit('chatBoxScrolledDown', {'chatbox': this.model});
                },

                onWindowStateChanged (state) {
                    if (this.model.get('num_unread', 0) && !this.model.newMessageWillBeHidden()) {
                        this.model.clearUnreadMsgCounter();
                    }
                }
            });

            _converse.on('connected', () => {
                // Advertise that we support XEP-0382 Message Spoilers
                _converse.connection.disco.addFeature(Strophe.NS.SPOILER);
            });

            /************************ BEGIN API ************************/
            _.extend(_converse.api, {
                'chatviews': {
                    'get' (jids) {
                        if (_.isUndefined(jids)) {
                            _converse.log(
                                "chats.create: You need to provide at least one JID",
                                Strophe.LogLevel.ERROR
                            );
                            return null;
                        }
                        if (_.isString(jids)) {
                            return _converse.chatboxviews.get(jids);
                        }
                        return _.map(jids, (jid) => _converse.chatboxviews.get(jids));
                    }
                }
            });
            /************************ END API ************************/
        }
    });

    return converse;
}));
