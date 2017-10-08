// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define([
            "jquery.noconflict",
            "converse-core",
            "converse-chatboxes",
            "emojione",
            "xss",
            "tpl!chatbox",
            "tpl!new_day",
            "tpl!action",
            "tpl!emojis",
            "tpl!message",
            "tpl!help_message",
            "tpl!toolbar",
            "tpl!avatar",
            "tpl!spinner"
    ], factory);
}(this, function (
            $,
            converse,
            dummy,
            emojione,
            xss,
            tpl_chatbox,
            tpl_new_day,
            tpl_action,
            tpl_emojis,
            tpl_message,
            tpl_help_message,
            tpl_toolbar,
            tpl_avatar,
            tpl_spinner
    ) {
    "use strict";
    const { $msg, Backbone, Strophe, _, b64_sha1, moment, utils } = converse.env;

    const KEY = {
        ENTER: 13,
        FORWARD_SLASH: 47
    };

    converse.plugins.add('converse-chatview', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
            //
            registerGlobalEventHandlers: function () {
                this.__super__.registerGlobalEventHandlers();
                document.addEventListener(
                    'click', function (ev) {
                        if (_.includes(ev.target.classList, 'toggle-toolbar-menu') ||
                            _.includes(ev.target.classList, 'insert-emoji')) {
                            return;
                        }
                        utils.slideInAllElements(
                            document.querySelectorAll('.toolbar-menu')
                        )
                    }
                );
            },

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
                'use_emojione': true,
                'emojione_image_path': emojione.imagePathPNG,
                'chatview_avatar_height': 32,
                'chatview_avatar_width': 32,
                'show_toolbar': true,
                'time_format': 'HH:mm',
                'visible_toolbar_buttons': {
                    'emoji': true,
                    'call': false,
                    'clear': true
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

            _converse.EmojiPickerView = Backbone.View.extend({
                className: 'emoji-picker-container toolbar-menu collapsed',
                events: {
                    'click .emoji-category-picker li.emoji-category': 'chooseCategory',
                    'click .emoji-skintone-picker li.emoji-skintone': 'chooseSkinTone'
                },

                initialize () {
                    this.model.on('change:current_skintone', this.render, this);
                    this.model.on('change:current_category', this.render, this);
                    this.setScrollPosition = _.debounce(this.setScrollPosition, 50);
                },

                render () {
                    var emojis_html = tpl_emojis(
                        _.extend(
                            this.model.toJSON(), {
                                'transform': _converse.use_emojione ? emojione.shortnameToImage : emojione.shortnameToUnicode,
                                'emojis_by_category': utils.getEmojisByCategory(_converse, emojione),
                                'toned_emojis': utils.getTonedEmojis(_converse),
                                'skintones': ['tone1', 'tone2', 'tone3', 'tone4', 'tone5'],
                                'shouldBeHidden': this.shouldBeHidden
                            }
                        ));
                    this.el.innerHTML = emojis_html;
                    _.forEach(this.el.querySelectorAll('.emoji-picker'), (el) => {
                        el.addEventListener('scroll', this.setScrollPosition.bind(this));
                    });
                    this.restoreScrollPosition();
                    return this;
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

                restoreScrollPosition () {
                    const current_picker = _.difference(
                        this.el.querySelectorAll('.emoji-picker'),
                        this.el.querySelectorAll('.emoji-picker.hidden')
                    );
                    if (current_picker.length === 1 && this.model.get('scroll_position')) {
                        current_picker[0].scrollTop = this.model.get('scroll_position');
                    }
                },

                setScrollPosition (ev) {
                    this.model.save('scroll_position', ev.target.scrollTop);
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

            _converse.ChatBoxView = Backbone.View.extend({
                length: 200,
                tagName: 'div',
                className: 'chatbox hidden',
                is_chatroom: false,  // Leaky abstraction from MUC

                events: {
                    'click .close-chatbox-button': 'close',
                    'keypress .chat-textarea': 'keyPressed',
                    'click .send-button': 'onFormSubmitted',
                    'click .toggle-smiley': 'toggleEmojiMenu',
                    'click .toggle-smiley ul.emoji-picker li': 'insertEmoji',
                    'click .toggle-clear': 'clearMessages',
                    'click .toggle-call': 'toggleCall',
                    'click .new-msgs-indicator': 'viewUnreadMessages'
                },

                initialize () {
                    this.markScrolled = _.debounce(this.markScrolled, 100);

                    this.createEmojiPicker();
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    // TODO check for changed fullname as well
                    this.model.on('change:chat_state', this.sendChatState, this);
                    this.model.on('change:chat_status', this.onChatStatusChanged, this);
                    this.model.on('change:image', this.renderAvatar, this);
                    this.model.on('change:status', this.onStatusChanged, this);
                    this.model.on('showHelpMessages', this.showHelpMessages, this);
                    this.model.on('sendMessage', this.sendMessage, this);
                    this.render().fetchMessages();
                    _converse.emit('chatBoxInitialized', this);
                },

                render () {
                    this.$el.attr('id', this.model.get('box_id'))
                        .html(tpl_chatbox(
                                _.extend(this.model.toJSON(), {
                                        show_toolbar: _converse.show_toolbar,
                                        show_textarea: true,
                                        show_send_button: _converse.show_send_button,
                                        title: this.model.get('fullname'),
                                        unread_msgs: __('You have unread messages'),
                                        info_close: __('Close this chat box'),
                                        label_personal_message: __('Personal message'),
                                        label_send: __('Send')
                                    }
                                )
                            )
                        );
                    this.$content = this.$el.find('.chat-content');
                    this.renderToolbar().renderAvatar();
                    _converse.emit('chatBoxOpened', this);
                    utils.refreshWebkit();
                    return this.showStatusMessage();
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

                afterMessagesFetched () {
                    this.insertIntoDOM();
                    this.scrollDown();
                    // We only start listening for the scroll event after
                    // cached messages have been fetched
                    this.$content.on('scroll', this.markScrolled.bind(this));
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
                    const container = document.querySelector('#conversejs');
                    if (this.el.parentNode !== container) {
                        container.insertBefore(this.el, container.firstChild);
                    }
                    return this;
                },

                clearStatusNotification () {
                    this.$content.find('div.chat-event').remove();
                },

                showStatusNotification (message, keep_old, permanent) {
                    if (!keep_old) {
                        this.clearStatusNotification();
                    }
                    const $el = $('<div class="chat-info"></div>').text(message);
                    if (!permanent) {
                        $el.addClass('chat-event');
                    }
                    this.$content.append($el);
                    this.scrollDown();
                },

                addSpinner () {
                    if (_.isNull(this.el.querySelector('.spinner'))) {
                        this.$content.prepend(tpl_spinner);
                    }
                },

                clearSpinner () {
                    if (this.$content.children(':first').is('span.spinner')) {
                        this.$content.children(':first').remove();
                    }
                },

                insertDayIndicator (date, prepend) {
                    /* Appends (or prepends if "prepend" is truthy) an indicator
                     * into the chat area, showing the day as given by the
                     * passed in date.
                     *
                     * Parameters:
                     *  (String) date - An ISO8601 date string.
                     */
                    const day_date = moment(date).startOf('day');
                    const insert = prepend ? this.$content.prepend: this.$content.append;
                    insert.call(this.$content, tpl_new_day({
                        isodate: day_date.format(),
                        datestring: day_date.format("dddd MMM Do YYYY")
                    }));
                },

                insertMessage (attrs, prepend) {
                    /* Helper method which appends a message (or prepends if the
                     * 2nd parameter is set to true) to the end of the chat box's
                     * content area.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     */
                    const insert = prepend ? this.$content.prepend : this.$content.append;
                    _.flow(($el) => {
                            insert.call(this.$content, $el);
                            return $el;
                        },
                        this.scrollDown.bind(this)
                    )(this.renderMessage(attrs));
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
                    let current_msg_date = moment(attrs.time) || moment;
                    const $first_msg = this.$content.find('.chat-message:first'),
                          first_msg_date = $first_msg.data('isodate');

                    if (!first_msg_date) {
                        // This is the first received message, so we insert a
                        // date indicator before it.
                        this.insertDayIndicator(current_msg_date);
                        this.insertMessage(attrs);
                        return;
                    }

                    const last_msg_date = this.$content.find('.chat-message:last').data('isodate');
                    if (current_msg_date.isAfter(last_msg_date) ||
                            current_msg_date.isSame(last_msg_date)) {
                        // The new message is after the last message
                        if (current_msg_date.isAfter(last_msg_date, 'day')) {
                            // Append a new day indicator
                            this.insertDayIndicator(current_msg_date);
                        }
                        this.insertMessage(attrs);
                        return;
                    }
                    if (current_msg_date.isBefore(first_msg_date) ||
                            current_msg_date.isSame(first_msg_date)) {
                        // The message is before the first, but on the same day.
                        // We need to prepend the message immediately before the
                        // first message (so that it'll still be after the day
                        // indicator).
                        this.insertMessage(attrs, 'prepend');
                        if (current_msg_date.isBefore(first_msg_date, 'day')) {
                            // This message is also on a different day, so
                            // we prepend a day indicator.
                            this.insertDayIndicator(current_msg_date, 'prepend');
                        }
                        return;
                    }
                    // Find the correct place to position the message
                    current_msg_date = current_msg_date.format();
                    const msg_dates = _.map(
                        this.$content.find('.chat-message'),
                        (el) => $(el).data('isodate')
                    );
                    msg_dates.push(current_msg_date);
                    msg_dates.sort();

                    const idx = msg_dates.indexOf(current_msg_date)-1;
                    const $latest_message = this.$content.find(`.chat-message[data-isodate="${msg_dates[idx]}"]:last`);
                    _.flow(($el) => {
                            $el.insertAfter($latest_message);
                            return $el;
                        },
                        this.scrollDown.bind(this)
                    )(this.renderMessage(attrs));
                },

                getExtraMessageTemplateAttributes () {
                    /* Provides a hook for sending more attributes to the
                     * message template.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing message attributes.
                     */
                    return {};
                },

                getExtraMessageClasses (attrs) {
                    return attrs.delayed && 'delayed' || '';
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
                    } else  {
                        template = tpl_message;
                        username = attrs.sender === 'me' && __('me') || fullname;
                    }
                    this.$content.find('div.chat-event').remove();

                    if (text.length > 8000) {
                        text = text.substring(0, 10) + '...';
                        this.showStatusNotification(
                            __("A very large message has been received."+
                               "This might be due to an attack meant to degrade the chat performance."+
                               "Output has been shortened."),
                            true, true);
                    }
                    const msg_time = moment(attrs.time) || moment;
                    const $msg = $(template(
                        _.extend(this.getExtraMessageTemplateAttributes(attrs), {
                            'msgid': attrs.msgid,
                            'sender': attrs.sender,
                            'time': msg_time.format(_converse.time_format),
                            'isodate': msg_time.format(),
                            'username': username,
                            'extra_classes': this.getExtraMessageClasses(attrs)
                        })
                    ));
                    const msg_content = $msg[0].querySelector('.chat-msg-content');
                    msg_content.innerHTML = utils.addEmoji(
                        _converse, emojione, utils.addHyperlinks(xss.filterXSS(text, {'whiteList': {}}))
                    );
                    utils.renderImageURLs(msg_content);
                    return $msg;
                },

                showHelpMessages (msgs, type, spinner) {
                    _.each(msgs, (msg) => {
                        this.$content.append($(tpl_help_message({
                            'type': type||'info',
                            'message': msgs
                        })));
                    });
                    if (spinner === true) {
                        this.$content.append(tpl_spinner);
                    } else if (spinner === false) {
                        this.$content.find('span.spinner').remove();
                    }
                    return this.scrollDown();
                },

                handleChatStateMessage (message) {
                    if (message.get('chat_state') === _converse.COMPOSING) {
                        if (message.get('sender') === 'me') {
                            this.showStatusNotification(__('Typing from another device'));
                        } else {
                            this.showStatusNotification(message.get('fullname')+' '+__('is typing'));
                        }
                        this.clear_status_timeout = window.setTimeout(this.clearStatusNotification.bind(this), 30000);
                    } else if (message.get('chat_state') === _converse.PAUSED) {
                        if (message.get('sender') === 'me') {
                            this.showStatusNotification(__('Stopped typing on the other device'));
                        } else {
                            this.showStatusNotification(message.get('fullname')+' '+__('has stopped typing'));
                        }
                    } else if (_.includes([_converse.INACTIVE, _converse.ACTIVE], message.get('chat_state'))) {
                        this.$content.find('div.chat-event').remove();
                    } else if (message.get('chat_state') === _converse.GONE) {
                        this.showStatusNotification(message.get('fullname')+' '+__('has gone away'));
                    }
                },

                shouldShowOnTextMessage () {
                    return !this.$el.is(':visible');
                },

                handleTextMessage (message) {
                    this.showMessage(_.clone(message.attributes));
                    if (utils.isNewMessage(message) && message.get('sender') === 'me') {
                        // We remove the "scrolled" flag so that the chat area
                        // gets scrolled down. We always want to scroll down
                        // when the user writes a message as opposed to when a
                        // message is received.
                        this.model.set('scrolled', false);
                    } else {
                        if (utils.isNewMessage(message) && this.model.get('scrolled', true)) {
                            this.$el.find('.new-msgs-indicator').removeClass('hidden');
                        }
                    }
                    if (this.shouldShowOnTextMessage()) {
                        this.show();
                    } else {
                        this.scrollDown();
                    }
                },

                handleErrorMessage (message) {
                    const $message = $(`[data-msgid=${message.get('msgid')}]`);
                    if ($message.length) {
                        $message.after($('<div class="chat-info chat-error"></div>').text(message.get('message')));
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
                    } else if (!message.get('message')) {
                        this.handleChatStateMessage(message);
                    } else {
                        this.handleTextMessage(message);
                    }
                    _converse.emit('messageAdded', {
                        'message': message,
                        'chatbox': this.model
                    });
                },

                createMessageStanza (message) {
                    return $msg({
                                from: _converse.connection.jid,
                                to: this.model.get('jid'),
                                type: 'chat',
                                id: message.get('msgid')
                        }).c('body').t(message.get('message')).up()
                            .c(_converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();
                },

                sendMessage (message) {
                    /* Responsible for sending off a text message.
                     *
                     *  Parameters:
                     *    (Message) message - The chat message
                     */
                    // TODO: We might want to send to specfic resources.
                    // Especially in the OTR case.
                    const messageStanza = this.createMessageStanza(message);
                    _converse.connection.send(messageStanza);
                    if (_converse.forward_messages) {
                        // Forward the message, so that other connected resources are also aware of it.
                        _converse.connection.send(
                            $msg({ to: _converse.bare_jid, type: 'chat', id: message.get('msgid') })
                            .c('forwarded', {xmlns:'urn:xmpp:forward:0'})
                            .c('delay', {xmns:'urn:xmpp:delay',stamp:(new Date()).getTime()}).up()
                            .cnode(messageStanza.tree())
                        );
                    }
                },

                onMessageSubmitted (text) {
                    /* This method gets called once the user has typed a message
                     * and then pressed enter in a chat box.
                     *
                     *  Parameters:
                     *    (string) text - The chat message text.
                     */
                    if (!_converse.connection.authenticated) {
                        return this.showHelpMessages(
                            ['Sorry, the connection has been lost, '+
                                'and your message could not be sent'],
                            'error'
                        );
                    }
                    const match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/);
                    if (match) {
                        if (match[1] === "clear") {
                            return this.clearMessages();
                        }
                        else if (match[1] === "help") {
                            const msgs = [
                                `<strong>/help</strong>:${__('Show this menu')}`,
                                `<strong>/me</strong>:${__('Write in the third person')}`,
                                `<strong>/clear</strong>:${__('Remove messages')}`
                                ];
                            this.showHelpMessages(msgs);
                            return;
                        }
                    }
                    let fullname = _converse.xmppstatus.get('fullname');
                    fullname = _.isEmpty(fullname)? _converse.bare_jid: fullname;

                    const message = this.model.messages.create({
                        fullname,
                        sender: 'me',
                        time: moment().format(),
                        message: text
                    });
                    this.sendMessage(message);
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
                            this.setChatState.bind(this), _converse.TIMEOUTS.PAUSED, _converse.PAUSED);
                    } else if (state === _converse.PAUSED) {
                        this.chat_state_timeout = window.setTimeout(
                            this.setChatState.bind(this), _converse.TIMEOUTS.INACTIVE, _converse.INACTIVE);
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
                    textarea.value = '';
                    textarea.focus();
                    if (message !== '') {
                        this.onMessageSubmitted(message);
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
                        this.$content.empty();
                        this.model.messages.reset();
                        this.model.messages.browserStorage._clear();
                    }
                    return this;
                },

                insertIntoTextArea (value) {
                    const $textbox = this.$el.find('textarea.chat-textarea');
                    let existing = $textbox.val();
                    if (existing && (existing[existing.length-1] !== ' ')) {
                        existing = existing + ' ';
                    }
                    $textbox.focus().val(existing+value+' ');
                },

                insertEmoji (ev) {
                    ev.stopPropagation();
                    this.toggleEmojiMenu();
                    const target = ev.target.nodeName === 'IMG' ? ev.target.parentElement : ev.target;
                    this.insertIntoTextArea(target.getAttribute('data-emoji'));
                },

                toggleEmojiMenu (ev) {
                    if (!_.isUndefined(ev)) {
                        ev.stopPropagation();
                        if (ev.target.classList.contains('emoji-category-picker') ||
                            ev.target.classList.contains('emoji-skintone-picker') ||
                                ev.target.classList.contains('emoji-category')) {
                            return;
                        }
                    }
                    const elements = _.difference(
                        document.querySelectorAll('.toolbar-menu'),
                        [this.emoji_picker_view.el]
                    );
                    utils.slideInAllElements(elements).then(
                        _.partial(
                            utils.slideToggleElement,
                            this.emoji_picker_view.el
                        )
                    );
                },

                toggleCall (ev) {
                    ev.stopPropagation();
                    _converse.emit('callButtonClicked', {
                        connection: _converse.connection,
                        model: this.model
                    });
                },

                onChatStatusChanged (item) {
                    const chat_status = item.get('chat_status');
                    let fullname = item.get('fullname');
                    fullname = _.isEmpty(fullname)? item.get('jid'): fullname;
                    if (this.$el.is(':visible')) {
                        if (chat_status === 'offline') {
                            this.showStatusNotification(fullname+' '+__('has gone offline'));
                        } else if (chat_status === 'away') {
                            this.showStatusNotification(fullname+' '+__('has gone away'));
                        } else if ((chat_status === 'dnd')) {
                            this.showStatusNotification(fullname+' '+__('is busy'));
                        } else if (chat_status === 'online') {
                            this.$el.find('div.chat-event').remove();
                        }
                    }
                },

                onStatusChanged (item) {
                    this.showStatusMessage();
                    _converse.emit('contactStatusMessageChanged', {
                        'contact': item.attributes,
                        'message': item.get('status')
                    });
                },

                showStatusMessage (msg) {
                    msg = msg || this.model.get('status');
                    if (_.isString(msg)) {
                        this.$el.find('p.user-custom-message').text(msg).attr('title', msg);
                    }
                    return this;
                },

                close (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (_converse.connection.connected) {
                        // Immediately sending the chat state, because the
                        // model is going to be destroyed afterwards.
                        this.model.set('chat_state', _converse.INACTIVE);
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

                getToolbarOptions (options) {
                    return _.extend(options || {}, {
                        'label_clear': __('Clear all messages'),
                        'label_insert_smiley': __('Insert a smiley'),
                        'label_start_call': __('Start a call'),
                        'show_call_button': _converse.visible_toolbar_buttons.call,
                        'show_clear_button': _converse.visible_toolbar_buttons.clear,
                        'use_emoji': _converse.visible_toolbar_buttons.emoji,
                    });
                },

                renderToolbar (toolbar, options) {
                    if (!_converse.show_toolbar) { return; }
                    toolbar = toolbar || tpl_toolbar;
                    options = _.assign(
                        this.model.toJSON(),
                        this.getToolbarOptions(options || {})
                    );
                    this.el.querySelector('.chat-toolbar').innerHTML = toolbar(options);

                    var toggle = this.el.querySelector('.toggle-smiley');
                    toggle.innerHTML = '';
                    toggle.appendChild(this.emoji_picker_view.render().el);
                    return this;
                },

                renderAvatar () {
                    if (!this.model.get('image')) {
                        return;
                    }
                    const width = _converse.chatview_avatar_width;
                    const height = _converse.chatview_avatar_height;
                    const img_src = `data:${this.model.get('image_type')};base64,${this.model.get('image')}`,
                        canvas = $(tpl_avatar({
                            'width': width,
                            'height': height
                        })).get(0);

                    if (!(canvas.getContext && canvas.getContext('2d'))) {
                        return this;
                    }
                    const ctx = canvas.getContext('2d');
                    const img = new Image();   // Create new Image object
                    img.onload = function () {
                        const ratio = img.width/img.height;
                        if (ratio < 1) {
                            ctx.drawImage(img, 0,0, width, height*(1/ratio));
                        } else {
                            ctx.drawImage(img, 0,0, width, height*ratio);
                        }

                    };
                    img.src = img_src;
                    this.$el.find('.chat-title').before(canvas);
                    return this;
                },

                focus () {
                    this.$el.find('.chat-textarea').focus();
                    _converse.emit('chatBoxFocused', this);
                    return this;
                },

                hide () {
                    this.el.classList.add('hidden');
                    utils.refreshWebkit();
                    return this;
                },

                afterShown (focus) {
                    if (utils.isPersistableModel(this.model)) {
                        this.model.save();
                    }
                    this.setChatState(_converse.ACTIVE);
                    this.scrollDown();
                    if (focus) {
                        this.focus();
                    }
                },

                _show (focus) {
                    /* Inner show method that gets debounced */
                    if (this.$el.is(':visible') && this.$el.css('opacity') === "1") {
                        if (focus) { this.focus(); }
                        return;
                    }
                    utils.fadeIn(this.el, _.bind(this.afterShown, this, focus));
                },

                show (focus) {
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

                hideNewMessagesIndicator () {
                    const new_msgs_indicator = this.el.querySelector('.new-msgs-indicator');
                    if (!_.isNull(new_msgs_indicator)) {
                        new_msgs_indicator.classList.add('hidden');
                    }
                },

                markScrolled: function (ev) {
                    /* Called when the chat content is scrolled up or down.
                     * We want to record when the user has scrolled away from
                     * the bottom, so that we don't automatically scroll away
                     * from what the user is reading when new messages are
                     * received.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (this.model.get('auto_scrolled')) {
                        this.model.set({
                            'scrolled': false,
                            'auto_scrolled': false
                        });
                        return;
                    }
                    let scrolled = true;
                    const is_at_bottom =
                        (this.$content.scrollTop() + this.$content.innerHeight()) >=
                            this.$content[0].scrollHeight-10;

                    if (is_at_bottom) {
                        scrolled = false;
                        this.onScrolledDown();
                    }
                    utils.safeSave(this.model, {'scrolled': scrolled});
                },

                viewUnreadMessages () {
                    this.model.save('scrolled', false);
                    this.scrollDown();
                },

                _scrollDown () {
                    /* Inner method that gets debounced */
                    if (this.$content.is(':visible') && !this.model.get('scrolled')) {
                        this.$content.scrollTop(this.$content[0].scrollHeight);
                        this.onScrolledDown();
                        this.model.save({'auto_scrolled': true});
                    }
                },

                onScrolledDown() {
                    this.hideNewMessagesIndicator();
                    if (_converse.windowState !== 'hidden') {
                        this.model.clearUnreadMsgCounter();
                    }
                    _converse.emit('chatBoxScrolledDown', {'chatbox': this.model});
                },

                scrollDown () {
                    if (_.isUndefined(this.debouncedScrollDown)) {
                        /* We wrap the method in a debouncer and set it on the
                         * instance, so that we have it debounced per instance.
                         * Debouncing it on the class-level is too broad.
                         */
                        this.debouncedScrollDown = _.debounce(this._scrollDown, 250);
                    }
                    this.debouncedScrollDown.apply(this, arguments);
                    return this;
                },

                onWindowStateChanged (state) {
                    if (this.model.get('num_unread', 0) && !this.model.newMessageWillBeHidden()) {
                        this.model.clearUnreadMsgCounter();
                    }
                }
            });
        }
    });

    return converse;
}));
