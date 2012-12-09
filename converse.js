/*!
 * Converse.js (XMPP-based instant messaging with Strophe.js and backbone.js)
 * http://opkode.com
 *
 * Copyright (c) 2012 Jan-Carel Brand (jc@opkode.com)
 * Dual licensed under the MIT and GPL Licenses
 */

/* The following line defines global variables defined elsewhere. */
/*globals jQuery, portal_url*/

// AMD/global registrations
(function (root, factory) {
    if (typeof define === 'function' && define.amd) { 

        require.config({
            // paths: {
            //     "patterns": "Libraries/Patterns"
            // },
            // define module dependencies for modules not using define
            shim: {
                'Libraries/backbone': {
                    //These script dependencies should be loaded before loading
                    //backbone.js
                    deps: [
                        'Libraries/underscore', 
                        'jquery'],
                    //Once loaded, use the global 'Backbone' as the
                    //module value.
                    exports: 'Backbone'
                },

                'Libraries/strophe.muc': {
                    deps: ['Libraries/strophe', 'jquery']
                },

                'Libraries/strophe.roster': {
                    deps: ['Libraries/strophe', 'jquery']
                }
            }
        });

        define([
            "Libraries/burry.js/burry",
            "Libraries/underscore.string",
            "Libraries/jquery.tinysort",
            "Libraries/jquery-ui-1.9.1.custom",
            "Libraries/sjcl",
            "Libraries/backbone",
            "Libraries/strophe.muc",
            "Libraries/strophe.roster"
            ], function (Burry, _s) {
                var store = new Burry.Store('collective.xmpp.chat');
                // Init underscore.str
                _.str = _s;
                // Use Mustache style syntax for variable interpolation
                _.templateSettings = {
                    evaluate : /\{\[([\s\S]+?)\]\}/g,
                    interpolate : /\{\{([\s\S]+?)\}\}/g
                };

                if (console===undefined || console.log===undefined) {
                    console = { log: function () {}, error: function () {} };
                }
                return factory(jQuery, store, _, console);
            }
        );
    } else { 
        // Browser globals
        var store = new Burry.Store('collective.xmpp.chat');
        _.templateSettings = {
            evaluate : /\{\[([\s\S]+?)\]\}/g,
            interpolate : /\{\{([\s\S]+?)\}\}/g
        };
        if (console===undefined || console.log===undefined) {
            console = { log: function () {}, error: function () {} };
        }
        root.xmppchat = factory(jQuery, store, _, console || {log: function(){}});
    }
}(this, function ($, store, _, console) {

    var xmppchat = {};
    xmppchat.msg_counter = 0;

    xmppchat.toISOString = function (date) {
        if (typeof date.toISOString !== 'undefined') {
            return date.toISOString();
        } else {
            // IE <= 8 Doesn't have toISOStringMethod
            pad = function (num) {
                return (num < 10) ? '0' + num : '' + num;
            };
            return date.getUTCFullYear() + '-' + 
                pad(date.getUTCMonth() + 1) + '-' + 
                pad(date.getUTCDate()) + 'T' + 
                pad(date.getUTCHours()) + ':' + 
                pad(date.getUTCMinutes()) + ':' + 
                pad(date.getUTCSeconds()) + '.000Z'; 
        }
    };

    xmppchat.updateMsgCounter = function () {
        this.msg_counter += 1;
        if (this.msg_counter > 0) {
            if (document.title.search(/^Messages \(\d\) /) === -1) {
                document.title = "Messages (" + this.msg_counter + ") " + document.title;
            } else {
                document.title = document.title.replace(/^Messages \(\d\) /, "Messages (" + this.msg_counter + ") ");
            }
            window.blur();
            window.focus();
        } else if (document.title.search(/^\(\d\) /) !== -1) {
            document.title = document.title.replace(/^Messages \(\d\) /, "");
        }
    };

    xmppchat.collections = {
        /* FIXME: XEP-0136 specifies 'urn:xmpp:archive' but the mod_archive_odbc 
        *  add-on for ejabberd wants the URL below. This might break for other
        *  Jabber servers.
        */
        'URI': 'http://www.xmpp.org/extensions/xep-0136.html#ns'
    };

    xmppchat.collections.getLastCollection = function (jid, callback) {
        var bare_jid = Strophe.getBareJidFromJid(jid),
            iq = $iq({'type':'get'})
                    .c('list', {'xmlns': this.URI,
                                'with': bare_jid
                                })
                    .c('set', {'xmlns': 'http://jabber.org/protocol/rsm'})
                    .c('before').up()
                    .c('max')
                    .t('1');

        xmppchat.connection.sendIQ(iq, 
                    callback,
                    function () { 
                        console.log('Error while retrieving collections'); 
                    });
    };

    xmppchat.collections.getLastMessages = function (jid, callback) {
        var that = this;
        this.getLastCollection(jid, function (result) {
            // Retrieve the last page of a collection (max 30 elements). 
            var $collection = $(result).find('chat'),
                jid = $collection.attr('with'),
                start = $collection.attr('start'),
                iq = $iq({'type':'get'})
                        .c('retrieve', {'start': start,
                                    'xmlns': that.URI,
                                    'with': jid
                                    })
                        .c('set', {'xmlns': 'http://jabber.org/protocol/rsm'})
                        .c('max')
                        .t('30');
            xmppchat.connection.sendIQ(iq, callback);
        });
    };

    xmppchat.ClientStorage = Backbone.Model.extend({

        initialize: function (own_jid) {
            this.set({ 'own_jid' : own_jid });
        },

        addMessage: function (jid, msg, direction) {
            var bare_jid = Strophe.getBareJidFromJid(jid),
                now = xmppchat.toISOString(new Date()),
                msgs = store.get(hex_sha1(this.get('own_jid')+bare_jid)) || [];
            if (msgs.length >= 30) {
                msgs.shift();
            }
            msgs.push(sjcl.encrypt(hex_sha1(this.get('own_jid')), now+' '+direction+' '+msg));
            store.set(hex_sha1(this.get('own_jid')+bare_jid), msgs);
        },

        getMessages: function (jid) {
            var bare_jid = Strophe.getBareJidFromJid(jid),
                decrypted_msgs = [], i;
            var msgs = store.get(hex_sha1(this.get('own_jid')+bare_jid)) || [];
            for (i=0; i<msgs.length; i++) {
                decrypted_msgs.push(sjcl.decrypt(hex_sha1(this.get('own_jid')), msgs[i]));
            }
            return decrypted_msgs;
        },

        getLastMessage: function (jid) {
            var bare_jid = Strophe.getBareJidFromJid(jid);
            var msgs = store.get(hex_sha1(this.get('own_jid')+bare_jid)) || [];
            if (msgs.length) {
                return sjcl.decrypt(hex_sha1(this.get('own_jid')), msgs[msgs.length-1]);
            } 
        },

        clearMessages: function (jid) {
            var bare_jid = Strophe.getBareJidFromJid(jid);
            store.set(hex_sha1(this.get('own_jid')+bare_jid), []);
        },

        getOpenChats: function () {
            var key = hex_sha1(this.get('own_jid')+'-open-chats'),
                chats = store.get(key) || [], 
                decrypted_chats = [],
                i;

            for (i=0; i<chats.length; i++) {
                decrypted_chats.push(chats[i]);
            }
            return decrypted_chats;
        },

        addOpenChat: function (jid) {
            // TODO: Hash stored chats?
            var key = hex_sha1(this.get('own_jid')+'-open-chats'),
                chats = store.get(key) || [];

            if (_.indexOf(chats, jid) == -1) {
                chats.push(jid);
            }
            store.set(key, chats);
        },

        removeOpenChat: function (jid) {
            var key = hex_sha1(this.get('own_jid')+'-open-chats'),
                chats = store.get(key) || [];

            if (_.has(chats, jid) != -1) {
                chats.splice(_.indexOf(chats, jid), 1);
            }
            store.set(key, chats);
        },

        flush: function () {
            // Clears all localstorage content handled by burry.js
            // Only used in tests
            store.flush();
        }
    });
    
    xmppchat.ChatBox = Backbone.Model.extend({
        initialize: function () {
            this.set({
                'user_id' : Strophe.getNodeFromJid(this.get('jid')),
                'box_id' : hex_sha1(this.get('jid')),
                'fullname' : this.get('fullname'),
                'portrait_url': this.get('portrait_url'),
                'user_profile_url': this.get('user_profile_url')
            });
        }
    });

    xmppchat.ChatBoxView = Backbone.View.extend({
        length: 200,
        tagName: 'div',
        className: 'chatbox',

        events: {
            'click .close-chatbox-button': 'closeChat',
            'keypress textarea.chat-textarea': 'keyPressed'
        },

        message_template: _.template(
                            '<div class="chat-message {{extra_classes}}">' + 
                                '<span class="chat-message-{{sender}}">{{time}} {{username}}:&nbsp;</span>' + 
                                '<span class="chat-message-content">{{message}}</span>' + 
                            '</div>'),

        action_template: _.template(
                            '<div class="chat-message {{extra_classes}}">' + 
                                '<span class="chat-message-{{sender}}">{{time}}:&nbsp;</span>' + 
                                '<span class="chat-message-content">{{message}}</span>' + 
                            '</div>'),

        autoLink: function (text) {
            // Convert URLs into hyperlinks
            var re = /((http|https|ftp):\/\/[\w?=&.\/\-;#~%\-]+(?![\w\s?&.\/;#~%"=\-]*>))/g;
            return text.replace(re, '<a target="_blank" href="$1">$1</a>');
        },

        appendMessage: function (message) {
            var now = new Date(),
                time = now.toLocaleTimeString().substring(0,5),
                minutes = now.getMinutes().toString(),
                $chat_content = $(this.el).find('.chat-content');

            var msg = xmppchat.storage.getLastMessage(this.model.get('jid'));
            if (typeof msg !== 'undefined') {
                var prev_date = new Date(Date.parse(msg.split(' ', 2)[0]));
                if (this.isDifferentDay(prev_date, now)) {
                    $chat_content.append($('<div class="chat-date">&nbsp;</div>'));
                    $chat_content.append($('<div class="chat-date"></div>').text(now.toString().substring(0,15)));
                }
            }
            message = this.autoLink(message);
            if (minutes.length==1) {minutes = '0'+minutes;}
            $chat_content.find('div.chat-event').remove();
            $chat_content.append(this.message_template({
                                'sender': 'me', 
                                'time': time, 
                                'message': message, 
                                'username': 'me',
                                'extra_classes': ''
                            }));
            $chat_content.scrollTop($chat_content[0].scrollHeight);
        },

        insertStatusNotification: function (message, replace) {
            var $chat_content = this.$el.find('.chat-content');
            $chat_content.find('div.chat-event').remove().end()
                .append($('<div class="chat-event"></div>').text(message));
            $chat_content.scrollTop($chat_content[0].scrollHeight);
        },

        messageReceived: function (message) {
            /* XXX: event.mtype should be 'xhtml' for XHTML-IM messages, 
                but I only seem to get 'text'. 
            */
            var body = this.autoLink($message.children('body').text()),
                from = Strophe.getBareJidFromJid($message.attr('from')),
                to = $message.attr('to'),
                composing = $message.find('composing'),
                $chat_content = $(this.el).find('.chat-content'),
                delayed = $message.find('delay').length > 0,
                fullname = this.model.get('fullname'),
                time, stamp, username, sender;

            if (xmppchat.xmppstatus.getStatus() === 'offline') {
                // only update the UI if the user is not offline
                return;
            }
            if (!body) {
                if (composing.length > 0) {
                    this.insertStatusNotification(fullname+' '+'is typing');
                    return;
                }
            } else {
                if (from == xmppchat.connection.bare_jid) {
                    // I am the sender, so this must be a forwarded message...
                    $chat_content.find('div.chat-event').remove();
                    username = 'me';
                    sender = 'me';
                } else {
                    xmppchat.storage.addMessage(from, body, 'from');
                    $chat_content.find('div.chat-event').remove();
                    username = fullname.split(' ')[0];
                    sender = 'them';
                }
                if (delayed) {
                    // XXX: Test properly (for really old messages we somehow need to show
                    // their date as well)
                    stamp = $message.find('delay').attr('stamp');
                    time = (new Date(stamp)).toLocaleTimeString().substring(0,5); 
                } else {
                    time = (new Date()).toLocaleTimeString().substring(0,5); 
                }
                $chat_content.append(
                        this.message_template({
                            'sender': sender, 
                            'time': time,
                            'message': body,
                            'username': username,
                            'extra_classes': delayed && 'delayed' || ''
                        }));
                $chat_content.scrollTop($chat_content[0].scrollHeight);
            }
            xmppchat.updateMsgCounter();
        },

        isDifferentDay: function (prev_date, next_date) {
            return ((next_date.getDate() != prev_date.getDate()) || (next_date.getFullYear() != prev_date.getFullYear()) || (next_date.getMonth() != prev_date.getMonth()));
        },

        insertClientStoredMessages: function () {
            var msgs = xmppchat.storage.getMessages(this.model.get('jid')),
                $content = this.$el.find('.chat-content'), 
                prev_date, this_date, now, separator, i; 

            for (i=0; i<_.size(msgs); i++) {
                var msg = msgs[i], 
                    msg_array = msg.split(' ', 2),
                    date = msg_array[0];

                if (i === 0) {
                    this_date = new Date(Date.parse(date));
                    if (this.isDifferentDay(this_date, new Date())) {
                        $content.append($('<div class="chat-date"></div>').text(this_date.toString().substring(0,15)));
                    }
                } else {
                    prev_date = this_date;
                    this_date = new Date(Date.parse(date));
                    if (this.isDifferentDay(prev_date, this_date)) {
                        $content.append($('<div class="chat-date">&nbsp;</div>'));
                        $content.append($('<div class="chat-date"></div>').text(this_date.toString().substring(0,15)));
                    }
                }
                msg = this.autoLink(String(msg).replace(/(.*?\s.*?\s)/, ''));
                if (msg_array[1] == 'to') {
                    $content.append(
                        this.message_template({
                            'sender': 'me', 
                            'time': this_date.toLocaleTimeString().substring(0,5),
                            'message': msg, 
                            'username': 'me',
                            'extra_classes': 'delayed'
                    }));
                } else {
                    $content.append(
                        this.message_template({
                            'sender': 'them', 
                            'time': this_date.toLocaleTimeString().substring(0,5),
                            'message': msg,
                            'username': this.model.get('fullname').split(' ')[0],
                            'extra_classes': 'delayed'
                    }));
                }
            }
        },

        sendMessage: function (text) {
            // TODO: Look in ChatPartners to see what resources we have for the recipient.
            // if we have one resource, we sent to only that resources, if we have multiple
            // we send to the bare jid.
            var timestamp = (new Date()).getTime(),
                bare_jid = this.model.get('jid'),
                match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/), el, $chat_content;

            if (match) {
                if (match[1] === "clear") {
                    $(this.el).find('.chat-content').empty();
                    xmppchat.storage.clearMessages(bare_jid);
                    return;
                }
                else if (match[1] === "help") {
                    $chat_content = $(this.el).find('.chat-content');
                    $chat_content.append($('<div class="chat-help"><strong>/help</strong>: Show this menu</div>'));
                    $chat_content.append($('<div class="chat-help"><strong>/clear</strong>: Remove messages</div>'));
                    this.scrolldown();
                    return;
                }
            }

            var message = $msg({from: xmppchat.connection.bare_jid, to: bare_jid, type: 'chat', id: timestamp})
                .c('body').t(text).up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'});

            // Forward the message, so that other connected resources are also aware of it.
            // TODO: Forward the message only to other connected resources (inside the browser)
            var forwarded = $msg({to:xmppchat.connection.bare_jid, type:'chat', id:timestamp})
                            .c('forwarded', {xmlns:'urn:xmpp:forward:0'})
                            .c('delay', {xmns:'urn:xmpp:delay',stamp:timestamp}).up()
                            .cnode(message.tree());

            xmppchat.connection.send(message);
            xmppchat.connection.send(forwarded);
            this.appendMessage(text);
            xmppchat.storage.addMessage(bare_jid, text, 'to');
        },

        keyPressed: function (ev) {
            var $textarea = $(ev.target),
                message,
                notify,
                composing,
                that = this;

            if(ev.keyCode == 13) {
                message = $textarea.val();
                $textarea.val('').focus();
                if (message !== '') {
                    this.sendMessage(message);
                }
                $(this.el).data('composing', false);
            } else {
                composing = $(this.el).data('composing');
                if (!composing) {
                    notify = $msg({'to':this.model.get('jid'), 'type': 'chat'})
                                    .c('composing', {'xmlns':'http://jabber.org/protocol/chatstates'});
                    xmppchat.connection.send(notify);
                    $(this.el).data('composing', true);
                }
            }
        },

        saveChatToStorage: function () {
            xmppchat.storage.addOpenChat(this.model.get('jid'));
        },

        removeChatFromStorage: function () {
            xmppchat.storage.removeOpenChat(this.model.get('jid'));
        },

        closeChat: function () {
            var that = this;
            $('#'+this.model.get('box_id')).hide('fast', function () {
                that.removeChatFromStorage(that.model.get('id'));
            });
        },

        initialize: function (){
            $('body').append($(this.el).hide());

            xmppchat.roster.on('change', function (item, changed) {
                if (item.get('jid') ===  this.model.get('jid')) {
                    if (_.has(changed.changes, 'presence_type')) {
                        if (this.$el.is(':visible')) {
                            if (item.get('presence_type') === 'offline') {
                                this.insertStatusNotification(this.model.get('fullname')+' '+'has gone offline');
                            } else if (item.get('presence_type') === 'away') {
                                this.insertStatusNotification(this.model.get('fullname')+' '+'has gone away');
                            } else if ((item.get('presence_type') === 'busy') || (item.get('presence_type') === 'dnd')) {
                                this.insertStatusNotification(this.model.get('fullname')+' '+'is busy');
                            } else if (item.get('presence_type') === 'online') {
                                this.$el.find('div.chat-event').remove();
                            }
                        }
                    } else if (_.has(changed.changes, 'status')) {
                        this.$el.find('p.user-custom-message').text(item.get('status')).attr('title', item.get('status'));
                    }
                }
            }, this);
        },

        template: _.template(
                    '<div class="chat-head chat-head-chatbox">' +
                        '<a class="close-chatbox-button">X</a>' +
                        '<a href="{{user_profile_url}}" class="user">' +
                            '<img src="{{portrait_url}}" alt="Avatar of {{fullname}}" class="avatar" />' +
                            '<div class="chat-title"> {{ fullname }} </div>' +
		                '</a>' +
                        '<p class="user-custom-message"><p/>' +
                    '</div>' +
                    '<div class="chat-content"></div>' + 
                    '<form class="sendXMPPMessage" action="" method="post">' +
                    '<textarea ' +
                        'type="text" ' +
                        'class="chat-textarea" ' +
                        'placeholder="Personal message"/>'+
                    '</form>'),

        render: function () {
            $(this.el).attr('id', this.model.get('box_id'));
            $(this.el).html(this.template(this.model.toJSON()));
            this.insertClientStoredMessages();
            return this;
        },

        isVisible: function () {
            return $(this.el).is(':visible');
        },

        focus: function () {
            $(this.el).find('.chat-textarea').focus();
            return this;
        },

        show: function () {
            this.$el.css({'opacity': 0});
            this.$el.css({'display': 'inline'});
            this.$el.animate({
                opacity: '1'
            }, 200);
            return this;
        },

        scrolldown: function () {
            var  $content = this.$el.find('.chat-content');
            $content.scrollTop($content[0].scrollHeight);
        }
    });

    xmppchat.ContactsPanel = Backbone.View.extend({
        tagName: 'div',
        className: 'oc-chat-content',
        id: 'users',
        events: {
            'click a.add-xmpp-contact': 'toggleContactForm',
            'submit form.search-xmpp-contact': 'searchContacts',
            'click a.subscribe-to-user': 'subscribeToContact'
        },

        tab_template: _.template('<li><a class="s current" href="#users">Contacts</a></li>'),
        template: _.template(
            '<form class="set-xmpp-status" action="" method="post">'+
                '<span id="xmpp-status-holder">'+
                    '<select id="select-xmpp-status">'+
                        '<option value="online">Online</option>'+
                        '<option value="busy">Busy</option>'+
                        '<option value="away">Away</option>'+
                        '<option value="offline">Offline</option>'+
                    '</select>'+
                '</span>'+
            '</form>'+
            '<div class="add-xmpp-contact">'+
                '<a class="add-xmpp-contact" href="#" title="Click to search for new users to add as chat contacts">Add a contact</a>'+
                '<form class="search-xmpp-contact" style="display:none">'+
                    '<input type="text" name="identifier" class="username" placeholder="Contact name"/>'+
                    '<button type="submit">Search</button>'+
                    '<ul id="found-users"></ul>'+
                '</form>'+
            '</div>'
        ),

        render: function () {
            $('#controlbox-tabs').append(this.tab_template());
            $('#controlbox-panes').append(this.$el.html(this.template()));
            return this;
        },

        toggleContactForm: function (ev) {
            ev.preventDefault();
            this.$el.find('form.search-xmpp-contact').fadeToggle('medium').find('input.username').focus();
        },

        searchContacts: function (ev) {
            ev.preventDefault();
            $.getJSON(portal_url + "/search-users?q=" + $(ev.target).find('input.username').val(), function (data) {
                var $results_el = $('#found-users');
                $(data).each(function (idx, obj) {
                    if ($results_el.children().length > 0) {  
                        $results_el.empty();
                    }
                    $results_el.append(
                            $('<li></li>')
                                .attr('id', 'found-users-'+obj.id)
                                .append(
                                    $('<a class="subscribe-to-user" href="#" title="Click to add as a chat contact"></a>')
                                        .attr('data-recipient', Strophe.escapeNode(obj.id)+'@'+xmppchat.connection.domain)
                                        .text(obj.fullname)
                                )
                        );
                });
            });
        },

        subscribeToContact: function (ev) {
            ev.preventDefault();
            var jid = $(ev.target).attr('data-recipient'),
                name = $(ev.target).text();
            xmppchat.connection.roster.add(jid, name, [], function (iq) {
                xmppchat.connection.roster.subscribe(jid);
            });
            $(ev.target).parent().remove();
            $('form.search-xmpp-contact').hide();
        }

    });

    xmppchat.RoomsPanel = Backbone.View.extend({
        tagName: 'div',
        id: 'chatrooms',
        events: {
            'submit form.add-chatroom': 'createChatRoom',
            'click a.open-room': 'createChatRoom'
        },
        room_template: _.template(
            '<dd class="available-chatroom">' +
            '<a class="open-room" room-jid="{{jid}}" title="Click to open this chatroom" href="#">' +
            '{{name}}</a></dd>'),

        tab_template: _.template('<li><a class="s" href="#chatrooms">Rooms</a></li>'),

        template: _.template(
            '<form class="add-chatroom" action="" method="post">'+
                '<input type="text" name="chatroom" class="new-chatroom-name" placeholder="Chat room name"/>'+
                '<button type="submit">Join</button>'+
            '</form>'+
            '<dl id="available-chatrooms">'+
                '<dt>Available chatrooms</dt>'+
            '</dl>'),

        render: function () {
            $('#controlbox-tabs').append(this.tab_template());
            $('#controlbox-panes').append(this.$el.html(this.template()).hide());
            return this;
        },

        initialize: function () {
            this.on('update-rooms-list', function (ev) {
                this.updateRoomsList();
            });
            this.trigger('update-rooms-list');
        },

        updateRoomsList: function () {
            xmppchat.connection.muc.listRooms(xmppchat.connection.muc_domain, $.proxy(function (iq) {
                var room, name, jid, i, 
                    rooms = $(iq).find('query').find('item');
                this.$el.find('#available-chatrooms').find('dd.available-chatroom').remove();
                if (rooms.length) {
                    this.$el.find('#available-chatrooms dt').show();
                } else {
                    this.$el.find('#available-chatrooms dt').hide();
                }
                for (i=0; i<rooms.length; i++) {
                    name = Strophe.unescapeNode($(rooms[i]).attr('name'));
                    jid = $(rooms[i]).attr('jid');
                    this.$el.find('#available-chatrooms').append(this.room_template({'name':name, 'jid':jid}));
                }
                return true;
            }, this));
        },

        createChatRoom: function (ev) {
            ev.preventDefault();
            var name, jid;
            if (ev.type === 'click') {
                jid = $(ev.target).attr('room-jid');
            } else {
                name = _.str.strip($(ev.target).find('input.new-chatroom-name').val()).toLowerCase();
                if (name) {
                    jid = Strophe.escapeNode(name) + '@' + xmppchat.connection.muc_domain;
                } else {
                    return;
                }
            }
            xmppchat.chatboxesview.openChat(jid);
        }
    });

    xmppchat.SettingsPanel = Backbone.View.extend({
        el: '#settings'
    });


    xmppchat.ControlBox = xmppchat.ChatBox.extend({
        initialize: function () {
            this.set({
                'box_id' : 'controlbox'
            });
        }
    });

    xmppchat.ControlBoxView = xmppchat.ChatBoxView.extend({
        // XXX: Options for the (still to be done) 'settings' tab:
        // * Show offline users
        // * Auto-open chatbox when a message was received.
        tagName: 'div',
        className: 'chatbox',
        id: 'controlbox',
        events: {
            'click a.close-chatbox-button': 'closeChat',
            'click ul#controlbox-tabs li a': 'switchTab'
        },

        initialize: function () {
            $('body').append($(this.el).hide());
        },

        template: _.template(
            '<div class="chat-head oc-chat-head">'+
                '<ul id="controlbox-tabs"></ul>'+
                '<a class="close-chatbox-button">X</a>'+
            '</div>'+
            '<div id="controlbox-panes"></div>'
        ),

        switchTab: function (ev) {
            ev.preventDefault();
            var $tab = $(ev.target),
                $sibling = $tab.parent().siblings('li').children('a'),
                $tab_panel = $($tab.attr('href')),
                $sibling_panel = $($sibling.attr('href'));

            $sibling_panel.fadeOut('fast', function () { 
                $sibling.removeClass('current');
                $tab.addClass('current');
                $tab_panel.fadeIn('fast', function () {
                });
            });
        },

        render: function () {
            var that = this;
            this.$el.hide('fast', function () {
                $(this).html(that.template(that.model.toJSON()));
            });
            return this;
        }
    });

    xmppchat.ChatRoom = xmppchat.ChatBox.extend({
        initialize: function (jid, nick) {
            this.set({
                'id': jid,
                'name': Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                'nick': nick,
                'jid': jid,
                'box_id' : hex_sha1(jid)
            }, {'silent': true});
        }
    });


    xmppchat.ChatRoomView = xmppchat.ChatBoxView.extend({
        length: 300,
        tagName: 'div',
        className: 'chatroom',
        events: {
            'click .close-chatbox-button': 'closeChatRoom',
            'keypress textarea.chat-textarea': 'keyPressed'
        },

        closeChatRoom: function () {
            this.closeChat();
            xmppchat.connection.muc.leave(
                            this.model.get('jid'), 
                            this.model.get('nick'), 
                            this.onLeave,
                            undefined);
            delete xmppchat.chatboxesview.views[this.model.get('jid')];
            xmppchat.chatboxesview.model.remove(this.model.get('jid'));
            this.remove();
        },

        keyPressed: function (ev) {
            var $textarea = $(ev.target),
                message,
                notify,
                composing,
                that = this;

            if(ev.keyCode == 13) {
                message = $textarea.val();
                message = message.replace(/^\s+|\s+jQuery/g,"");
                $textarea.val('').focus();
                if (message !== '') {
                    this.sendGroupMessage(message);
                }
            } 
        },

        sendGroupMessage: function (body) {
            var match = body.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/);
            if (match) {
                if (match[1] === "msg") {
                    // TODO: Private messages
                } else if (match[1] === "topic") {
                    xmppchat.connection.muc.setTopic(this.model.get('jid'), match[2]);

                } else if (match[1] === "kick") {
                    xmppchat.connection.muc.kick(this.model.get('jid'), match[2]);

                } else if (match[1] === "ban") {
                    xmppchat.connection.muc.ban(this.model.get('jid'), match[2]);

                } else if (match[1] === "op") {
                    xmppchat.connection.muc.op(this.model.get('jid'), match[2]);

                } else if (match[1] === "deop") {
                    xmppchat.connection.muc.deop(this.model.get('jid'), match[2]);

                } else if (match[1] === "help") {
                    $chat_content = $(this.el).find('.chat-content');
                    $chat_content.append($('<div class="chat-help"><strong>/help</strong>: Show this menu</div>'));
                    $chat_content.append($('<div class="chat-help"><strong>/topic</strong>: Set chatroom topic</div>'));
                    /* TODO:
                    $chat_content.append($('<div class="chat-help"><strong>/kick</strong>: Kick out user</div>'));
                    $chat_content.append($('<div class="chat-help"><strong>/ban</strong>: Ban user</div>'));
                    $chat_content.append($('<div class="chat-help"><strong>/op $user</strong>: Remove messages</div>'));
                    $chat_content.append($('<div class="chat-help"><strong>/deop $user</strong>: Remove messages</div>'));
                    */
                    this.scrolldown();
                } else {
                    this.last_msgid = xmppchat.connection.muc.groupchat(this.model.get('jid'), body);
                }
            } else {
                this.last_msgid = xmppchat.connection.muc.groupchat(this.model.get('jid'), body);
            }
        },

        template: _.template(
                '<div class="chat-head chat-head-chatroom">' +
                    '<a class="close-chatbox-button">X</a>' +
                    '<div class="chat-title"> {{ name }} </div>' +
                    '<p class="chatroom-topic"><p/>' +
                '</div>' +
                '<div>' +
                '<div class="chat-area">' +
                    '<div class="chat-content"></div>' +
                    '<form class="sendXMPPMessage" action="" method="post">' +
                        '<textarea ' +
                            'type="text" ' +
                            'class="chat-textarea" ' +
                            'placeholder="Message"/>' +
                    '</form>' +
                '</div>' +
                '<div class="participants">' +
                    '<ul class="participant-list"></ul>' +
                '</div>' +
                '</div>'),

        initialize: function () {
            xmppchat.connection.muc.join(
                            this.model.get('jid'), 
                            this.model.get('nick'), 
                            $.proxy(this.onMessage, this), 
                            $.proxy(this.onPresence, this), 
                            $.proxy(this.onRoster, this));
        },

        onLeave: function () {
            var controlboxview = xmppchat.chatboxesview.views.controlbox;
            if (controlboxview) {
                controlboxview.roomspanel.trigger('update-rooms-list');
            }
        },

        onPresence: function (presence, room) {
            var nick = room.nick,
                from = $(presence).attr('from');
            if ($(presence).attr('type') !== 'error') {
                // check for status 110 to see if it's our own presence
                if ($(presence).find("status[code='110']").length > 0) {
                    // check if server changed our nick
                    if ($(presence).find("status[code='210']").length > 0) {
                        this.model.set({'nick': Strophe.getResourceFromJid(from)});
                    }
                }
            }
            return true;
        },

        onMessage: function (message) {
            var body = $(message).children('body').text(),
                jid = $(message).attr('from'),
                composing = $(message).find('composing'),
                $chat_content = $(this.el).find('.chat-content'),
                sender = Strophe.unescapeNode(Strophe.getResourceFromJid(jid)),
                subject = $(message).children('subject').text();

            if (subject) {
                this.$el.find('.chatroom-topic').text(subject).attr('title', subject);
            }
            if (!body) {
                if (composing.length > 0) {
                    this.insertStatusNotification(sender+' '+'is typing');
                    return true;
                }
            } else {
                if (sender === this.model.get('nick')) {
                    this.appendMessage(body);
                } else {
                    $chat_content.find('div.chat-event').remove();

                    match = body.match(/^\/(.*?)(?: (.*))?$/);
                    if ((match) && (match[1] === 'me')) {
                        body = body.replace(/^\/me/, '*'+sender);
                        $chat_content.append(
                                this.action_template({
                                    'sender': 'room', 
                                    'time': (new Date()).toLocaleTimeString().substring(0,5),
                                    'message': body, 
                                    'username': sender,
                                    'extra_classes': ($(message).find('delay').length > 0) && 'delayed' || ''
                                }));
                    } else {
                        $chat_content.append(
                                this.message_template({
                                    'sender': 'room', 
                                    'time': (new Date()).toLocaleTimeString().substring(0,5),
                                    'message': body,
                                    'username': sender,
                                    'extra_classes': ($(message).find('delay').length > 0) && 'delayed' || ''
                                }));
                    }
                    $chat_content.scrollTop($chat_content[0].scrollHeight);
                }
            }
            return true;
        },

        onRoster: function (roster, room) {
            var controlboxview = xmppchat.chatboxesview.views.controlbox,
                i;

            if (controlboxview) {
                controlboxview.roomspanel.trigger('update-rooms-list');
            }
            this.$el.find('.participant-list').empty();
            for (i=0; i<_.size(roster); i++) {
                this.$el.find('.participant-list').append('<li>' + Strophe.unescapeNode(_.keys(roster)[i]) + '</li>');
            }
            return true;
        },

        show: function () {
            this.$el.css({'opacity': 0});
            this.$el.css({'display': 'inline'});
            this.$el.animate({
                opacity: '1'
            }, 200);
            return this;
        },

        render: function () {
            $(this.el).attr('id', this.model.get('box_id'));
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
        }
    });

    xmppchat.ChatBoxes = Backbone.Collection.extend();

    xmppchat.ChatBoxesView = Backbone.View.extend({
        el: '#collective-xmpp-chat-data',

        restoreOpenChats: function () {
            var open_chats = xmppchat.storage.getOpenChats(),
                that = this;

            if (_.indexOf(open_chats, 'controlbox') != -1) {
                // Controlbox already exists, we just need to show it.
                this.showChat('controlbox');
            }
            _.each(open_chats, $.proxy(function (jid) {
                if (jid != 'controlbox') {
                    if (_.str.include(jid, xmppchat.connection.muc_domain)) {
                        this.createChatBox(jid);
                    } else {
                        this.openChat(jid);
                    }
                }
            }, this));
        },
        
        isChatRoom: function (jid) {
            return Strophe.getDomainFromJid(jid) === xmppchat.connection.muc_domain;
        },
        
        createChatBox: function (jid, data) {
            var box, view;
            if (this.isChatRoom(jid)) {
                box = new xmppchat.ChatRoom(jid, xmppchat.fullname);
                view = new xmppchat.ChatRoomView({
                    'model': box
                });
            } else {
                box = new xmppchat.ChatBox({
                                        'id': jid, 
                                        'jid': jid, 
                                        'fullname': data.fullname, 
                                        'portrait_url': data.portrait_url,
                                        'user_profile_url': data.user_profile_url
                                    });
                view = new xmppchat.ChatBoxView({
                    model: box 
                });
            }
            this.views[jid] = view.render();
            view.$el.appendTo(this.$el);
            this.options.model.add(box);
            return view;
        },

        closeChat: function (jid) {
            var view = this.views[jid];
            if (view) {
                view.closeChat();
            }
        },

        openChat: function (jid) {
            jid = Strophe.getBareJidFromJid(jid);
            if (!this.model.get(jid)) {
                $.getJSON(portal_url + "/xmpp-userinfo?user_id=" + Strophe.getNodeFromJid(jid), $.proxy(function (data) {
                    view = this.createChatBox(jid, data);
                }, this));
            } else {
                this.showChat(jid);
            }
        },

        showChat: function (jid) {
            var view = this.views[jid];
            if (view.isVisible()) {
                view.focus();
            } else {
                view.show();
                if (jid !== 'controlbox') {
                    view.scrolldown();
                    view.focus();
                }
                view.saveChatToStorage();
            }
            return view;
        },

        messageReceived: function (message) {
            if ($(message).attr('from') == xmppchat.connection.jid) {
                // FIXME: Forwarded messages should be sent to specific resources, not broadcasted
                return true;
            }
            var $forwarded = $(message).children('forwarded');
            if ($forwarded.length > 0) {
                $message = $forwarded.children('message');
            } else {
                $message = $(message);
            }

            var from = Strophe.getBareJidFromJid($message.attr('from')),
                to = Strophe.getBareJidFromJid($message.attr('to')),
                view, resource;

            if (from == xmppchat.connection.bare_jid) {
                // I am the sender, so this must be a forwarded message...
                partner_jid = to;
                resource = Strophe.getResourceFromJid($message.attr('to'));
            } else {
                partner_jid = from;
                resource = Strophe.getResourceFromJid($message.attr('from'));
            }

            view = this.views[partner_jid];
            if (!view) {
                $.getJSON(portal_url + "/xmpp-userinfo?user_id=" + Strophe.getNodeFromJid(partner_jid), $.proxy(function (data) {
                    view = this.createChatBox(partner_jid, data);
                    view.messageReceived(message);
                    xmppchat.roster.addResource(partner_jid, resource);
                }, this));
                return;
            } else if (!view.isVisible()) {
                this.showChat(partner_jid);
            }
            view.messageReceived(message);
            xmppchat.roster.addResource(partner_jid, resource);
        },

        initialize: function () {
            this.options.model.on("add", function (item) {
                // The controlbox added automatically, but we don't show it
                // automatically (only when it was open before page load or
                // upon a click).
                if (item.get('id') != 'controlbox') {
                    this.showChat(item.get('id'));
                }
            }, this);
            this.views = {};

            // Add the controlbox view and the panels
            var controlbox = xmppchat.controlbox;
            controlbox.$el.appendTo(this.$el);
            controlbox.contactspanel = new xmppchat.ContactsPanel().render();
            controlbox.roomspanel = new xmppchat.RoomsPanel().render(); // TODO: Only add the rooms panel if the server supports MUC

            // Add the roster
            xmppchat.roster = new xmppchat.RosterItems();
            xmppchat.rosterview = new xmppchat.RosterView({'model':xmppchat.roster}).render();
            xmppchat.rosterview.$el.appendTo(controlbox.contactspanel.$el);

            // Rebind events (necessary for click events on tabs inserted via the panels)
            controlbox.delegateEvents();
            // Add the controlbox model to this collection (will trigger showChat)
            this.options.model.add(xmppchat.controlbox.options.model);

            this.views.controlbox = controlbox;
            this.restoreOpenChats();
        }
    });

    xmppchat.RosterItem = Backbone.Model.extend({

        initialize: function (jid, subscription, ask, name) {
            var user_id = Strophe.getNodeFromJid(jid);
            if (!name) {
                name = user_id;
            }
            this.set({ 'id': jid,
                'jid': jid,
                'ask': ask,
                'bare_jid': Strophe.getBareJidFromJid(jid),
                'user_id': user_id,
                'subscription': subscription,
                'fullname': name, 
                'resources': [],
                'presence_type': 'offline',
                'status': 'offline'
            }, {'silent': true});
        }
    });


    xmppchat.RosterItemView = Backbone.View.extend({
        tagName: 'dd',

        openChat: function () {
            xmppchat.chatboxesview.openChat(this.model.get('jid'));
        },

        removeContact: function () {
            var that = this;
            $("<span></span>").dialog({
                title: 'Are you sure you want to remove this contact?',
                dialogClass: 'remove-xmpp-contact-dialog',
                resizable: false,
                width: 200,
                position: {
                    my: 'center',
                    at: 'center',
                    of: '#controlbox'
                    },
                modal: true,
                buttons: {
                    "Remove": function() {
                        var bare_jid = that.model.get('bare_jid');
                        $(this).dialog( "close" );
                        xmppchat.connection.roster.remove(bare_jid, function (iq) {
                            xmppchat.connection.roster.unauthorize(bare_jid);
                            xmppchat.chatboxesview.controlbox.roster.remove(bare_jid);
                        });
                    },
                    "Cancel": function() {
                        $(this).dialog( "close" );
                    }
                }
            });
        },

        acceptRequest: function () {
            var jid = this.model.get('jid');
            xmppchat.connection.roster.authorize(jid);
            xmppchat.connection.roster.add(jid, this.model.get('fullname'), [], function (iq) {
                xmppchat.connection.roster.subscribe(jid);
            });
        },

        declineRequest: function () {
            var that = this;
            xmppchat.connection.roster.unauthorize(this.model.get('jid'));
            that.trigger('decline-request', that.model);
        },

        template: _.template(
                    '<a class="open-chat" title="Click to chat with this contact" href="#">{{ fullname }}</a>' +
                    '<a class="remove-xmpp-contact" title="Click to remove this contact" href="#"></a>'),

        pending_template: _.template(
                    '{{ fullname }}' +
                    '<a class="remove-xmpp-contact" title="Click to remove this contact" href="#"></a>'),

        request_template: _.template('{{ fullname }}' +
                    '<button type="button" class="accept-xmpp-request">' +
                    'Accept</button>' +
                    '<button type="button" class="decline-xmpp-request">' +
                    'Decline</button>' +
                    ''),

        render: function () {
            var item = this.model,
                ask = item.get('ask'),
                that = this,
                subscription = item.get('subscription');

            $(this.el).addClass(item.get('presence_type'));
            
            if (ask === 'subscribe') {
                this.$el.addClass('pending-xmpp-contact');
                $(this.el).html(this.pending_template(item.toJSON()));
            } else if (ask === 'request') {
                this.$el.addClass('requesting-xmpp-contact');
                $(this.el).html(this.request_template(item.toJSON()));
                this.$el.delegate('button.accept-xmpp-request', 'click', function (ev) {
                    ev.preventDefault();
                    that.acceptRequest();
                });
                this.$el.delegate('button.decline-xmpp-request', 'click', function (ev) {
                    ev.preventDefault();
                    that.declineRequest();
                });
                xmppchat.chatboxesview.openChat('controlbox');
            } else if (subscription === 'both') {
                this.$el.addClass('current-xmpp-contact');
                this.$el.html(this.template(item.toJSON()));
                this.$el.delegate('a.open-chat', 'click', function (ev) {
                    ev.preventDefault();
                    that.openChat();
                });
            }
            
            // Event handlers
            this.$el.delegate('a.remove-xmpp-contact','click', function (ev) {
                ev.preventDefault();
                that.removeContact();
            });
            return this;
        },

        initialize: function () {
            this.options.model.on('change', function (item, changed) {
                if (_.has(changed.changes, 'presence_type')) {
                    $(this.el).attr('class', item.changed.presence_type);
                }
            }, this);
        }
    });

    xmppchat.RosterItems = Backbone.Collection.extend({
        model: xmppchat.RosterItem,
        initialize: function () {
            this._connection = xmppchat.connection;
        },

        comparator : function (rosteritem) {
            var presence_type = rosteritem.get('presence_type'),
                rank = 4;
            switch(presence_type) {
                case 'offline': 
                    rank = 0;
                    break;
                case 'unavailable':
                    rank = 1;
                    break;
                case 'away':
                    rank = 2;
                    break;
                case 'busy':
                    rank = 3;
                    break;
                case 'dnd':
                    rank = 4;
                    break;
                case 'online':
                    rank = 5;
                    break;
            }
            return rank;
        },

        subscribeToSuggestedItems: function (msg) {
            $(msg).find('item').each(function () {
                var jid = $(this).attr('jid'),
                    action = $(this).attr('action'),
                    fullname = $(this).attr('name');
                if (action === 'add') {
                    xmppchat.connection.roster.add(jid, fullname, [], function (iq) {
                        xmppchat.connection.roster.subscribe(jid);
                    });
                }
            });
            return true;
        },

        isSelf: function (jid) {
            return (Strophe.getBareJidFromJid(jid) === Strophe.getBareJidFromJid(xmppchat.connection.jid));
        },

        getItem: function (id) {
            return Backbone.Collection.prototype.get.call(this, id);
        },

        addRosterItem: function (jid, subscription, ask, name) {
            var model = new xmppchat.RosterItem(jid, subscription, ask, name);
            this.add(model);
        },
            
        addResource: function (bare_jid, resource) {
            var item = this.getItem(bare_jid),
                resources;
            if (item) {
                resources = item.get('resources');
                if (resources) {
                    if (_.indexOf(resources, resource) == -1) {
                        resources.push(resource);
                        item.set({'resources': resources});
                    }
                } else  {
                    item.set({'resources': [resource]});
                }
            }
        },

        removeResource: function (bare_jid, resource) {
            var item = this.getItem(bare_jid),
                resources,
                idx;
            if (item) {
                resources = item.get('resources');
                idx = _.indexOf(resources, resource);
                if (idx !== -1) {
                    resources.splice(idx, 1);
                    item.set({'resources': resources});
                    return resources.length;
                }
            }
            return 0;
        },

        clearResources: function (bare_jid) {
            var item = this.getItem(bare_jid);
            if (item) {
                item.set({'resources': []});
            }
        },

        getTotalResources: function (bare_jid) {
            var item = this.getItem(bare_jid);
            if (item) {
                return _.size(item.get('resources'));
            }
        },

        getNumOnlineContacts: function () {
            var count = 0;
            for (var i=0; i<this.models.length; i++) {
                if (_.indexOf(['offline', 'unavailable'], this.models[i].get('presence_type')) === -1) {
                    count++;
                }
            }
            return count;
        },

        rosterHandler: function (items) {
            var model, item;
            for (var i=0; i<items.length; i++) {
                item = items[i];
                model = this.getItem(item.jid);
                if (!model) {
                    this.addRosterItem(item.jid, item.subscription, item.ask, item.name);
                } else {
                    model.set({'subscription': item.subscription, 'ask': item.ask});
                }
            }
        },

        presenceHandler: function (presence) {
            var jid = $(presence).attr('from'),
                bare_jid = Strophe.getBareJidFromJid(jid),
                resource = Strophe.getResourceFromJid(jid),
                presence_type = $(presence).attr('type'),
                show = $(presence).find('show'),
                status_message = $(presence).find('status'),
                item, model;

            if (this.isSelf(bare_jid)) {
                if (xmppchat.connection.jid != jid) {
                    // Another resource has changed it's status, we'll update ours as well.
                    // FIXME: We should ideally differentiate between converse.js using 
                    // resources and other resources (i.e Pidgin etc.)
                    xmppchat.xmppstatus.set({'status': presence_type});
                } 
                return true;
            } else if (($(presence).find('x').attr('xmlns') || '').indexOf(Strophe.NS.MUC) === 0) {
                return true; // Ignore MUC 
            }

            if ((status_message.length > 0) && (status_message.text() && (presence_type !== 'unavailable'))) {
                model = this.getItem(bare_jid);
                model.set({'status': status_message.text()});
            }

            if ((presence_type === 'error') || (presence_type === 'subscribed') || (presence_type === 'unsubscribe')) {
                return true;

            } else if (presence_type === 'subscribe') {
                item = this.getItem(bare_jid);

                if (xmppchat.auto_subscribe) {
                    if ((!item) || (item.get('subscription') != 'to')) {
                        if (xmppchat.connection.roster.findItem(bare_jid)) {
                            $.getJSON(portal_url + "/xmpp-userinfo?user_id=" + Strophe.getNodeFromJid(jid), $.proxy(function (data) {
                                xmppchat.connection.roster.update(jid, data.fullname, [], function (iq) {
                                    xmppchat.connection.roster.authorize(bare_jid);
                                    xmppchat.connection.roster.subscribe(jid);
                                });
                            }, this));
                        } else {
                            $.getJSON(portal_url + "/xmpp-userinfo?user_id=" + Strophe.getNodeFromJid(jid), $.proxy(function (data) {
                                xmppchat.connection.roster.add(jid, data.fullname, [], function (iq) {
                                    xmppchat.connection.roster.authorize(bare_jid);
                                    xmppchat.connection.roster.subscribe(jid);
                                });
                            }, this));
                        }
                    } else {
                        xmppchat.connection.roster.authorize(bare_jid);
                    }
                } else {
                    if ((item) && (item.get('subscription') != 'none'))  {
                        xmppchat.connection.roster.authorize(bare_jid);
                    } else {
                        $.getJSON(portal_url + "/xmpp-userinfo?user_id=" + Strophe.getNodeFromJid(jid), $.proxy(function (data) {
                            this.addRosterItem(bare_jid, 'none', 'request', data.fullname);
                        }, this));
                    }
                }

            } else if (presence_type === 'unsubscribed') {
                /* Upon receiving the presence stanza of type "unsubscribed", 
                * the user SHOULD acknowledge receipt of that subscription state 
                * notification by sending a presence stanza of type "unsubscribe" 
                * this step lets the user's server know that it MUST no longer 
                * send notification of the subscription state change to the user.
                */
                xmppchat.xmppstatus.sendPresence('unsubscribe');
                if (xmppchat.connection.roster.findItem(bare_jid)) {
                    xmppchat.chatboxesview.controlbox.roster.remove(bare_jid);
                    xmppchat.connection.roster.remove(bare_jid);
                }
            } else { 
                if ((presence_type === undefined) && (show)) {
                    if (show.text() === 'chat') {
                        presence_type = 'online';
                    } else if (show.text() === 'dnd') {
                        presence_type = 'busy';
                    } else if (show.text() === 'xa') {
                        presence_type = 'offline';
                    } else {
                        presence_type = show.text();
                    }
                }

                if ((presence_type !== 'offline')&&(presence_type !== 'unavailable')) {
                    this.addResource(bare_jid, resource);
                    model = this.getItem(bare_jid);
                    model.set({'presence_type': presence_type});
                } else {
                    if (this.removeResource(bare_jid, resource) === 0) {
                        model = this.getItem(bare_jid);
                        if (model) {
                            model.set({'presence_type': presence_type});
                        }
                    }
                }
            }
            return true;
        }
    });

    xmppchat.RosterView = Backbone.View.extend({
        tagName: 'dl',
        id: 'xmppchat-roster',
        rosteritemviews: {},

        initialize: function () {
            this.model.on("add", function (item) {
                var view = new xmppchat.RosterItemView({model: item});
                this.rosteritemviews[item.id] = view;
                if (item.get('ask') === 'request') {
                    view.on('decline-request', function (item) {
                        this.model.remove(item.id);
                    }, this);
                }
                this.render();
            }, this);

            this.model.on('change', function (item) {
                this.render();
            }, this);

            this.model.on("remove", function (item) {
                delete this.rosteritemviews[item.id];
                this.render();
            }, this);
        },

        template: _.template('<dt id="xmpp-contact-requests">Contact requests</dt>' +
                            '<dt id="xmpp-contacts">My contacts</dt>' +
                            '<dt id="pending-xmpp-contacts">Pending contacts</dt>'),

        render: function () {
            this.$el.empty().html(this.template());
            var models = this.model.sort().models,
                children = $(this.el).children(),
                $my_contacts = this.$el.find('#xmpp-contacts').hide(),
                $contact_requests = this.$el.find('#xmpp-contact-requests').hide(),
                $pending_contacts = this.$el.find('#pending-xmpp-contacts').hide(),
                $count, num;

            for (var i=0; i<models.length; i++) {
                var model = models[i],
                    user_id = Strophe.getNodeFromJid(model.id),
                    view = this.rosteritemviews[model.id],
                    ask = model.get('ask'),
                    subscription = model.get('subscription'),
                    crit = {order:'asc'};

                if (ask === 'subscribe') {
                    $pending_contacts.after(view.render().el);
                    $pending_contacts.after($pending_contacts.siblings('dd.pending-xmpp-contact').tsort(crit));
                } else if (ask === 'request') {
                    $contact_requests.after(view.render().el);
                    $contact_requests.after($contact_requests.siblings('dd.requesting-xmpp-contact').tsort(crit));
                } else if (subscription === 'both') {
                    $my_contacts.after(view.render().el);
                    $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.offline').tsort('a', crit));
                    $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.unavailable').tsort('a', crit));
                    $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.away').tsort('a', crit));
                    $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.busy').tsort('a', crit));
                    $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.online').tsort('a', crit));
                } 
            }
            // Hide the headings if there are no contacts under them
            _.each([$my_contacts, $contact_requests, $pending_contacts], function (h) {
                if (h.nextUntil('dt').length > 0) {
                    h.show();
                }
            });
            $count = $('#online-count');
            $count.text(this.model.getNumOnlineContacts());
            return this;
        }
    });

    xmppchat.XMPPStatus = Backbone.Model.extend({

        initialize: function () {
            this.set({
                'status' : this.getStatus(),
                'status_message' : this.getStatusMessage(),
            });
        },

        initStatus: function () {
            /* Called when the page is loaded and we aren't sure what the users
             * status is. Will also cause the UI to be updated with the correct
             * status.
             */
            var stat = this.getStatus();
            if (stat === undefined) {
                stat = 'online';
                this.setStatus(stat);
            } else {
                this.sendPresence(stat);
            }
        },

        sendPresence: function (type) {
            xmppchat.connection.send($pres({'type':type}));
        },

        getStatus: function () {
            return store.get(xmppchat.connection.bare_jid+'-xmpp-status');
        },

        setStatus: function (value) {
            this.sendPresence(value);
            this.set({'status': value});
            store.set(xmppchat.connection.bare_jid+'-xmpp-status', value);
        },

        setStatusMessage: function (status_message) {
            xmppchat.connection.send($pres({'type':this.getStatus()}).c('status').t(status_message));
            this.set({'status_message': status_message});
            store.set(xmppchat.connection.bare_jid+'-xmpp-custom-status', status_message);
        },

        getStatusMessage: function () {
            return store.get(xmppchat.connection.bare_jid+'-xmpp-custom-status');
        }

    });

    xmppchat.XMPPStatusView = Backbone.View.extend({
        el: "span#xmpp-status-holder",

        events: {
            "click a.choose-xmpp-status": "toggleOptions",
            "click #fancy-xmpp-status-select a.change-xmpp-status-message": "renderStatusChangeForm",
            "submit #set-custom-xmpp-status": "setStatusMessage",
            "click .dropdown dd ul li a": "setStatus"
        },

        toggleOptions: function (ev) {
            ev.preventDefault();
            $(ev.target).parent().parent().siblings('dd').find('ul').toggle('fast');
        },

        change_status_message_template: _.template(
            '<form id="set-custom-xmpp-status">' +
                '<input type="text" class="custom-xmpp-status" {{ status_message }}" placeholder="Custom status"/>' +
                '<button type="submit">Save</button>' +
            '</form>'),

        status_template: _.template(
            '<div class="xmpp-status">' +
                '<a class="choose-xmpp-status {{ presence_type }}" href="#" title="Click to change your chat status">' +
                    '{{ status_message }} <span class="value">{{ status_message }}</span>' +
                '</a>' +
                '<a class="change-xmpp-status-message" href="#" Title="Click here to write a custom status message"></a>' +
            '</div>'),


        renderStatusChangeForm: function (ev) {
            ev.preventDefault();
            var status_message = this.model.getStatus() || 'offline';
            var input = this.change_status_message_template({'status_message': status_message});
            this.$el.find('.xmpp-status').replaceWith(input);
            this.$el.find('.custom-xmpp-status').focus().focus();
        },

        setStatusMessage: function (ev) {
            ev.preventDefault();
            var status_message = $(ev.target).find('input').attr('value');
            if (status_message === "") {
            }
            this.model.setStatusMessage(status_message);
        },

        setStatus: function (ev) {
            ev.preventDefault();
            var $el = $(ev.target).find('span'),
                value = $el.text();
            this.model.setStatus(value);
            this.$el.find(".dropdown dd ul").hide();
        },

        updateStatusUI: function (ev) {
            var stat = ev.get('status'),
                status_message = ev.get('status_message') || "I am " + stat;
            $(this.el).find('#fancy-xmpp-status-select').html(
                this.status_template({
                        'presence_type': stat,
                        'status_message': status_message
                        }));

        },

        choose_template: _.template(
            '<dl id="target" class="dropdown">' +
                '<dt id="fancy-xmpp-status-select"></dt>' +
                '<dd><ul></ul></dd>' +
            '</dl>'),

        option_template: _.template(
            '<li>' +
                '<a href="#" class="{{ value }}">' +
                    '{{ text }}' +
                    '<span class="value">{{ value }}</span>' +
                '</a>' +
            '</li>'),

        initialize: function () {
            // Replace the default dropdown with something nicer
            // -------------------------------------------------
            var $select = $(this.el).find('select#select-xmpp-status'),
                presence_type = this.model.getStatus() || 'offline',
                options = $('option', $select),
                that = this;
            $(this.el).html(this.choose_template());
            $(this.el).find('#fancy-xmpp-status-select')
                    .html(this.status_template({
                            'status_message': "I am " + presence_type,
                            'presence_type': presence_type 
                            }));
            // iterate through all the <option> elements and create UL
            options.each(function(){
                $(that.el).find("#target dd ul").append(that.option_template({
                                                                'value': $(this).val(), 
                                                                'text': $(this).text()
                                                            })).hide();
            });
            $select.remove();

            // Listen for status change on the model and initialize
            // ----------------------------------------------------
            this.options.model.on("change", $.proxy(this.updateStatusUI, this)); 
            this.model.initStatus();
        }
    });

    // Event handlers
    // --------------
    $(document).ready($.proxy(function () {
        var chatdata = jQuery('div#collective-xmpp-chat-data'),
            $toggle = $('a#toggle-online-users');
        $toggle.unbind('click');

        this.username = chatdata.attr('username');
        this.fullname = chatdata.attr('fullname');
        this.auto_subscribe = chatdata.attr('auto_subscribe') === "True" || false;

        this.controlbox = new xmppchat.ControlBoxView({
            model: new xmppchat.ControlBox({'id':'controlbox', 'jid':'controlbox'})
        }).render();

        $(document).bind('jarnxmpp.disconnected', $.proxy(function (ev, conn) {
            console.log("Connection Failed :(");
        }, this));

        $(document).unbind('jarnxmpp.connected');
        $(document).bind('jarnxmpp.connected', $.proxy(function (ev, connection) {
            this.connection = connection
            // this.connection.xmlInput = function (body) { console.log(body); };
            // this.connection.xmlOutput = function (body) { console.log(body); };
            this.connection.bare_jid = Strophe.getBareJidFromJid(this.connection.jid);
            this.connection.domain = Strophe.getDomainFromJid(this.connection.jid);
            this.connection.muc_domain = 'conference.' +  this.connection.domain;
            this.storage = new this.ClientStorage(this.connection.bare_jid);

            this.chatboxes = new this.ChatBoxes();
            this.chatboxesview = new this.ChatBoxesView({'model': this.chatboxes});


            this.connection.addHandler(
                    $.proxy(this.roster.subscribeToSuggestedItems, this.roster), 
                    'http://jabber.org/protocol/rosterx', 'message', null);

            this.connection.roster.registerCallback(
                    $.proxy(this.roster.rosterHandler, this.roster), 
                    null, 'presence', null);

            this.connection.roster.get($.proxy(function () {
                    this.connection.addHandler(
                            $.proxy(function (presence) {
                                this.presenceHandler(presence);
                                return true;
                            }, this.roster), null, 'presence', null);

                    this.connection.addHandler(
                            $.proxy(function (message) { 
                                this.chatboxesview.messageReceived(message);
                                return true;
                            }, this), null, 'message', 'chat');

                    // XMPP Status 
                    this.xmppstatus = new this.XMPPStatus();
                    this.xmppstatusview = new this.XMPPStatusView({
                        'model': this.xmppstatus
                    });
                }, this));

            // Controlbox toggler
            if ($toggle.length) {
                $toggle.bind('click', $.proxy(function (e) {
                    e.preventDefault();
                    if ($("div#controlbox").is(':visible')) {
                        this.chatboxesview.closeChat('controlbox');
                    } else {
                        this.chatboxesview.openChat('controlbox');
                    }
                }, this));
            } else {
                this.chatboxesview.openChat('controlbox');
            }
        }, this));
    }, xmppchat));

    return xmppchat;
}));

