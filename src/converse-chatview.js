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


    converse_api.plugins.add('chatview', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    // FIXME: leaky abstraction from chatroom here, need to
                    // come up with a nicer solution for this.
                    // Perhaps change 'chatroom' to more generic non-boolean
                    if (!view && !item.get('chatroom')) {
                        view = new converse.ChatBoxView({model: item});
                        this.add(item.get('id'), view);
                        this.trimChats(view);
                    } else {
                        this._super.onChatBoxAdded.apply(this, arguments);
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
                    'click .toggle-chatbox-button': 'minimize',
                    'keypress textarea.chat-textarea': 'keyPressed',
                    'click .toggle-smiley': 'toggleEmoticonMenu',
                    'click .toggle-smiley ul li': 'insertEmoticon',
                    'click .toggle-clear': 'clearMessages',
                    'click .toggle-call': 'toggleCall',
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize: function () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    // TODO check for changed fullname as well
                    this.model.on('change:chat_state', this.sendChatState, this);
                    this.model.on('change:chat_status', this.onChatStatusChanged, this);
                    this.model.on('change:image', this.renderAvatar, this);
                    this.model.on('change:minimized', this.onMinimizedChanged, this);
                    this.model.on('change:status', this.onStatusChanged, this);
                    this.model.on('showHelpMessages', this.showHelpMessages, this);
                    this.model.on('sendMessage', this.sendMessage, this);
                    this.render().fetchMessages().insertIntoPage().hide();
                    converse.emit('chatBoxInitialized', this);
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                        .html(converse.templates.chatbox(
                                _.extend(this.model.toJSON(), {
                                        show_toolbar: converse.show_toolbar,
                                        show_textarea: true,
                                        title: this.model.get('fullname'),
                                        info_close: __('Close this chat box'),
                                        info_minimize: __('Minimize this chat box'),
                                        label_personal_message: __('Personal message')
                                    }
                                )
                            )
                        );
                    this.setWidth();
                    this.$content = this.$el.find('.chat-content');
                    this.renderToolbar().renderAvatar();
                    this.$content.on('scroll', _.debounce(this.onScroll.bind(this), 100));
                    converse.emit('chatBoxOpened', this);
                    window.setTimeout(utils.refreshWebkit, 50);
                    return this.showStatusMessage();
                },

                setWidth: function () {
                    // If a custom width is applied (due to drag-resizing),
                    // then we need to set the width of the .chatbox element as well.
                    if (this.model.get('width')) {
                        this.$el.css('width', this.model.get('width'));
                    }
                },

                onScroll: function (ev) {
                    if ($(ev.target).scrollTop() === 0 && this.model.messages.length) {
                        this.fetchArchivedMessages({
                            'before': this.model.messages.at(0).get('archive_id'),
                            'with': this.model.get('jid'),
                            'max': converse.archived_messages_page_size
                        });
                    }
                },

                fetchMessages: function () {
                    /* Responsible for fetching previously sent messages, first
                     * from session storage, and then once that's done by calling
                     * fetchArchivedMessages, which fetches from the XMPP server if
                     * applicable.
                     */
                    this.model.messages.fetch({
                        'add': true,
                        'success': function () {
                                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                                    return;
                                }
                                if (this.model.messages.length < converse.archived_messages_page_size) {
                                    this.fetchArchivedMessages({
                                        'before': '', // Page backwards from the most recent message
                                        'with': this.model.get('jid'),
                                        'max': converse.archived_messages_page_size
                                    });
                                }
                            }.bind(this)
                    });
                    return this;
                },

                fetchArchivedMessages: function (options) {
                    /* Fetch archived chat messages from the XMPP server.
                    *
                    * Then, upon receiving them, call onMessage on the chat box,
                    * so that they are displayed inside it.
                    */
                    if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                        converse.log("Attempted to fetch archived messages but this user's server doesn't support XEP-0313");
                        return;
                    }
                    this.addSpinner();
                    converse.queryForArchivedMessages(options, function (messages) {
                            this.clearSpinner();
                            if (messages.length) {
                                _.map(messages, converse.chatboxes.onMessage.bind(converse.chatboxes));
                            }
                        }.bind(this),
                        function () {
                            this.clearSpinner();
                            converse.log("Error or timeout while trying to fetch archived messages", "error");
                        }.bind(this)
                    );
                },

                insertIntoPage: function () {
                    /* This method gets overridden in src/converse-controlbox.js if
                    * the controlbox plugin is active.
                    */
                    $('#conversejs').prepend(this.$el);
                    return this;
                },

                adjustToViewport: function () {
                    /* Event handler called when viewport gets resized. We remove
                    * custom width/height from chat boxes.
                    */
                    var viewport_width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                    var viewport_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                    if (viewport_width <= 480) {
                        this.model.set('height', undefined);
                        this.model.set('width', undefined);
                    } else if (viewport_width <= this.model.get('width')) {
                        this.model.set('width', undefined);
                    } else if (viewport_height <= this.model.get('height')) {
                        this.model.set('height', undefined);
                    }
                },

                initDragResize: function () {
                    /* Determine and store the default box size.
                    * We need this information for the drag-resizing feature.
                    */
                    var $flyout = this.$el.find('.box-flyout');
                    if (typeof this.model.get('height') === 'undefined') {
                        var height = $flyout.height();
                        var width = $flyout.width();
                        this.model.set('height', height);
                        this.model.set('default_height', height);
                        this.model.set('width', width);
                        this.model.set('default_width', width);
                    }
                    var min_width = $flyout.css('min-width');
                    var min_height = $flyout.css('min-height');
                    this.model.set('min_width', min_width.endsWith('px') ? Number(min_width.replace(/px$/, '')) :0);
                    this.model.set('min_height', min_height.endsWith('px') ? Number(min_height.replace(/px$/, '')) :0);
                    // Initialize last known mouse position
                    this.prev_pageY = 0;
                    this.prev_pageX = 0;
                    if (converse.connection.connected) {
                        this.height = this.model.get('height');
                        this.width = this.model.get('width');
                    }
                    return this;
                },

                setDimensions: function () {
                    // Make sure the chat box has the right height and width.
                    this.adjustToViewport();
                    this.setChatBoxHeight(this.model.get('height'));
                    this.setChatBoxWidth(this.model.get('width'));
                },

                clearStatusNotification: function () {
                    this.$content.find('div.chat-event').remove();
                },

                showStatusNotification: function (message, keep_old) {
                    if (!keep_old) {
                        this.clearStatusNotification();
                    }
                    var was_at_bottom = this.$content.scrollTop() + this.$content.innerHeight() >= this.$content[0].scrollHeight;
                    this.$content.append($('<div class="chat-info chat-event"></div>').text(message));
                    if (was_at_bottom) {
                        this.scrollDown();
                    }
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

                prependDayIndicator: function (date) {
                    /* Prepends an indicator into the chat area, showing the day as
                    * given by the passed in date.
                    *
                    * Parameters:
                    *  (String) date - An ISO8601 date string.
                    */
                    var day_date = moment(date).startOf('day');
                    this.$content.prepend(converse.templates.new_day({
                        isodate: day_date.format(),
                        datestring: day_date.format("dddd MMM Do YYYY")
                    }));
                },

                appendMessage: function (attrs) {
                    /* Helper method which appends a message to the end of the chat
                    * box's content area.
                    *
                    * Parameters:
                    *  (Object) attrs: An object containing the message attributes.
                    */
                    _.compose(
                        _.debounce(this.scrollDown.bind(this), 50),
                        this.$content.append.bind(this.$content)
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
                    var $first_msg = this.$content.children('.chat-message:first'),
                        first_msg_date = $first_msg.data('isodate'),
                        last_msg_date, current_msg_date, day_date, $msgs, msg_dates, idx;
                    if (!first_msg_date) {
                        this.appendMessage(attrs);
                        return;
                    }
                    current_msg_date = moment(attrs.time) || moment;
                    last_msg_date = this.$content.children('.chat-message:last').data('isodate');

                    if (typeof last_msg_date !== "undefined" && (current_msg_date.isAfter(last_msg_date) || current_msg_date.isSame(last_msg_date))) {
                        // The new message is after the last message
                        if (current_msg_date.isAfter(last_msg_date, 'day')) {
                            // Append a new day indicator
                            day_date = moment(current_msg_date).startOf('day');
                            this.$content.append(converse.templates.new_day({
                                isodate: current_msg_date.format(),
                                datestring: current_msg_date.format("dddd MMM Do YYYY")
                            }));
                        }
                        this.appendMessage(attrs);
                        return;
                    }

                    if (typeof first_msg_date !== "undefined" &&
                            (current_msg_date.isBefore(first_msg_date) ||
                                (current_msg_date.isSame(first_msg_date) && !current_msg_date.isSame(last_msg_date)))) {
                        // The new message is before the first message

                        if ($first_msg.prev().length === 0) {
                            // There's no day indicator before the first message, so we prepend one.
                            this.prependDayIndicator(first_msg_date);
                        }
                        if (current_msg_date.isBefore(first_msg_date, 'day')) {
                            _.compose(
                                    this.scrollDownMessageHeight.bind(this),
                                    function ($el) {
                                        this.$content.prepend($el);
                                        return $el;
                                    }.bind(this)
                                )(this.renderMessage(attrs));
                            // This message is on a different day, so we add a day indicator.
                            this.prependDayIndicator(current_msg_date);
                        } else {
                            // The message is before the first, but on the same day.
                            // We need to prepend the message immediately before the
                            // first message (so that it'll still be after the day indicator).
                            _.compose(
                                    this.scrollDownMessageHeight.bind(this),
                                    function ($el) {
                                        $el.insertBefore($first_msg);
                                        return $el;
                                    }
                                )(this.renderMessage(attrs));
                        }
                    } else {
                        // We need to find the correct place to position the message
                        current_msg_date = current_msg_date.format();
                        $msgs = this.$content.children('.chat-message');
                        msg_dates = _.map($msgs, function (el) {
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
                    }
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
                    return $(template({
                            msgid: attrs.msgid,
                            'sender': attrs.sender,
                            'time': msg_time.format('hh:mm'),
                            'isodate': msg_time.format(),
                            'username': username,
                            'message': '',
                            'extra_classes': extra_classes
                        })).children('.chat-msg-content').first().text(text)
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
                        this.clear_status_timeout = window.setTimeout(this.clearStatusNotification.bind(this), 10000);
                    } else if (message.get('chat_state') === converse.PAUSED) {
                        this.showStatusNotification(message.get('fullname')+' '+__('has stopped typing'));
                    } else if (_.contains([converse.INACTIVE, converse.ACTIVE], message.get('chat_state'))) {
                        this.$content.find('div.chat-event').remove();
                    } else if (message.get('chat_state') === converse.GONE) {
                        this.showStatusNotification(message.get('fullname')+' '+__('has gone away'));
                    }
                },

                handleTextMessage: function (message) {
                    this.showMessage(_.clone(message.attributes));
                    if ((message.get('sender') !== 'me') && (converse.windowState === 'blur')) {
                        converse.incrementMsgCounter();
                    }
                    if (!this.model.get('minimized') && !this.$el.is(':visible')) {
                        this.show();
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
                    if (!message.get('message')) {
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
                            .c(this.model.get('chat_state'), {'xmlns': Strophe.NS.CHATSTATES})
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
                            if (this.model.get('chatroom')) {
                                this.onChatRoomMessageSubmitted(message);
                            } else {
                                this.onMessageSubmitted(message);
                            }
                            converse.emit('messageSend', message);
                        }
                        this.setChatState(converse.ACTIVE);
                    } else if (!this.model.get('chatroom')) { // chat state data is currently only for single user chat
                        // Set chat state to composing if keyCode is not a forward-slash
                        // (which would imply an internal command and not a message).
                        this.setChatState(converse.COMPOSING, ev.keyCode === KEY.FORWARD_SLASH);
                    }
                },

                onStartVerticalResize: function (ev) {
                    if (!converse.allow_dragresize) { return true; }
                    // Record element attributes for mouseMove().
                    this.height = this.$el.children('.box-flyout').height();
                    converse.resizing = {
                        'chatbox': this,
                        'direction': 'top'
                    };
                    this.prev_pageY = ev.pageY;
                },

                onStartHorizontalResize: function (ev) {
                    if (!converse.allow_dragresize) { return true; }
                    this.width = this.$el.children('.box-flyout').width();
                    converse.resizing = {
                        'chatbox': this,
                        'direction': 'left'
                    };
                    this.prev_pageX = ev.pageX;
                },

                onStartDiagonalResize: function (ev) {
                    this.onStartHorizontalResize(ev);
                    this.onStartVerticalResize(ev);
                    converse.resizing.direction = 'topleft';
                },

                setChatBoxHeight: function (height) {
                    if (!this.model.get('minimized')) {
                        if (height) {
                            height = converse.applyDragResistance(height, this.model.get('default_height'))+'px';
                        } else {
                            height = "";
                        }
                        this.$el.children('.box-flyout')[0].style.height = height;
                    }
                },

                setChatBoxWidth: function (width) {
                    if (!this.model.get('minimized')) {
                        if (width) {
                            width = converse.applyDragResistance(width, this.model.get('default_width'))+'px';
                        } else {
                            width = "";
                        }
                        this.$el[0].style.width = width;
                        this.$el.children('.box-flyout')[0].style.width = width;
                    }
                },

                resizeChatBox: function (ev) {
                    var diff;
                    if (converse.resizing.direction.indexOf('top') === 0) {
                        diff = ev.pageY - this.prev_pageY;
                        if (diff) {
                            this.height = ((this.height-diff) > (this.model.get('min_height') || 0)) ? (this.height-diff) : this.model.get('min_height');
                            this.prev_pageY = ev.pageY;
                            this.setChatBoxHeight(this.height);
                        }
                    }
                    if (converse.resizing.direction.indexOf('left') !== -1) {
                        diff = this.prev_pageX - ev.pageX;
                        if (diff) {
                            this.width = ((this.width+diff) > (this.model.get('min_width') || 0)) ? (this.width+diff) : this.model.get('min_width');
                            this.prev_pageX = ev.pageX;
                            this.setChatBoxWidth(this.width);
                        }
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

                insertEmoticon: function (ev) {
                    ev.stopPropagation();
                    this.$el.find('.toggle-smiley ul').slideToggle(200);
                    var $textbox = this.$el.find('textarea.chat-textarea');
                    var value = $textbox.val();
                    var $target = $(ev.target);
                    $target = $target.is('a') ? $target : $target.children('a');
                    if (value && (value[value.length-1] !== ' ')) {
                        value = value + ' ';
                    }
                    $textbox.focus().val(value+$target.data('emoticon')+' ');
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

                onMinimizedChanged: function (item) {
                    if (item.get('minimized')) {
                        this.minimize();
                    } else {
                        this.maximize();
                    }
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
                        this.model.destroy();
                        this.setChatState(converse.INACTIVE);
                    } else {
                        this.hide();
                    }
                    converse.emit('chatBoxClosed', this);
                    return this;
                },

                onMaximized: function () {
                    converse.chatboxviews.trimChats(this);
                    utils.refreshWebkit();
                    this.$content.scrollTop(this.model.get('scroll'));
                    this.setChatState(converse.ACTIVE).focus();
                    converse.emit('chatBoxMaximized', this);
                },

                onMinimized: function () {
                    utils.refreshWebkit();
                    converse.emit('chatBoxMinimized', this);
                },

                maximize: function () {
                    // Restore a minimized chat box
                    $('#conversejs').prepend(this.$el);
                    this.$el.show('fast', this.onMaximized.bind(this));
                    return this;
                },

                minimize: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    // save the scroll position to restore it on maximize
                    this.model.save({'scroll': this.$content.scrollTop()});
                    this.setChatState(converse.INACTIVE).model.minimize();
                    this.$el.hide('fast', this.onMinimized.bind(this));
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
                    if (this.$el.is(':visible') && this.$el.css('opacity') === "1") {
                        this.$el.hide();
                        utils.refreshWebkit();
                    }
                    return this;
                },

                show: function (focus) {
                    if (typeof this.debouncedShow === 'undefined') {
                        /* We wrap the method in a debouncer and set it on the
                        * instance, so that we have it debounced per instance.
                        * Debouncing it on the class-level is too broad.
                        */
                        this.debouncedShow = _.debounce(function (focus) {
                            if (this.$el.is(':visible') && this.$el.css('opacity') === "1") {
                                if (focus) { this.focus(); }
                                return;
                            }
                            this.initDragResize().setDimensions();
                            this.$el.fadeIn(function () {
                                if (converse.connection.connected) {
                                    // Without a connection, we haven't yet initialized
                                    // localstorage
                                    this.model.save();
                                }
                                converse.chatboxviews.trimChats(this);
                                this.setChatState(converse.ACTIVE);
                                this.scrollDown();
                                if (focus) {
                                    this.focus();
                                }
                            }.bind(this));
                        }, 250, true);
                    }
                    this.debouncedShow.apply(this, arguments);
                    return this;
                },

                scrollDownMessageHeight: function ($message) {
                    if (this.$content.is(':visible')) {
                        this.$content.scrollTop(this.$content.scrollTop() + $message[0].scrollHeight);
                    }
                    return this;
                },

                scrollDown: function () {
                    if (this.$content.is(':visible')) {
                        this.$content.scrollTop(this.$content[0].scrollHeight);
                    }
                    return this;
                }
            });
        }
    });
}));
