// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

(function (root, factory) {
    define("converse-chatview", ["converse-core", "converse-api"], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var $ = converse_api.env.jQuery,
        utils = converse_api.env.utils,
        Strophe = converse_api.env.Strophe,
        $msg = converse_api.env.$msg,
        _ = converse_api.env._,
        __ = utils.__.bind(converse),
        moment = converse_api.env.moment;

    var KEY = {
        ENTER: 13,
        FORWARD_SLASH: 47
    };


    converse_api.plugins.add('converse-chatview', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view) {
                        view = new converse.ChatBoxView({model: item});
                        this.add(item.get('id'), view);
                        return view;
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            this.updateSettings({
                show_toolbar: true,
            });

            converse.ChatBoxView = Backbone.View.extend({
                length: 200,
                tagName: 'div',
                className: 'chatbox',
                is_chatroom: false,  // This is not a multi-user chatroom

                events: {
                    'click .close-chatbox-button': 'close',
                    'keypress textarea.chat-textarea': 'keyPressed',
                    'click .toggle-smiley': 'toggleEmoticonMenu',
                    'click .toggle-smiley ul li': 'insertEmoticon',
                    'click .toggle-clear': 'clearMessages',
                    'click .toggle-call': 'toggleCall',
                    'click .new-msgs-indicator': 'viewUnreadMessages'
                },

                initialize: function () {
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
                    this.render().fetchMessages().insertIntoDOM().afterShown();
                    // XXX: adding the event below to the events map above doesn't work.
                    // The code that gets executed because of that looks like this:
                    //      this.$el.on('scroll', '.chat-content', this.markScrolled.bind(this));
                    // Which for some reason doesn't work.
                    // So working around that fact here:
                    this.$el.find('.chat-content').on('scroll', this.markScrolled.bind(this));
                    converse.emit('chatBoxInitialized', this);
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                        .html(converse.templates.chatbox(
                                _.extend(this.model.toJSON(), {
                                        show_toolbar: converse.show_toolbar,
                                        show_textarea: true,
                                        title: this.model.get('fullname'),
                                        unread_msgs: __('You have unread messages'),
                                        info_close: __('Close this chat box'),
                                        label_personal_message: __('Personal message')
                                    }
                                )
                            )
                        );
                    this.$content = this.$el.find('.chat-content');
                    this.renderToolbar().renderAvatar();
                    converse.emit('chatBoxOpened', this);
                    window.setTimeout(utils.refreshWebkit, 50);
                    return this.showStatusMessage();
                },

                afterMessagesFetched: function () {
                    // Provides a hook for plugins, such as converse-mam.
                    return;
                },

                fetchMessages: function () {
                    this.model.messages.fetch({
                        'add': true,
                        'success': this.afterMessagesFetched.bind(this)
                    });
                    return this;
                },

                insertIntoDOM: function () {
                    /* This method gets overridden in src/converse-controlbox.js if
                     * the controlbox plugin is active.
                     */
                    $('#conversejs').prepend(this.$el);
                    return this;
                },

                clearStatusNotification: function () {
                    this.$content.find('div.chat-event').remove();
                },

                showStatusNotification: function (message, keep_old, permanent) {
                    if (!keep_old) {
                        this.clearStatusNotification();
                    }
                    var $el = $('<div class="chat-info"></div>').text(message);
                    if (!permanent) {
                        $el.addClass('chat-event');
                    }
                    this.$content.append($el);
                    this.scrollDown();
                },

                addSpinner: function () {
                    if (!this.$content.first().hasClass('spinner')) {
                        this.$content.prepend('<span class="spinner"/>');
                    }
                },

                clearSpinner: function () {
                    if (this.$content.children(':first').is('span.spinner')) {
                        this.$content.children(':first').remove();
                    }
                },

                insertDayIndicator: function (date, prepend) {
                    /* Appends (or prepends if "prepend" is truthy) an indicator
                     * into the chat area, showing the day as given by the
                     * passed in date.
                     *
                     * Parameters:
                     *  (String) date - An ISO8601 date string.
                     */
                    var day_date = moment(date).startOf('day');
                    var insert = prepend ? this.$content.prepend: this.$content.append;
                    insert.call(this.$content, converse.templates.new_day({
                        isodate: day_date.format(),
                        datestring: day_date.format("dddd MMM Do YYYY")
                    }));
                },

                insertMessage: function (attrs, prepend) {
                    /* Helper method which appends a message (or prepends if the
                     * 2nd parameter is set to true) to the end of the chat box's
                     * content area.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     */
                    var insert = prepend ? this.$content.prepend : this.$content.append;
                    _.compose(
                        this.scrollDownMessageHeight.bind(this),
                        function ($el) {
                            insert.call(this.$content, $el);
                            return $el;
                        }.bind(this)
                    )(this.renderMessage(attrs));
                },

                showMessage: function (attrs) {
                    /* Inserts a chat message into the content area of the chat box.
                     * Will also insert a new day indicator if the message is on a
                     * different day.
                     *
                     * The message to show may either be newer than the newest
                     * message, or older than the oldest message.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     */
                    var msg_dates, idx,
                        $first_msg = this.$content.children('.chat-message:first'),
                        first_msg_date = $first_msg.data('isodate'),
                        current_msg_date = moment(attrs.time) || moment,
                        last_msg_date = this.$content.children('.chat-message:last').data('isodate');

                    if (!first_msg_date) {
                        // This is the first received message, so we insert a
                        // date indicator before it.
                        this.insertDayIndicator(current_msg_date);
                        this.insertMessage(attrs);
                        return;
                    }
                    if (current_msg_date.isAfter(last_msg_date) || current_msg_date.isSame(last_msg_date)) {
                        // The new message is after the last message
                        if (current_msg_date.isAfter(last_msg_date, 'day')) {
                            // Append a new day indicator
                            this.insertDayIndicator(current_msg_date);
                        }
                        this.insertMessage(attrs);
                        return;
                    }
                    if (current_msg_date.isBefore(first_msg_date) || current_msg_date.isSame(first_msg_date)) {
                        // The message is before the first, but on the same day.
                        // We need to prepend the message immediately before the
                        // first message (so that it'll still be after the day indicator).
                        this.insertMessage(attrs, 'prepend');
                        if (current_msg_date.isBefore(first_msg_date, 'day')) {
                            // This message is also on a different day, so we prepend a day indicator.
                            this.insertDayIndicator(current_msg_date, 'prepend');
                        }
                        return;
                    }
                    // Find the correct place to position the message
                    current_msg_date = current_msg_date.format();
                    msg_dates = _.map(this.$content.children('.chat-message'), function (el) {
                        return $(el).data('isodate');
                    });
                    msg_dates.push(current_msg_date);
                    msg_dates.sort();
                    idx = msg_dates.indexOf(current_msg_date)-1;
                    _.compose(
                            this.scrollDownMessageHeight.bind(this),
                            function ($el) {
                                $el.insertAfter(this.$content.find('.chat-message[data-isodate="'+msg_dates[idx]+'"]'));
                                return $el;
                            }.bind(this)
                        )(this.renderMessage(attrs));
                },

                getExtraMessageTemplateAttributes: function (attrs) {
                    // Provides a hook for sending more attributes to the
                    // message template.
                    return {};
                },

                renderMessage: function (attrs) {
                    /* Renders a chat message based on the passed in attributes.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     *
                     *  Returns:
                     *      The DOM element representing the message.
                     */
                    var msg_time = moment(attrs.time) || moment,
                        text = attrs.message,
                        match = text.match(/^\/(.*?)(?: (.*))?$/),
                        fullname = this.model.get('fullname') || attrs.fullname,
                        extra_classes = attrs.delayed && 'delayed' || '',
                        template, username;

                    if ((match) && (match[1] === 'me')) {
                        text = text.replace(/^\/me/, '');
                        template = converse.templates.action;
                        username = fullname;
                    } else  {
                        template = converse.templates.message;
                        username = attrs.sender === 'me' && __('me') || fullname;
                    }
                    this.$content.find('div.chat-event').remove();

                    // FIXME: leaky abstraction from MUC
                    if (this.is_chatroom && attrs.sender === 'them' && (new RegExp("\\b"+this.model.get('nick')+"\\b")).test(text)) {
                        // Add special class to mark groupchat messages in which we
                        // are mentioned.
                        extra_classes += ' mentioned';
                    }
                    if (text.length > 8000) {
                        text = text.substring(0, 10) + '...';
                        this.showStatusNotification(
                            __("A very large message has been received."+
                               "This might be due to an attack meant to degrade the chat performance."+
                               "Output has been shortened."),
                            true, true);
                    }
                    return $(template(
                            _.extend(this.getExtraMessageTemplateAttributes(attrs), {
                                'msgid': attrs.msgid,
                                'sender': attrs.sender,
                                'time': msg_time.format('hh:mm'),
                                'isodate': msg_time.format(),
                                'username': username,
                                'message': '',
                                'extra_classes': extra_classes
                            })
                        )).children('.chat-msg-content').first().text(text)
                            .addHyperlinks()
                            .addEmoticons(converse.visible_toolbar_buttons.emoticons).parent();
                },

                showHelpMessages: function (msgs, type, spinner) {
                    var i, msgs_length = msgs.length;
                    for (i=0; i<msgs_length; i++) {
                        this.$content.append($('<div class="chat-'+(type||'info')+'">'+msgs[i]+'</div>'));
                    }
                    if (spinner === true) {
                        this.$content.append('<span class="spinner"/>');
                    } else if (spinner === false) {
                        this.$content.find('span.spinner').remove();
                    }
                    return this.scrollDown();
                },

                handleChatStateMessage: function (message) {
                    if (message.get('chat_state') === converse.COMPOSING) {
                        this.showStatusNotification(message.get('fullname')+' '+__('is typing'));
                        this.clear_status_timeout = window.setTimeout(this.clearStatusNotification.bind(this), 30000);
                    } else if (message.get('chat_state') === converse.PAUSED) {
                        this.showStatusNotification(message.get('fullname')+' '+__('has stopped typing'));
                    } else if (_.contains([converse.INACTIVE, converse.ACTIVE], message.get('chat_state'))) {
                        this.$content.find('div.chat-event').remove();
                    } else if (message.get('chat_state') === converse.GONE) {
                        this.showStatusNotification(message.get('fullname')+' '+__('has gone away'));
                    }
                },

                shouldShowOnTextMessage: function () {
                    return !this.$el.is(':visible');
                },

                updateNewMessageIndicators: function (message) {
                    /* We have two indicators of new messages. The unread messages
                     * counter, which shows the number of unread messages in
                     * the document.title, and the "new messages" indicator in
                     * a chat area, if it's scrolled up so that new messages
                     * aren't visible.
                     *
                     * In both cases we ignore MAM messages.
                     */
                    if (!message.get('archive_id')) {
                        if (this.model.get('scrolled', true)) {
                            this.$el.find('.new-msgs-indicator').removeClass('hidden');
                        }
                        if (converse.windowState === 'hidden' || this.model.get('scrolled', true)) {
                            converse.incrementMsgCounter();
                        }
                    }
                },

                handleTextMessage: function (message) {
                    this.showMessage(_.clone(message.attributes));
                    if (message.get('sender') !== 'me') {
                        this.updateNewMessageIndicators(message);
                    } else {
                        // We remove the "scrolled" flag so that the chat area
                        // gets scrolled down. We always want to scroll down
                        // when the user writes a message as opposed to when a
                        // message is received.
                        this.model.set('scrolled', false);
                    }
                    if (this.shouldShowOnTextMessage()) {
                        this.show();
                    } else {
                        this.scrollDown();
                    }
                },

                handleErrorMessage: function (message) {
                    var $message = $('[data-msgid='+message.get('msgid')+']');
                    if ($message.length) {
                        $message.after($('<div class="chat-info chat-error"></div>').text(message.get('message')));
                        this.scrollDown();
                    }
                },

                onMessageAdded: function (message) {
                    /* Handler that gets called when a new message object is created.
                     *
                     * Parameters:
                     *    (Object) message - The message Backbone object that was added.
                     */
                    if (typeof this.clear_status_timeout !== 'undefined') {
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
                },

                createMessageStanza: function (message) {
                    return $msg({
                                from: converse.connection.jid,
                                to: this.model.get('jid'),
                                type: 'chat',
                                id: message.get('msgid')
                        }).c('body').t(message.get('message')).up()
                            .c(converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();
                },

                sendMessage: function (message) {
                    /* Responsible for sending off a text message.
                     *
                     *  Parameters:
                     *    (Message) message - The chat message
                     */
                    // TODO: We might want to send to specfic resources.
                    // Especially in the OTR case.
                    var messageStanza = this.createMessageStanza(message);
                    converse.connection.send(messageStanza);
                    if (converse.forward_messages) {
                        // Forward the message, so that other connected resources are also aware of it.
                        converse.connection.send(
                            $msg({ to: converse.bare_jid, type: 'chat', id: message.get('msgid') })
                            .c('forwarded', {xmlns:'urn:xmpp:forward:0'})
                            .c('delay', {xmns:'urn:xmpp:delay',stamp:(new Date()).getTime()}).up()
                            .cnode(messageStanza.tree())
                        );
                    }
                },

                onMessageSubmitted: function (text) {
                    /* This method gets called once the user has typed a message
                     * and then pressed enter in a chat box.
                     *
                     *  Parameters:
                     *    (string) text - The chat message text.
                     */
                    if (!converse.connection.authenticated) {
                        return this.showHelpMessages(
                            ['Sorry, the connection has been lost, '+
                                'and your message could not be sent'],
                            'error'
                        );
                    }
                    var match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/), msgs;
                    if (match) {
                        if (match[1] === "clear") {
                            return this.clearMessages();
                        }
                        else if (match[1] === "help") {
                            msgs = [
                                '<strong>/help</strong>:'+__('Show this menu')+'',
                                '<strong>/me</strong>:'+__('Write in the third person')+'',
                                '<strong>/clear</strong>:'+__('Remove messages')+''
                                ];
                            this.showHelpMessages(msgs);
                            return;
                        }
                    }
                    var fullname = converse.xmppstatus.get('fullname');
                    fullname = _.isEmpty(fullname)? converse.bare_jid: fullname;
                    var message = this.model.messages.create({
                        fullname: fullname,
                        sender: 'me',
                        time: moment().format(),
                        message: text
                    });
                    this.sendMessage(message);
                },

                sendChatState: function () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    converse.connection.send(
                        $msg({'to':this.model.get('jid'), 'type': 'chat'})
                            .c(this.model.get('chat_state'), {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },

                setChatState: function (state, no_save) {
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
                    if (typeof this.chat_state_timeout !== 'undefined') {
                        window.clearTimeout(this.chat_state_timeout);
                        delete this.chat_state_timeout;
                    }
                    if (state === converse.COMPOSING) {
                        this.chat_state_timeout = window.setTimeout(
                                this.setChatState.bind(this), converse.TIMEOUTS.PAUSED, converse.PAUSED);
                    } else if (state === converse.PAUSED) {
                        this.chat_state_timeout = window.setTimeout(
                                this.setChatState.bind(this), converse.TIMEOUTS.INACTIVE, converse.INACTIVE);
                    }
                    if (!no_save && this.model.get('chat_state') !== state) {
                        this.model.set('chat_state', state);
                    }
                    return this;
                },

                keyPressed: function (ev) {
                    /* Event handler for when a key is pressed in a chat box textarea.
                     */
                    var $textarea = $(ev.target), message;
                    if (ev.keyCode === KEY.ENTER) {
                        ev.preventDefault();
                        message = $textarea.val();
                        $textarea.val('').focus();
                        if (message !== '') {
                            this.onMessageSubmitted(message);
                            converse.emit('messageSend', message);
                        }
                        this.setChatState(converse.ACTIVE);
                    } else {
                        // Set chat state to composing if keyCode is not a forward-slash
                        // (which would imply an internal command and not a message).
                        this.setChatState(converse.COMPOSING, ev.keyCode === KEY.FORWARD_SLASH);
                    }
                },

                clearMessages: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var result = confirm(__("Are you sure you want to clear the messages from this chat box?"));
                    if (result === true) {
                        this.$content.empty();
                        this.model.messages.reset();
                        this.model.messages.browserStorage._clear();
                    }
                    return this;
                },

                insertIntoTextArea: function (value) {
                    var $textbox = this.$el.find('textarea.chat-textarea');
                    var existing = $textbox.val();
                    if (existing && (existing[existing.length-1] !== ' ')) {
                        existing = existing + ' ';
                    }
                    $textbox.focus().val(existing+value+' ');
                },

                insertEmoticon: function (ev) {
                    ev.stopPropagation();
                    this.$el.find('.toggle-smiley ul').slideToggle(200);
                    var $target = $(ev.target);
                    $target = $target.is('a') ? $target : $target.children('a');
                    this.insertIntoTextArea($target.data('emoticon'));
                },

                toggleEmoticonMenu: function (ev) {
                    ev.stopPropagation();
                    this.$el.find('.toggle-smiley ul').slideToggle(200);
                },

                toggleCall: function (ev) {
                    ev.stopPropagation();
                    converse.emit('callButtonClicked', {
                        connection: converse.connection,
                        model: this.model
                    });
                },

                onChatStatusChanged: function (item) {
                    var chat_status = item.get('chat_status'),
                        fullname = item.get('fullname');
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

                onStatusChanged: function (item) {
                    this.showStatusMessage();
                    converse.emit('contactStatusMessageChanged', {
                        'contact': item.attributes,
                        'message': item.get('status')
                    });
                },

                showStatusMessage: function (msg) {
                    msg = msg || this.model.get('status');
                    if (typeof msg === "string") {
                        this.$el.find('p.user-custom-message').text(msg).attr('title', msg);
                    }
                    return this;
                },

                close: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (converse.connection.connected) {
                        // Immediately sending the chat state, because the
                        // model is going to be destroyed afterwards.
                        this.model.set('chat_state', converse.INACTIVE);
                        this.sendChatState();

                        this.model.destroy();
                    }
                    this.remove();
                    converse.emit('chatBoxClosed', this);
                    return this;
                },

                renderToolbar: function (options) {
                    if (!converse.show_toolbar) {
                        return;
                    }
                    options = _.extend(options || {}, {
                        label_clear: __('Clear all messages'),
                        label_hide_occupants: __('Hide the list of occupants'),
                        label_insert_smiley: __('Insert a smiley'),
                        label_start_call: __('Start a call'),
                        show_call_button: converse.visible_toolbar_buttons.call,
                        show_clear_button: converse.visible_toolbar_buttons.clear,
                        show_emoticons: converse.visible_toolbar_buttons.emoticons,
                        // FIXME Leaky abstraction MUC
                        show_occupants_toggle: this.is_chatroom && converse.visible_toolbar_buttons.toggle_occupants
                    });
                    this.$el.find('.chat-toolbar').html(converse.templates.toolbar(_.extend(this.model.toJSON(), options || {})));
                    return this;
                },

                renderAvatar: function () {
                    if (!this.model.get('image')) {
                        return;
                    }
                    var img_src = 'data:'+this.model.get('image_type')+';base64,'+this.model.get('image'),
                        canvas = $('<canvas height="32px" width="32px" class="avatar"></canvas>').get(0);

                    if (!(canvas.getContext && canvas.getContext('2d'))) {
                        return this;
                    }
                    var ctx = canvas.getContext('2d');
                    var img = new Image();   // Create new Image object
                    img.onload = function () {
                        var ratio = img.width/img.height;
                        if (ratio < 1) {
                            ctx.drawImage(img, 0,0, 32, 32*(1/ratio));
                        } else {
                            ctx.drawImage(img, 0,0, 32, 32*ratio);
                        }

                    };
                    img.src = img_src;
                    this.$el.find('.chat-title').before(canvas);
                    return this;
                },

                focus: function () {
                    this.$el.find('.chat-textarea').focus();
                    converse.emit('chatBoxFocused', this);
                    return this;
                },

                hide: function () {
                    this.$el.hide();
                    utils.refreshWebkit();
                    return this;
                },

                afterShown: function () {
                    if (converse.connection.connected) {
                        // Without a connection, we haven't yet initialized
                        // localstorage
                        this.model.save();
                    }
                    this.setChatState(converse.ACTIVE);
                    this.scrollDown();
                    if (focus) {
                        this.focus();
                    }
                },

                _show: function (focus) {
                    /* Inner show method that gets debounced */
                    if (this.$el.is(':visible') && this.$el.css('opacity') === "1") {
                        if (focus) { this.focus(); }
                        return;
                    }
                    this.$el.fadeIn(this.afterShown.bind(this));
                },

                show: function (focus) {
                    if (typeof this.debouncedShow === 'undefined') {
                        /* We wrap the method in a debouncer and set it on the
                         * instance, so that we have it debounced per instance.
                         * Debouncing it on the class-level is too broad.
                         */
                        this.debouncedShow = _.debounce(this._show, 250, true);
                    }
                    this.debouncedShow.apply(this, arguments);
                    return this;
                },

                markScrolled: _.debounce(function (ev) {
                    /* Called when the chat content is scrolled up or down.
                     * We want to record when the user has scrolled away from
                     * the bottom, so that we don't automatically scroll away
                     * from what the user is reading when new messages are
                     * received.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var is_at_bottom = this.$content.scrollTop() + this.$content.innerHeight() >= this.$content[0].scrollHeight-10;
                    if (is_at_bottom) {
                        this.model.set('scrolled', false);
                        this.$el.find('.new-msgs-indicator').addClass('hidden');
                    } else {
                        // We're not at the bottom of the chat area, so we mark
                        // that the box is in a scrolled-up state.
                        this.model.set('scrolled', true);
                    }
                }, 150),


                viewUnreadMessages: function () {
                    this.model.set('scrolled', false);
                    this.scrollDown();
                },

                scrollDownMessageHeight: function ($message) {
                    if (this.$content.is(':visible') && !this.model.get('scrolled')) {
                        this.$content.scrollTop(this.$content.scrollTop() + $message[0].scrollHeight);
                    }
                    return this;
                },

                scrollDown: function () {
                    if (this.$content.is(':visible') && !this.model.get('scrolled')) {
                        this.$content.scrollTop(this.$content[0].scrollHeight);
                        this.$el.find('.new-msgs-indicator').addClass('hidden');
                    }
                    return this;
                }
            });
        }
    });
}));
