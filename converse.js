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
        define([
            'Libraries/burry.js/burry',
            "Libraries/jquery.gritter.min",
            "Libraries/jquery.cookie",
            "Libraries/jquery.ba-dotimeout.min",
            "Libraries/underscore",
            "Libraries/underscore.string/lib/underscore.string",
            "Libraries/backbone",
            "Libraries/strophe",
            "Libraries/strophe.muc",
            "Libraries/strophe.roster",
            "Libraries/diff_match_patch",
            "Libraries/jarnxmpp.core.handlers",
            "Libraries/jarnxmpp.collaboration.protocol",
            "Libraries/jarnxmpp.collaboration.collaborate"
            ], function (Burry) {
                var store = new Burry.Store('collective.xmpp.chat');
                // Use Mustache style syntax for variable interpolation
                _.templateSettings = {
                    evaluate : /\{\[([\s\S]+?)\]\}/g,
                    interpolate : /\{\{([\s\S]+?)\}\}/g
                };
                return factory(jarnxmpp, jQuery, store, _, console);
            }
        );
    } else { 
        // Browser globals
        var store = new Burry.Store('collective.xmpp.chat');
        _.templateSettings = {
            evaluate : /\{\[([\s\S]+?)\]\}/g,
            interpolate : /\{\{([\s\S]+?)\}\}/g
        };
        root.xmppchat = factory(jarnxmpp, jQuery, store, _, console || {log: function(){}});
    }
}(this, function (jarnxmpp, $, store, _, console) {

    var xmppchat = jarnxmpp;

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
                now = new Date().toISOString(),
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
            var msgs =store.get(hex_sha1(this.get('own_jid')+bare_jid)) || [];
            for (i=0; i<msgs.length; i++) {
                decrypted_msgs.push(sjcl.decrypt(hex_sha1(this.get('own_jid')), msgs[i]));
            }
            return decrypted_msgs;
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
        }
    });
    
    xmppchat.ChatBox = Backbone.Model.extend({
        initialize: function () {
            this.set({
                'user_id' : Strophe.getNodeFromJid(this.get('jid')),
                'box_id' : hex_sha1(this.get('jid')),
                'fullname' : this.get('fullname'),
                'portrait_url': this.get('portrait_url')
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

        appendMessage: function (message) {
            var time, 
                now = new Date(),
                minutes = now.getMinutes().toString(),
                list,
                $chat_content,
                match;
            message = message.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/^\s*/, "");
            list = message.match(/\b(http:\/\/www\.\S+\.\w+|www\.\S+\.\w+|http:\/\/(?=[^w]){3}\S+[\.:]\S+)[^ ]+\b/g);
            if (list) {
                for (i = 0; i < list.length; i++) {
                    message = message.replace(list[i], "<a target='_blank' href='" + escape( list[i] ) + "'>"+ list[i] + "</a>" );
                }
            }

            if (minutes.length==1) {minutes = '0'+minutes;}
            time = now.toLocaleTimeString().substring(0,5);
            $chat_content = $(this.el).find('.chat-content');
            $chat_content.find('div.chat-event').remove();

            match = message.match(/^\/(.*?)(?: (.*))?$/);
            if ((match) && (match[1] === 'me')) {
                message = message.replace(/^\/me/, '*'+xmppchat.username);
                $chat_content.append(this.action_template({
                                    'sender': 'me', 
                                    'time': time, 
                                    'message': message, 
                                    'username': xmppchat.username,
                                    'extra_classes': ''
                                }));
            } else {
                $chat_content.append(this.message_template({
                                    'sender': 'me', 
                                    'time': time, 
                                    'message': message, 
                                    'username': 'me',
                                    'extra_classes': ''
                                }));
            }
            $chat_content.scrollTop($chat_content[0].scrollHeight);
        },

        insertStatusNotification: function (user_id, message) {
            var $chat_content = this.$el.find('.chat-content');
            $chat_content.find('div.chat-event').remove().end()
                .append($('<div class="chat-event"></div>').text(user_id+' '+message));
            $chat_content.scrollTop($chat_content[0].scrollHeight);
        },

        messageReceived: function (message) {
            /* XXX: event.mtype should be 'xhtml' for XHTML-IM messages, 
                but I only seem to get 'text'. 
            */
            var body = $(message).children('body').text(),
                jid = $(message).attr('from'),
                composing = $(message).find('composing'),
                $chat_content = $(this.el).find('.chat-content'),
                user_id = Strophe.getNodeFromJid(jid),
                delayed = $(message).find('delay').length > 0,
                fullname = this.model.get('fullname'),
                time, stamp;

            if (xmppchat.xmppstatus.getStatus() === 'offline') {
                // only update the UI if the user is not offline
                return;
            }
            if (!body) {
                if (composing.length > 0) {
                    this.insertStatusNotification(fullname, 'is typing');
                    return;
                }
            } else {
                xmppchat.storage.addMessage(jid, body, 'from');
                $chat_content.find('div.chat-event').remove();
                if (delayed) {
                    // XXX: Test properly (for really old messages we somehow need to show
                    // their date as well)
                    stamp = $(message).find('delay').attr('stamp');
                    time = (new Date(stamp)).toLocaleTimeString().substring(0,5); 
                } else {
                    time = (new Date()).toLocaleTimeString().substring(0,5); 
                }
                $chat_content.append(
                        this.message_template({
                            'sender': 'them', 
                            'time': time,
                            'message': body.replace(/<br \/>/g, ""),
                            'username': fullname.split(' ')[0],
                            'extra_classes': delayed && 'delayed' || ''
                        }));
                $chat_content.scrollTop($chat_content[0].scrollHeight);
            }
        },

        insertClientStoredMessages: function () {
            var msgs = xmppchat.storage.getMessages(this.model.get('jid')),
                $content = this.$el.find('.chat-content'), i;

            for (i=0; i<_.size(msgs); i++) {
                var msg = msgs[i], 
                    msg_array = msg.split(' ', 2),
                    date = msg_array[0],
                    match;
                msg = String(msg).replace(/(.*?\s.*?\s)/, '');
                match = msg.match(/^\/(.*?)(?: (.*))?$/);
                if (msg_array[1] == 'to') {
                    $content.append(
                        this.message_template({
                            'sender': 'me', 
                            'time': new Date(Date.parse(date)).toLocaleTimeString().substring(0,5),
                            'message': msg, 
                            'username': 'me',
                            'extra_classes': 'delayed'
                    }));
                } else {
                    $content.append(
                        this.message_template({
                            'sender': 'them', 
                            'time': new Date(Date.parse(date)).toLocaleTimeString().substring(0,5),
                            'message': msg,
                            'username': this.model.get('fullname').split(' ')[0],
                            'extra_classes': 'delayed'
                        }));
                }
            }
        },

        sendMessage: function (text) {
            // TODO: Also send message to all my own connected resources, so that
            // they can display it as well....
        
            // TODO: Look in ChatPartners to see what resources we have for the recipient.
            // if we have one resource, we sent to only that resources, if we have multiple
            // we send to the bare jid.
            var bare_jid = this.model.get('jid');
            var message = $msg({to: bare_jid, type: 'chat'})
                .c('body').t(text).up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'});
            xmppchat.connection.send(message);
            xmppchat.storage.addMessage(bare_jid, text, 'to');
            this.appendMessage(text);
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
                                this.insertStatusNotification(this.model.get('fullname'), 'has gone offline');
                            } else if (item.get('presence_type') === 'away') {
                                this.insertStatusNotification(this.model.get('fullname'), 'has gone away');
                            } else if ((item.get('presence_type') === 'busy') || (item.get('presence_type') === 'dnd')) {
                                this.insertStatusNotification(this.model.get('fullname'), 'is busy');
                            } else if (item.get('presence_type') === 'online') {
                                this.$el.find('div.chat-event').remove();
                            }
                        }
                    } else if (_.has(changed.changes, 'status')) {
                        this.$el.find('p.user-custom-message').text(item.get('status'));
                    }
                }
            }, this);
        },

        template: _.template(
                    '<div class="chat-head chat-head-chatbox">' +
                        '<a href="javascript:void(0)" class="chatbox-button close-chatbox-button">X</a>' +
                        '<a href="#" class="user">' +
                            '<img src="{{portrait_url}}" alt="Avatar of Freethan Meignaman" class="avatar" />' +
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
        el: '#users',
        events: {
            'click a.add-xmpp-contact': 'toggleContactForm',
            'submit form.search-xmpp-contact': 'searchContacts',
            'click a.subscribe-to-user': 'subscribeToContact'
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
        el: '#chatrooms',
        events: {
            'submit form.add-chatroom': 'createChatRoom',
            'click a.open-room': 'createChatRoom'
        },
        room_template: _.template(
                            '<dd class="chatroom">' +
                            '<a class="open-room" room-jid="{{jid}}" title="Click to open this chatroom" href="#">' +
                            '{{name}}</a></dd>'),

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
                this.$el.find('#available-chatrooms').find('dd.chatroom').remove();
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
        el: '#controlbox',
        events: {
            'click a.close-controlbox-button': 'closeChat'
        },

        initialize: function () {
            var userspanel; 
            $('ul.tabs').tabs('div.panes > div');
            this.contactspanel = new xmppchat.ContactsPanel();
            this.roomspanel = new xmppchat.RoomsPanel();
            this.settingspanel = new xmppchat.SettingsPanel();
        },

        render: function () {
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
            var args = null;
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
                } else {
                    this.last_msgid = xmppchat.connection.muc.groupchat(this.model.get('jid'), body);
                }
            } else {
                this.last_msgid = xmppchat.connection.muc.groupchat(this.model.get('jid'), body);
            }
        },

        template: _.template(
                '<div class="chat-head chat-head-chatroom">' +
                    '<div class="chat-title"> {{ name }} </div>' +
                    '<a href="javascript:void(0)" class="chatbox-button close-chatbox-button">X</a>' +
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
                this.$el.find('.chatroom-topic').text(subject);
            }
            if (!body) {
                if (composing.length > 0) {
                    this.insertStatusNotification(sender, 'is typing');
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
                this.createChatRoom('controlbox');
            }
            _.each(open_chats, $.proxy(function (jid) {
                if (jid != 'controlbox') {
                    if (_.str.include(jid, xmppchat.connection.muc_domain)) {
                        this.createChatRoom(jid);
                    } else {
                        this.openChat(jid);
                    }
                }
            }, this));
        },
        
        isChatRoom: function (jid) {
            return Strophe.getDomainFromJid(jid) === xmppchat.connection.muc_domain;
        },
        
        createChatRoom: function (jid, data) {
            var box, view;
            if (jid === 'controlbox') {
                box = new xmppchat.ControlBox({'id': jid, 'jid': jid});
                view = new xmppchat.ControlBoxView({
                    model: box 
                });
            } else {
                if (this.isChatRoom(jid)) {
                    box = new xmppchat.ChatRoom(jid, xmppchat.fullname.split(' ')[0]);
                    view = new xmppchat.ChatRoomView({
                        'model': box
                    });
                } else {
                    box = new xmppchat.ChatBox({'id': jid, 'jid': jid, 'fullname': data.fullname, 'portrait_url': data.portrait_url});
                    view = new xmppchat.ChatBoxView({
                        model: box 
                    });
                }
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
            if (!this.model.get(jid)) {
                $.getJSON(portal_url + "/xmpp-userinfo?user_id=" + Strophe.getNodeFromJid(jid), $.proxy(function (data) {
                    view = this.createChatRoom(jid, data);
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
            var jid = $(message).attr('from'),
                bare_jid = Strophe.getBareJidFromJid(jid),
                resource = Strophe.getResourceFromJid(jid),
                view = this.views[bare_jid],
                fullname;

            if (!view) {
                $.getJSON(portal_url + "/xmpp-userinfo?user_id=" + Strophe.getNodeFromJid(bare_jid), $.proxy(function (data) {
                    view = this.createChatRoom(jid, data);
                    view.messageReceived(message);
                    xmppchat.roster.addResource(bare_jid, resource);
                }, this));
                return;
            } else if (!view.isVisible()) {
                this.showChat(bare_jid);
            }
            view.messageReceived(message);
            xmppchat.roster.addResource(bare_jid, resource);
        },

        initialize: function () {
            this.options.model.on("add", function (item) {
                this.showChat(item.get('id'));
            }, this);

            this.views = {};
            this.restoreOpenChats();
        }
    });


    xmppchat.RosterItem = Backbone.Model.extend({

        initialize: function (jid, subscription, ask, name) {
            var user_id = Strophe.getNodeFromJid(jid);
            if (!name) {
                name = user_id;
            }
            this.set({
                'id': jid,
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
                            xmppchat.roster.remove(bare_jid);
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

            $(this.el).addClass(item.get('presence_type')).attr('id', 'online-users-'+item.get('user_id'));
            
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
                    rank = 4;
                    break;
                case 'unavailable':
                    rank = 3;
                    break;
                case 'away':
                    rank = 2;
                    break;
                case 'busy':
                    rank = 1;
                    break;
                case 'dnd':
                    rank = 1;
                    break;
                case 'online':
                    rank = 0;
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

        getRoster: function () {
            return xmppchat.connection.roster.get($.proxy(this.rosterHandler, this));
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

            if ((($(presence).find('x').attr('xmlns') || '').indexOf(Strophe.NS.MUC) === 0) || (this.isSelf(bare_jid))) {
                // Ignore MUC or self-addressed stanzas
                return true;
            }
            if ((status_message.length > 0) && (status_message.text() && (presence_type !== 'unavailable'))) {
                model = this.getItem(bare_jid);
                model.set({'status': status_message.text()});
            }

            if ((presence_type === 'error') || 
                    (presence_type === 'subscribed') || 
                    (presence_type === 'unsubscribe')) {
                return true;

            } else if (presence_type === 'subscribe') {
                item = this.getItem(bare_jid);

                if (xmppchat.auto_subscribe) {
                    if ((!item) || (item.get('subscription') != 'to')) {
                        if (xmppchat.connection.roster.get(jid)) {
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
                    xmppchat.roster.remove(bare_jid);
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
        },

    });

    xmppchat.RosterView= (function (roster, _, $, console) {
        var View = Backbone.View.extend({
            el: $('#xmppchat-roster'),
            model: roster,
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
                    my_contacts = this.$el.find('#xmpp-contacts').hide(),
                    contact_requests = this.$el.find('#xmpp-contact-requests').hide(),
                    pending_contacts = this.$el.find('#pending-xmpp-contacts').hide();

                for (var i=0; i<models.length; i++) {
                    var model = models[i],
                        user_id = Strophe.getNodeFromJid(model.id),
                        view = this.rosteritemviews[model.id],
                        ask = model.get('ask'),
                        subscription = model.get('subscription');

                    if (ask === 'subscribe') {
                        pending_contacts.after(view.render().el);
                    } else if (ask === 'request') {
                        contact_requests.after(view.render().el);
                    } else if (subscription === 'both') {
                        my_contacts.after(view.render().el);
                    } 
                }
                // Hide the headings if there are no contacts under them
                _.each([my_contacts, contact_requests, pending_contacts], function (h) {
                    if (h.nextUntil('dt').length > 0) {
                        h.show();
                    }
                });
                $('#online-count').text(this.model.getNumOnlineContacts());
            }
        });
        var view = new View();
        return view;
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

        $(document).unbind('jarnxmpp.connected');
        $(document).bind('jarnxmpp.connected', $.proxy(function () {
            // this.connection.xmlInput = function (body) { console.log(body); };
            // this.connection.xmlOutput = function (body) { console.log(body); };

            this.connection.bare_jid = Strophe.getBareJidFromJid(this.connection.jid);
            this.connection.domain = Strophe.getDomainFromJid(this.connection.jid);
            // XXX: Better if configurable?
            this.connection.muc_domain = 'conference.' +  this.connection.domain;

            this.storage = new this.ClientStorage(Strophe.getBareJidFromJid(this.connection.jid));

            this.roster = new this.RosterItems();
            this.rosterview = Backbone.View.extend(this.RosterView(this.roster, _, $, console));
            this.connection.addHandler(
                    $.proxy(this.roster.subscribeToSuggestedItems, this.roster), 
                    'http://jabber.org/protocol/rosterx', 'message', null);

            this.connection.addHandler(
                    $.proxy(function (presence) {
                        this.presenceHandler(presence);
                        return true;
                    }, this.roster), null, 'presence', null);

            this.connection.roster.registerCallback(
                    $.proxy(this.roster.rosterHandler, this.roster), 
                    null, 'presence', null);
            
            this.roster.getRoster();

            this.chatboxes = new this.ChatBoxes();
            this.chatboxesview = new this.ChatBoxesView({
                'model': this.chatboxes
            });

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

            // Controlbox toggler
            $toggle.bind('click', $.proxy(function (e) {
                e.preventDefault();
                if ($("div#controlbox").is(':visible')) {
                    this.chatboxesview.closeChat('controlbox');
                } else {
                    this.chatboxesview.openChat('controlbox');
                }
            }, this));
        }, this));
    }, xmppchat));
}));

