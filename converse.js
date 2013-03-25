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
    if (console===undefined || console.log===undefined) {
        console = { log: function () {}, error: function () {} };
    }
    if (typeof define === 'function' && define.amd) {
        require.config({
            paths: {
                "burry": "Libraries/burry.js/burry",
                "sjcl": "Libraries/sjcl",
                "tinysort": "Libraries/jquery.tinysort",
                "underscore": "Libraries/underscore",
                "backbone": "Libraries/backbone",
                "localstorage": "Libraries/backbone.localStorage",
                "strophe": "Libraries/strophe",
                "strophe.muc": "Libraries/strophe.muc",
                "strophe.roster": "Libraries/strophe.roster",
                "strophe.vcard": "Libraries/strophe.vcard"
            },

            // define module dependencies for modules not using define
            shim: {
                'backbone': {
                    //These script dependencies should be loaded before loading
                    //backbone.js
                    deps: [
                        'underscore',
                        'jquery'
                        ],
                    //Once loaded, use the global 'Backbone' as the
                    //module value.
                    exports: 'Backbone'
                },

                'underscore': {
                    exports: '_'
                },

                'strophe.muc': {
                    deps: ['strophe', 'jquery']
                },

                'strophe.roster': {
                    deps: ['strophe', 'jquery']
                },

                'strophe.vcard': {
                    deps: ['strophe', 'jquery']
                }
            }
        });

        define("converse", [
            "burry",
            "localstorage",
            "tinysort",
            "sjcl",
            "strophe.muc",
            "strophe.roster",
            "strophe.vcard"
            ], function(Burry) {
                    var store = new Burry.Store('collective.xmpp.chat');
                    // Use Mustache style syntax for variable interpolation
                    _.templateSettings = {
                        evaluate : /\{\[([\s\S]+?)\]\}/g,
                        interpolate : /\{\{([\s\S]+?)\}\}/g
                    };
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
        root.xmppchat = factory(jQuery, store, _, console || {log: function(){}});
    }
}(this, function ($, store, _, console) {

    var xmppchat = {};
    xmppchat.msg_counter = 0;

    var strinclude = function(str, needle){
      if (needle === '') { return true; }
      if (str === null) { return false; }
      return String(str).indexOf(needle) !== -1;
    };

    xmppchat.autoLink = function (text) {
        // Convert URLs into hyperlinks
        var re = /((http|https|ftp):\/\/[\w?=&.\/\-;#~%\-]+(?![\w\s?&.\/;#~%"=\-]*>))/g;
        return text.replace(re, '<a target="_blank" href="$1">$1</a>');
    };

    xmppchat.toISOString = function (date) {
        var pad;
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

    xmppchat.parseISO8601 = function (datestr) {
        /* Parses string formatted as 2013-02-14T11:27:08.268Z to a Date obj.
        */
        var numericKeys = [1, 4, 5, 6, 7, 10, 11],
            struct = /^\s*(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}\.?\d*)Z\s*$/.exec(datestr),
            minutesOffset = 0,
            i;

        for (i = 0, k; (k = numericKeys[i]); ++i) {
            struct[k] = +struct[k] || 0;
        }
        // allow undefined days and months
        struct[2] = (+struct[2] || 1) - 1;
        struct[3] = +struct[3] || 1;
        if (struct[8] !== 'Z' && struct[9] !== undefined) {
            minutesOffset = struct[10] * 60 + struct[11];

            if (struct[9] === '+') {
                minutesOffset = 0 - minutesOffset;
            }
        }
        return new Date(Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]));
    };

    xmppchat.updateMsgCounter = function () {
        if (this.msg_counter > 0) {
            if (document.title.search(/^Messages \(\d+\) /) == -1) {
                document.title = "Messages (" + this.msg_counter + ") " + document.title;
            } else {
                document.title = document.title.replace(/^Messages \(\d+\) /, "Messages (" + this.msg_counter + ") ");
            }
            window.blur();
            window.focus();
        } else if (document.title.search(/^Messages \(\d+\) /) != -1) {
            document.title = document.title.replace(/^Messages \(\d+\) /, "");
        }
    };

    xmppchat.incrementMsgCounter = function () {
        this.msg_counter += 1;
        this.updateMsgCounter();
    };

    xmppchat.clearMsgCounter = function () {
        this.msg_counter = 0;
        this.updateMsgCounter();
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

    xmppchat.Message = Backbone.Model.extend();

    xmppchat.Messages = Backbone.Collection.extend({
        model: xmppchat.Message
    });

    xmppchat.ChatBox = Backbone.Model.extend({
        initialize: function () {
            if (this.get('box_id') !== 'controlbox') {
                this.messages = new xmppchat.Messages();
                this.messages.localStorage = new Backbone.LocalStorage(
                    hex_sha1('converse.messages'+this.get('jid')));
                this.set({
                    'user_id' : Strophe.getNodeFromJid(this.get('jid')),
                    'box_id' : hex_sha1(this.get('jid')),
                    'fullname' : this.get('fullname'),
                    'url': this.get('url'),
                    'image_type': this.get('image_type'),
                    'image_src': this.get('image_src')
                });
            }
        },

        messageReceived: function (message) {
            var $message = $(message),
                body = xmppchat.autoLink($message.children('body').text()),
                from = Strophe.getBareJidFromJid($message.attr('from')),
                composing = $message.find('composing'),
                delayed = $message.find('delay').length > 0,
                fullname = this.get('fullname').split(' ')[0],
                stamp, time, sender;

            if (!body) {
                if (composing.length) {
                    this.messages.add({
                        fullname: fullname,
                        sender: 'them',
                        delayed: delayed,
                        composing: composing.length
                    });
                }
            } else {
                if (delayed) {
                    stamp = $message.find('delay').attr('stamp');
                    time = (new Date(stamp)).toLocaleTimeString().substring(0,5);
                } else {
                    time = (new Date()).toLocaleTimeString().substring(0,5);
                }
                if (from == xmppchat.connection.bare_jid) {
                    fullname = 'me';
                    sender = 'me';
                } else {
                    sender = 'them';
                }
                this.messages.create({
                    fullname: fullname,
                    sender: sender,
                    delayed: delayed,
                    time: time,
                    message: body
                });
            }
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

        insertStatusNotification: function (message, replace) {
            var $chat_content = this.$el.find('.chat-content');
            $chat_content.find('div.chat-event').remove().end()
                .append($('<div class="chat-event"></div>').text(message));
            this.scrollDown();
        },

        showMessage: function (message) {
            /*
             * FIXME: we don't use client storage anymore
            var msg = xmppchat.storage.getLastMessage(this.model.get('jid'));
            if (typeof msg !== 'undefined') {
                var prev_date = new Date(Date(msg.split(' ', 2)[0]));
                if (this.isDifferentDay(prev_date, now)) {
                    $chat_content.append($('<div class="chat-date">&nbsp;</div>'));
                    $chat_content.append($('<div class="chat-date"></div>').text(now.toString().substring(0,15)));
                }
            }
            */
            var $chat_content = this.$el.find('.chat-content');
            if (xmppchat.xmppstatus.getStatus() === 'offline') {
                // only update the UI if the user is not offline
                return;
            }
            if (message.get('composing')) {
                this.insertStatusNotification(message.get('fullname')+' '+'is typing');
                return;
            } else {
                $chat_content.find('div.chat-event').remove();
                // TODO use toJSON here
                $chat_content.append(
                        this.message_template({
                            'sender': message.get('sender'),
                            'time': message.get('time'),
                            'message': message.get('message'),
                            'username': message.get('fullname'),
                            'extra_classes': message.get('delayed') && 'delayed' || ''
                        }));
            }
            if (message.get('sender') != 'me') {
                xmppchat.incrementMsgCounter();
            }
            this.scrollDown();
        },

        isDifferentDay: function (prev_date, next_date) {
            return (
                (next_date.getDate() != prev_date.getDate()) || 
                (next_date.getFullYear() != prev_date.getFullYear()) || 
                (next_date.getMonth() != prev_date.getMonth()));
        },

        addHelpMessages: function (msgs) {
            var $chat_content = this.$el.find('.chat-content'), i,
                msgs_length = msgs.length;
            for (i=0; i<msgs_length; i++) {
                $chat_content.append($('<div class="chat-help">'+msgs[i]+'</div>'));
            }
            this.scrollDown();
        },

        sendMessage: function (text) {
            // TODO: Look in ChatPartners to see what resources we have for the recipient.
            // if we have one resource, we sent to only that resources, if we have multiple
            // we send to the bare jid.
            var timestamp = (new Date()).getTime(),
                bare_jid = this.model.get('jid'),
                match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/),
                msgs;

            if (match) {
                if (match[1] === "clear") {
                    this.$el.find('.chat-content').empty();
                    this.model.messages.reset();
                    return;
                }
                else if (match[1] === "help") {
                    msgs =  [
                        '<strong>/help</strong>: Show this menu',
                        '<strong>/clear</strong>: Remove messages'
                        ];
                    this.addHelpMessages(msgs);
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
            // Add the new message
            this.model.messages.create({
                fullname: 'me',
                sender: 'me',
                time: (new Date()).toLocaleTimeString().substring(0,5),
                message: text 
            });
        },

        keyPressed: function (ev) {
            var $textarea = $(ev.target),
                message,
                notify,
                composing;

            if(ev.keyCode == 13) {
                ev.preventDefault();
                message = $textarea.val();
                $textarea.val('').focus();
                if (message !== '') {
                    if (this.model.get('chatroom')) {
                        this.sendChatRoomMessage(message);
                    } else {
                        this.sendMessage(message);
                    }
                }
                this.$el.data('composing', false);

            } else if (!this.model.get('chatroom')) {
                // composing data is only for single user chat
                composing = this.$el.data('composing');
                if (!composing) {
                    if (ev.keyCode != 47) {
                        // We don't send composing messages if the message
                        // starts with forward-slash.
                        notify = $msg({'to':this.model.get('jid'), 'type': 'chat'})
                                        .c('composing', {'xmlns':'http://jabber.org/protocol/chatstates'});
                        xmppchat.connection.send(notify);
                    }
                    this.$el.data('composing', true);
                }
            }
        },

        onChange: function (item, changed) {
            if (_.has(changed.changes, 'chat_status')) {
                var chat_status = item.get('chat_status'),
                    fullname = item.get('fullname');
                if (this.$el.is(':visible')) {
                    if (chat_status === 'offline') {
                        this.insertStatusNotification(fullname+' '+'has gone offline');
                    } else if (chat_status === 'away') {
                        this.insertStatusNotification(fullname+' '+'has gone away');
                    } else if ((chat_status === 'dnd')) {
                        this.insertStatusNotification(fullname+' '+'is busy');
                    } else if (chat_status === 'online') {
                        this.$el.find('div.chat-event').remove();
                    }
                }
            } if (_.has(changed.changes, 'status')) {
                this.showStatusMessage(item.get('status'));
            }
        },

        showStatusMessage: function (msg) {
            this.$el.find('p.user-custom-message').text(msg).attr('title', msg);
        },

        closeChat: function () {
            this.model.destroy();
        },

        initialize: function (){
            this.model.messages.on('add', this.showMessage, this);
            this.model.on('show', this.show, this);
            this.model.on('destroy', function (model, response, options) { this.$el.hide('fast'); }, this);
            this.model.on('change', this.onChange, this);

            this.$el.appendTo(xmppchat.chatboxesview.$el);
            this.render().show().model.messages.fetch({add: true});
            if (this.model.get('status')) {
                this.showStatusMessage(this.model.get('status'));
            }
            xmppchat.clearMsgCounter();
        },

        template: _.template(
                    '<div class="chat-head chat-head-chatbox">' +
                        '<a class="close-chatbox-button">X</a>' +
                        '<a href="{{url}}" target="_blank" class="user">' +
                            '<canvas height="35px" width="35px" class="avatar"></canvas>' +
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
            this.$el.attr('id', this.model.get('box_id'))
                    .html(this.template(this.model.toJSON()));

            var img_src = 'data:'+this.model.get('image_type')+';base64,'+this.model.get('image');
            var ctx = this.$el.find('canvas').get(0).getContext('2d');
            var img = new Image();   // Create new Image object
            img.onload = function() {
                var ratio = img.width/img.height;
                ctx.drawImage(img,0,0, 35*ratio, 35);
            };
            img.src = img_src;
            return this;
        },

        focus: function () {
            this.$el.find('.chat-textarea').focus();
            return this;
        },

        show: function () {
            this.$el.css({'opacity': 0, 'display': 'inline'}) .animate({opacity: '1'}, 200);
            if (xmppchat.connection) {
                // Without a connection, we haven't yet initialized
                // localstorage
                this.model.save();
            }
            return this;
        },

        scrollDown: function () {
            var $content = this.$el.find('.chat-content');
            $content.scrollTop($content[0].scrollHeight);
            return this;
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
                        '<option value="dnd">Busy</option>'+
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
            this.$parent.find('#controlbox-tabs').append(this.tab_template());
            this.$parent.find('#controlbox-panes').append(this.$el.html(this.template()));
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
                    if ($results_el.children().length) {
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
            var $target = $(ev.target),
                jid = $target.attr('data-recipient'),
                name = $target.text();
            xmppchat.connection.roster.add(jid, name, [], function (iq) {
                xmppchat.connection.roster.subscribe(jid);
            });
            $target.parent().remove();
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
            '<a class="open-room" data-room-jid="{{jid}}"' +
                ' title="Click to open this chatroom"' +
                ' href="#">' +
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
            this.$parent.find('#controlbox-tabs').append(this.tab_template());
            this.$parent.find('#controlbox-panes').append(this.$el.html(this.template()).hide());
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
                var name, jid, i,
                    rooms = $(iq).find('query').find('item'),
                    rooms_length = rooms.length,
                    $available_chatrooms = this.$el.find('#available-chatrooms');
                $available_chatrooms.find('dd.available-chatroom').remove();
                if (rooms.length) {
                    $available_chatrooms.find('dt').show();
                } else {
                    $available_chatrooms.find('dt').hide();
                }
                for (i=0; i<rooms_length; i++) {
                    name = Strophe.unescapeNode($(rooms[i]).attr('name'));
                    jid = $(rooms[i]).attr('jid');
                    $available_chatrooms.append(this.room_template({'name':name, 'jid':jid}));
                }
                return true;
            }, this));
        },

        createChatRoom: function (ev) {
            ev.preventDefault();
            var name, jid;
            if (ev.type === 'click') {
                jid = $(ev.target).attr('data-room-jid');
            } else {
                name = $(ev.target).find('input.new-chatroom-name').val().trim().toLowerCase();
                if (name) {
                    jid = Strophe.escapeNode(name) + '@' + xmppchat.connection.muc_domain;
                } else {
                    return;
                }
            }
            xmppchat.chatboxes.create({
                'id': jid,
                'jid': jid,
                'name': Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                'nick': xmppchat.fullname,
                'chatroom': true,
                'box_id' : hex_sha1(jid)
            });
        }
    });

    xmppchat.ControlBoxView = xmppchat.ChatBoxView.extend({
        tagName: 'div',
        className: 'chatbox',
        id: 'controlbox',
        events: {
            'click a.close-chatbox-button': 'closeChat',
            'click ul#controlbox-tabs li a': 'switchTab'
        },

        initialize: function () {
            this.$el.appendTo(xmppchat.chatboxesview.$el);
            this.model.on('change', $.proxy(function (item, changed) {
                if (_.has(item.changed, 'connected')) {
                    this.render().appendRoster();
                }
                if (_.has(item.changed, 'visible')) {
                    if (item.changed.visible === true) {
                        this.show();
                    } 
                }
            }, this));

            this.model.on('show', this.show, this);
            this.model.on('destroy', $.proxy(function (model, response, options) {
                this.$el.hide('fast');
            }, this));

            if (this.model.get('visible')) {
                this.show();
            } 
        },

        appendRoster: function () {
            xmppchat.rosterview.$el.appendTo(this.contactspanel.$el);
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

        addHelpMessages: function (msgs) {
            // Override addHelpMessages in ChatBoxView, for now do nothing.
            return;
        },

        render: function () {
            this.$el.html(this.template(this.model.toJSON()));
            if ((!xmppchat.prebind) && (!xmppchat.connection)) {
                // Add login panel if the user still has to authenticate
                this.loginpanel = new xmppchat.LoginPanel();
                this.loginpanel.$parent = this.$el;
                this.loginpanel.render();
            } else {
                this.contactspanel = new xmppchat.ContactsPanel();
                this.contactspanel.$parent = this.$el;
                this.contactspanel.render();
                // TODO: Only add the rooms panel if the server supports MUC
                this.roomspanel = new xmppchat.RoomsPanel(); 
                this.roomspanel.$parent = this.$el;
                this.roomspanel.render();
            }
            return this;
        }
    });

    xmppchat.ChatRoomView = xmppchat.ChatBoxView.extend({
        length: 300,
        tagName: 'div',
        className: 'chatroom',
        events: {
            'click a.close-chatbox-button': 'closeChat',
            'keypress textarea.chat-textarea': 'keyPressed'
        },

        sendChatRoomMessage: function (body) {
            var match = body.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false],
                $chat_content;
            switch (match[1]) {
                case 'msg':
                    // TODO: Private messages
                    break;
                case 'topic':
                    xmppchat.connection.muc.setTopic(this.model.get('jid'), match[2]);
                    break;
                case 'kick':
                    xmppchat.connection.muc.kick(this.model.get('jid'), match[2]);
                    break;
                case 'ban':
                    xmppchat.connection.muc.ban(this.model.get('jid'), match[2]);
                    break;
                case 'op':
                    xmppchat.connection.muc.op(this.model.get('jid'), match[2]);
                    break;
                case 'deop':
                    xmppchat.connection.muc.deop(this.model.get('jid'), match[2]);
                    break;
                case 'help':
                    $chat_content = this.$el.find('.chat-content');
                    $chat_content.append('<div class="chat-help"><strong>/help</strong>: Show this menu</div>' +
                                         '<div class="chat-help"><strong>/topic</strong>: Set chatroom topic</div>');
                    /* TODO:
                    $chat_content.append($('<div class="chat-help"><strong>/kick</strong>: Kick out user</div>'));
                    $chat_content.append($('<div class="chat-help"><strong>/ban</strong>: Ban user</div>'));
                    $chat_content.append($('<div class="chat-help"><strong>/op $user</strong>: Remove messages</div>'));
                    $chat_content.append($('<div class="chat-help"><strong>/deop $user</strong>: Remove messages</div>'));
                    */
                    this.scrollDown();
                    break;
                default:
                    this.last_msgid = xmppchat.connection.muc.groupchat(this.model.get('jid'), body);
                break;
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
                            $.proxy(this.onChatRoomMessage, this),
                            $.proxy(this.onChatRoomPresence, this),
                            $.proxy(this.onChatRoomRoster, this));


            this.model.messages.on('add', this.showMessage, this);
            this.model.on('destroy', function (model, response, options) { 
                this.$el.hide('fast'); 
                xmppchat.connection.muc.leave(
                    this.model.get('jid'),
                    this.model.get('nick'),
                    this.onLeave,
                    undefined);
            }, 
            this);
            this.$el.appendTo(xmppchat.chatboxesview.$el);
            this.render().show().model.messages.fetch({add: true});
            xmppchat.clearMsgCounter();
        },

        onLeave: function () {
            var controlboxview = xmppchat.chatboxesview.views.controlbox;
            if (controlboxview) {
                controlboxview.roomspanel.trigger('update-rooms-list');
            }
        },

        onChatRoomPresence: function (presence, room) {
            // TODO see if nick is useful
            var nick = room.nick,
                $presence = $(presence),
                from = $presence.attr('from');
            if ($presence.attr('type') !== 'error') {
                // check for status 110 to see if it's our own presence
                if ($presence.find("status[code='110']").length) {
                    // check if server changed our nick
                    if ($presence.find("status[code='210']").length) {
                        this.model.set({'nick': Strophe.getResourceFromJid(from)});
                    }
                }
            }
            return true;
        },

        onChatRoomMessage: function (message) {
            var $message = $(message),
                body = $message.children('body').text(),
                jid = $message.attr('from'),
                $chat_content = this.$el.find('.chat-content'),
                sender = Strophe.unescapeNode(Strophe.getResourceFromJid(jid)),
                delayed = $message.find('delay').length > 0,
                subject = $message.children('subject').text(),
                match, template;
            if (!body) { return true; } // XXX: Necessary?
            if (subject) {
                this.$el.find('.chatroom-topic').text(subject).attr('title', subject);
            }
            if (delayed) {
                stamp = $message.find('delay').attr('stamp');
                time = (new Date(stamp)).toLocaleTimeString().substring(0,5);
            } else {
                time = (new Date()).toLocaleTimeString().substring(0,5);
            }
            match = body.match(/^\/(.*?)(?: (.*))?$/);
            if ((match) && (match[1] === 'me')) {
                body = body.replace(/^\/me/, '*'+sender);
                template = this.action_template;
            } else  {
                template = this.message_template;
            }
            if (sender === this.model.get('nick')) {
                sender = 'me';
            }
            $chat_content.append(
                template({
                    'sender': sender == 'me' && sender || 'room',
                    'time': time,
                    'message': body,
                    'username': sender,
                    'extra_classes': delayed && 'delayed' || ''
                })
            );
            this.scrollDown();
            return true;
        },

        onChatRoomRoster: function (roster, room) {
            // underscore size is needed because roster is on object
            var controlboxview = xmppchat.chatboxesview.views.controlbox,
                roster_size = _.size(roster),
                $participant_list = this.$el.find('.participant-list'),
                participants = [],
                i;

            if (controlboxview) {
                controlboxview.roomspanel.trigger('update-rooms-list');
            }
            this.$el.find('.participant-list').empty();
            for (i=0; i<roster_size; i++) {
                participants.push('<li>' + Strophe.unescapeNode(_.keys(roster)[i]) + '</li>');
            }
            $participant_list.append(participants.join(""));
            return true;
        },

        render: function () {
            this.$el.attr('id', this.model.get('box_id'))
                    .html(this.template(this.model.toJSON()));
            return this;
        }
    });

    xmppchat.ChatBoxes = Backbone.Collection.extend({
        model: xmppchat.ChatBox,

        onConnected: function () {
            this.localStorage = new Backbone.LocalStorage(
                hex_sha1('converse.chatboxes-'+xmppchat.connection.bare_jid));
            if (!this.get('controlbox')) {
                this.add({
                    id: 'controlbox',
                    box_id: 'controlbox'
                });
            }
            // This will make sure the Roster is set up
            this.get('controlbox').set({connected:true});
            // Get cached chatboxes from localstorage
            this.fetch({
                add: true, success: 
                $.proxy(function (collection, resp) {
                    if (_.include(_.pluck(resp, 'id'), 'controlbox')) {
                        // If the controlbox was saved in localstorage, it must be visible
                        this.get('controlbox').set({visible:true});
                    }
                }, this)
            }); 
        },

        messageReceived: function (message) {
            var  partner_jid, $message = $(message),
                 message_from = $message.attr('from');
            if (message_from == xmppchat.connection.jid) {
                // FIXME: Forwarded messages should be sent to specific resources, 
                // not broadcasted
                return true;
            }
            var $forwarded = $message.children('forwarded');
            if ($forwarded.length) {
                $message = $forwarded.children('message');
            }
            var from = Strophe.getBareJidFromJid(message_from),
                to = Strophe.getBareJidFromJid($message.attr('to')),
                resource, chatbox;
            if (from == xmppchat.connection.bare_jid) {
                // I am the sender, so this must be a forwarded message...
                partner_jid = to;
                resource = Strophe.getResourceFromJid($message.attr('to'));
            } else {
                partner_jid = from;
                resource = Strophe.getResourceFromJid(message_from);
            }

            chatbox = this.get(partner_jid);
            if (!chatbox) {
                xmppchat.getVCard(
                    partner_jid, 
                    $.proxy(function (jid, fullname, image, image_type, url) {
                        chatbox = this.create({
                            'id': jid,
                            'jid': jid,
                            'fullname': fullname,
                            'image_type': image_type,
                            'image': image,
                            'url': url
                        });
                        chatbox.messageReceived(message);
                        xmppchat.roster.addResource(partner_jid, resource);
                    }, this),
                    $.proxy(function () {
                        // # FIXME
                        console.log("An error occured while fetching vcard");
                    }, this));
                return true;
            }
            chatbox.messageReceived(message);
            xmppchat.roster.addResource(partner_jid, resource);
            return true;
        }
    });

    xmppchat.ChatBoxesView = Backbone.View.extend({
        el: '#collective-xmpp-chat-data',

        initialize: function () {
            // boxesviewinit
            this.views = {};
            this.options.model.on("add", function (item) {
                var view = this.views[item.get('id')];
                if (!view) {
                    if (item.get('chatroom')) {
                        view = new xmppchat.ChatRoomView({'model': item});
                    } else if (item.get('box_id') === 'controlbox') {
                        view = new xmppchat.ControlBoxView({model: item});
                        view.render();
                    } else {
                        view = new xmppchat.ChatBoxView({model: item});
                    }
                    this.views[item.get('id')] = view;
                } else {
                    view.model = item;
                    view.initialize();
                    if (item.get('id') !== 'controlbox') {
                        // FIXME: Why is it necessary to append chatboxes again?
                        view.$el.appendTo(this.$el);
                    }
                }
            }, this);
        }
    });

    xmppchat.RosterItem = Backbone.Model.extend({
        initialize: function (attributes, options) {
            var jid = attributes['jid'];
            if (!attributes['fullname']) {
                attributes['fullname'] = jid;
            }
            _.extend(attributes, {
                'id': jid,
                'user_id': Strophe.getNodeFromJid(jid),
                'resources': [],
                'chat_status': 'offline',
                'status': 'offline',
                'sorted': false
            });
            this.set(attributes);
        }
    });

    xmppchat.RosterItemView = Backbone.View.extend({
        tagName: 'dd',

        events: {
            "click .accept-xmpp-request": "acceptRequest",
            "click .decline-xmpp-request": "declineRequest",
            "click .open-chat": "openChat",
            "click .remove-xmpp-contact": "removeContact"
        },

        openChat: function (ev) {
            ev.preventDefault();
            var jid = Strophe.getBareJidFromJid(this.model.get('jid')),
                chatbox  = xmppchat.chatboxes.get(jid);
            if (chatbox) {
                chatbox.trigger('show');
            } else {
                xmppchat.chatboxes.create({
                    'id': this.model.get('jid'),
                    'jid': this.model.get('jid'),
                    'fullname': this.model.get('fullname'),
                    'image_type': this.model.get('image_type'),
                    'image': this.model.get('image'),
                    'url': this.model.get('url')
                });
            }
        },

        removeContact: function (ev) {
            ev.preventDefault();
            var result = confirm("Are you sure you want to remove this contact?");
            if (result==true) {
                var bare_jid = this.model.get('jid');
                xmppchat.connection.roster.remove(bare_jid, function (iq) {
                    xmppchat.connection.roster.unauthorize(bare_jid);
                    xmppchat.rosterview.model.remove(bare_jid);
                });
            }
        },

        acceptRequest: function (ev) {
            var jid = this.model.get('jid');
            xmppchat.connection.roster.authorize(jid);
            xmppchat.connection.roster.add(jid, this.model.get('fullname'), [], function (iq) {
                xmppchat.connection.roster.subscribe(jid);
            });
            ev.preventDefault();
        },

        declineRequest: function (ev) {
            var that = this;
            xmppchat.connection.roster.unauthorize(this.model.get('jid'));
            that.trigger('decline-request', that.model);
            ev.preventDefault();
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
                subscription = item.get('subscription');
            this.$el.addClass(item.get('chat_status'));

            if (ask === 'subscribe') {
                this.$el.addClass('pending-xmpp-contact');
                this.$el.html(this.pending_template(item.toJSON()));
            } else if (ask === 'request') {
                this.$el.addClass('requesting-xmpp-contact');
                this.$el.html(this.request_template(item.toJSON()));
                xmppchat.chatboxes.get('controlbox').trigger('show');
            } else if (subscription === 'both' || subscription === 'to') {
                this.$el.addClass('current-xmpp-contact');
                this.$el.html(this.template(item.toJSON()));
            }

            return this;
        },

        initialize: function () {
            this.options.model.on('change', function (item, changed) {
                if (_.has(changed.changes, 'chat_status')) {
                    this.$el.attr('class', item.changed.chat_status);
                }
            }, this);
        }
    });

    xmppchat.getVCard = function (jid, callback, errback) {
        /* First we check if we don't already have a RosterItem, since it will
         * contain all the vCard details.
         */
        var model = xmppchat.roster.getItem(jid);
        if (model) {
            callback(
                model.get('jid'), 
                model.get('fullname'), 
                model.get('image'),
                model.get('image_type'), 
                model.get('url')
            );
        } else {
            xmppchat.connection.vcard.get($.proxy(function (iq) {
                $vcard = $(iq).find('vCard');
                var fullname = $vcard.find('FN').text(),
                    img = $vcard.find('BINVAL').text(),
                    img_type = $vcard.find('TYPE').text(),
                    url = $vcard.find('URL').text();
                callback(jid, fullname, img, img_type, url);
            }, this), jid, errback());
        }
    }

    xmppchat.RosterItems = Backbone.Collection.extend({
        model: xmppchat.RosterItem,
        comparator : function (rosteritem) {
            var chat_status = rosteritem.get('chat_status'),
                rank = 4;
            switch(chat_status) {
                case 'offline':
                    rank = 0;
                    break;
                case 'unavailable':
                    rank = 1;
                    break;
                case 'xa':
                    rank = 2;
                    break;
                case 'away':
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
                var $this = $(this),
                    jid = $this.attr('jid'),
                    action = $this.attr('action'),
                    fullname = $this.attr('name');
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

        addRosterItem: function (attributes) {
            var model = new xmppchat.RosterItem(attributes);
            this.add(model);
            model.save();
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

        subscribeBack: function (jid) {
            // XXX: Why the distinction between jid and bare_jid?
            var bare_jid = Strophe.getBareJidFromJid(jid);
            if (xmppchat.connection.roster.findItem(bare_jid)) {
                xmppchat.connection.roster.authorize(bare_jid);
                xmppchat.connection.roster.subscribe(jid);
            } else {
                xmppchat.connection.roster.add(jid, '', [], function (iq) {
                    xmppchat.connection.roster.authorize(bare_jid);
                    xmppchat.connection.roster.subscribe(jid);
                });
            }
        },

        unsubscribe: function (jid) {
            /* Upon receiving the presence stanza of type "unsubscribed",
            * the user SHOULD acknowledge receipt of that subscription state
            * notification by sending a presence stanza of type "unsubscribe"
            * this step lets the user's server know that it MUST no longer
            * send notification of the subscription state change to the user.
            */
            xmppchat.xmppstatus.sendPresence('unsubscribe');
            if (xmppchat.connection.roster.findItem(jid)) {
                xmppchat.connection.roster.remove(bare_jid, function (iq) {
                    xmppchat.rosterview.model.remove(bare_jid);
                });
            }
        },

        getNumOnlineContacts: function () {
            var count = 0,
                models = this.models,
                models_length = models.length,
                i;
            for (i=0; i<models_length; i++) {
                if (_.indexOf(['offline', 'unavailable'], models[i].get('chat_status')) === -1) {
                    count++;
                }
            }
            return count;
        },

        cleanCache: function (items) {
            /* The localstorage cache containing roster contacts might contain
             * some contacts that aren't actually in our roster anymore. We
             * therefore need to remove them now.
             */
            var id, i,
                roster_ids = [];
            for (i=0; i < items.length; ++i) {
                roster_ids.push(items[i]['jid']);
            }
            for (i=0; i < this.models.length; ++i) {
                id = this.models[i].get('id');
                if (_.indexOf(roster_ids, id) === -1) {
                    this.getItem(id).destroy();
                }
            }
        },

        rosterHandler: function (items) {
            this.cleanCache(items);
            _.each(items, function (item, index, items) {
                if (this.isSelf(item.jid)) { return; }
                var model = this.getItem(item.jid);
                if (!model) {
                    is_last = false;
                    if (index === (items.length-1)) { is_last = true; }
                    xmppchat.getVCard(
                        item.jid, 
                        $.proxy(function (jid, fullname, img, img_type, url) {
                            this.addRosterItem({
                                jid: item.jid, 
                                subscription: item.subscription,
                                ask: item.ask,
                                fullname: fullname,
                                image: img,
                                image_type: img_type,
                                url: url,
                                is_last: is_last
                            });
                        }, this),
                        $.proxy(function () {
                            // TODO: Better handling here
                            // Error occured while fetching vcard
                            console.log("An error occured while fetching vcard");
                            this.addRosterItem({
                                jid: item.jid, 
                                subscription: item.subscription,
                                ask: item.ask,
                                is_last: is_last
                            });
                        }, this));
                } else {
                    if ((item.subscription === 'none') && (item.ask === null)) {
                        // This user is no longer in our roster
                        model.destroy();
                    } else if (model.get('subscription') !== item.subscription || model.get('ask') !== item.ask) {
                        // only modify model attributes if they are different from the
                        // ones that were already set when the rosterItem was added
                        model.set({'subscription': item.subscription, 'ask': item.ask});
                        model.save();
                    }
                }
            }, this);
        },

        presenceHandler: function (presence) {
            var $presence = $(presence),
                jid = $presence.attr('from'),
                bare_jid = Strophe.getBareJidFromJid(jid),
                resource = Strophe.getResourceFromJid(jid),
                presence_type = $presence.attr('type'),
                show = $presence.find('show'),
                chat_status = show.text() || 'online',
                status_message = $presence.find('status'),
                item;

            if (this.isSelf(bare_jid)) {
                if ((xmppchat.connection.jid !== jid)&&(presence_type !== 'unavailabe')) {
                    // Another resource has changed it's status, we'll update ours as well.
                    // FIXME: We should ideally differentiate between converse.js using
                    // resources and other resources (i.e Pidgin etc.)
                    xmppchat.xmppstatus.set({'status': chat_status});
                }
                return true;
            } else if (($presence.find('x').attr('xmlns') || '').indexOf(Strophe.NS.MUC) === 0) {
                return true; // Ignore MUC
            }

            item = this.getItem(bare_jid);
            if (status_message.text() != item.get('status')) {
                item.set({'status': status_message.text()});
            }

            if ((presence_type === 'error') || (presence_type === 'subscribed') || (presence_type === 'unsubscribe')) {
                return true;
            } else if (presence_type === 'subscribe') {
                if (xmppchat.auto_subscribe) {
                    if ((!item) || (item.get('subscription') != 'to')) {
                        this.subscribeBack(jid);
                    } else {
                        xmppchat.connection.roster.authorize(bare_jid);
                    }
                } else {
                    if ((item) && (item.get('subscription') != 'none'))  {
                        xmppchat.connection.roster.authorize(bare_jid);
                    } else {
                        xmppchat.getVCard(
                            bare_jid, 
                            $.proxy(function (jid, fullname, img, img_type, url) {
                                this.addRosterItem({
                                    jid: bare_jid, 
                                    subscription: 'none',
                                    ask: 'request',
                                    fullname: fullname,
                                    image: img,
                                    image_type: img_type,
                                    url: url,
                                    is_last: true
                                });
                            }, this),
                            $.proxy(function (jid, fullname, img, img_type, url) {
                                console.log("Error while retrieving vcard");
                                this.addRosterItem({
                                    jid: bare_jid, 
                                    subscription: 'none',
                                    ask: 'request',
                                    fullname: jid,
                                    is_last: true
                                });
                            }, this));
                    }
                }
            } else if (presence_type === 'unsubscribed') {
                this.unsubscribe(jid);
            } else if (presence_type === 'unavailable') {
                if (this.removeResource(bare_jid, resource) === 0) {
                    if (item) {
                        item.set({'chat_status': 'offline'});
                    }
                }
            } else {
                // presence_type is undefined
                this.addResource(bare_jid, resource);
                item.set({'chat_status': chat_status});
            }
            return true;
        }
    });

    xmppchat.RosterView = Backbone.View.extend({
        tagName: 'dl',
        id: 'xmppchat-roster',
        rosteritemviews: {},

        removeRosterItem: function (item) {
            var view = this.rosteritemviews[item.id];
            if (view) {
                view.$el.remove();
                delete this.rosteritemviews[item.id];
                this.render();
            }
        },

        initialize: function () {
            this.model.on("add", function (item) {
                var view = new xmppchat.RosterItemView({model: item});
                this.rosteritemviews[item.id] = view;
                if (item.get('ask') === 'request') {
                    view.on('decline-request', function (item) {
                        this.model.remove(item.id);
                    }, this);
                }
                this.render(item);
            }, this);

            this.model.on('change', function (item, changed) {
                this.updateChatBox(item, changed);
                this.render(item);
            }, this);

            this.model.on("remove", function (item) {
                this.removeRosterItem(item);
            }, this);

            // XXX: Not completely sure if this is needed ('remove' might be
            // enough).
            this.model.on("destroy", function (item) {
                this.removeRosterItem(item);
            }, this);

            this.$el.hide().html(this.template());
            this.model.fetch({add: true}); // Get the cached roster items from localstorage
            this.initialSort();
        },

        updateChatBox: function (item, changed) {
            var chatbox = xmppchat.chatboxes.get(item.get('jid')),
                changes = {};
            if (!chatbox) { return; }
            if (_.has(changed.changes, 'chat_status')) {
                changes.chat_status = item.get('chat_status');
            }
            if (_.has(changed.changes, 'status')) {
                changes.status = item.get('status');
            }
            chatbox.save(changes);
        },

        template: _.template('<dt id="xmpp-contact-requests">Contact requests</dt>' +
                            '<dt id="xmpp-contacts">My contacts</dt>' +
                            '<dt id="pending-xmpp-contacts">Pending contacts</dt>'),

        render: function (item) {
            var $my_contacts = this.$el.find('#xmpp-contacts'),
                $contact_requests = this.$el.find('#xmpp-contact-requests'),
                $pending_contacts = this.$el.find('#pending-xmpp-contacts'),
                $count, presence_change;
            if (item) {
                var jid = item.id,
                    view = this.rosteritemviews[item.id],
                    ask = item.get('ask'),
                    subscription = item.get('subscription'),
                    crit = {order:'asc'};

                if (ask === 'subscribe') {
                    $pending_contacts.after(view.render().el);
                    $pending_contacts.after($pending_contacts.siblings('dd.pending-xmpp-contact').tsort(crit));
                } else if (ask === 'request') {
                    $contact_requests.after(view.render().el);
                    $contact_requests.after($contact_requests.siblings('dd.requesting-xmpp-contact').tsort(crit));
                } else if (subscription === 'both' || subscription === 'to') {
                    if (!item.get('sorted')) {
                        // this attribute will be true only after all of the elements have been added on the page
                        // at this point all offline
                        $my_contacts.after(view.render().el);
                    }
                    else {
                        // just by calling render will be enough to change the icon of the existing item without
                        // having to reinsert it and the sort will come from the presence change
                        view.render();
                    }
                }
                presence_change = view.model.changed['chat_status'];
                if (presence_change) {
                    // resort all items only if the model has changed it's chat_status as this render
                    // is also triggered when the resource is changed which always comes before the presence change
                    // therefore we avoid resorting when the change doesn't affect the position of the item
                    $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.offline').tsort('a', crit));
                    $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.unavailable').tsort('a', crit));
                    $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.away').tsort('a', crit));
                    $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.dnd').tsort('a', crit));
                    $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.online').tsort('a', crit));
                }

                if (item.get('is_last') && !item.get('sorted')) {
                    // this will be true after all of the roster items have been added with the default
                    // options where all of the items are offline and now we can show the rosterView
                    item.set('sorted', true);
                    this.initialSort();
                    this.$el.show();
                }
            }
            // Hide the headings if there are no contacts under them
            _.each([$my_contacts, $contact_requests, $pending_contacts], function (h) {
                if (h.nextUntil('dt').length) {
                    h.show();
                }
                else {
                    h.hide();
                }
            });
            $count = $('#online-count');
            $count.text(this.model.getNumOnlineContacts());
            return this;
        },

        initialSort: function () {
            var $my_contacts = this.$el.find('#xmpp-contacts'),
                crit = {order:'asc'};
            $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.offline').tsort('a', crit));
            $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.unavailable').tsort('a', crit));
        },

    });

    xmppchat.XMPPStatus = Backbone.Model.extend({
        initialize: function () {
            this.set({
                'status' : this.getStatus(),
                'status_message' : this.getStatusMessage()
            });
        },

        initStatus: function () {
            /* Called when the page is loaded and we aren't sure what the users
             * status is. Will also cause the UI to be updated with the correct
             * status.
             */
            var stat = this.getStatus();
            if (stat === undefined) {
                this.setStatus('online');
            } else {
                this.sendPresence(stat);
            }
        },

        sendPresence: function (type) {
            var status_message = this.getStatusMessage(), 
                presence;
            if (type === 'unavailable') {
                presence = $pres({'type':type});
            } else {
                if (type === 'online') {
                    presence = $pres();
                } else {
                    presence = $pres().c('show').t(type);
                }
                if (status_message) {
                    presence.c('status').t(status_message)
                }
            }
            xmppchat.connection.send(presence);
        },

        getStatus: function () {
            return store.get(xmppchat.connection.bare_jid+'-xmpp-status');
        },

        setStatus: function (value) {
            this.sendPresence(value);
            this.set({'status': value});
            store.set(xmppchat.connection.bare_jid+'-xmpp-status', value);
        },

        getStatusMessage: function () {
            return store.get(xmppchat.connection.bare_jid+'-xmpp-custom-status');
        },

        setStatusMessage: function (status_message) {
            xmppchat.connection.send($pres().c('show').t(this.getStatus()).up().c('status').t(status_message));
            this.set({'status_message': status_message});
            store.set(xmppchat.connection.bare_jid+'-xmpp-custom-status', status_message);
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
                '<a class="choose-xmpp-status {{ chat_status }}" href="#" title="Click to change your chat status">' +
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

        getPrettyStatus: function (stat) {
            if (stat === 'chat') {
                pretty_status = 'online';
            } else if (stat === 'dnd') {
                pretty_status = 'busy';
            } else if (stat === 'xa') {
                pretty_status = 'away for long';
            } else {
                pretty_status = stat || 'online';
            }
            return pretty_status;
        },

        updateStatusUI: function (ev) {
            var stat = ev.get('status'), 
                status_message;
            status_message = ev.get('status_message') || "I am " + this.getPrettyStatus(stat);
            this.$el.find('#fancy-xmpp-status-select').html(
                this.status_template({
                        'chat_status': stat,
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
            this.model.initStatus();
            // Listen for status change on the model and initialize
            this.options.model.on("change", $.proxy(this.updateStatusUI, this));
        },

        render: function () {
            // Replace the default dropdown with something nicer
            var $select = this.$el.find('select#select-xmpp-status'),
                chat_status = this.model.getStatus() || 'offline',
                options = $('option', $select),
                $options_target,
                options_list = [],
                that = this;
            this.$el.html(this.choose_template());
            this.$el.find('#fancy-xmpp-status-select')
                    .html(this.status_template({
                            'status_message': "I am " + this.getPrettyStatus(chat_status),
                            'chat_status': chat_status
                            }));
            // iterate through all the <option> elements and add option values
            options.each(function(){
                options_list.push(that.option_template({
                                                        'value': $(this).val(),
                                                        'text': $(this).text()
                                                        }));
            });
            $options_target = this.$el.find("#target dd ul").hide();
            $options_target.append(options_list.join(''));
            $select.remove();
        }
    });

    xmppchat.LoginPanel = Backbone.View.extend({
        tagName: 'div',
        id: "login-dialog",
        events: {
            'submit form#xmppchat-login': 'authenticate'
        },
        tab_template: _.template(
            '<li><a class="current" href="#login">Sign in</a></li>'),
        template: _.template(
            '<form id="xmppchat-login">' +
            '<label>XMPP ID:</label>' +
            '<input type="text" id="jid">' +
            '<label>Password:</label>' +
            '<input type="password" id="password">' +
            '<label>BOSH Service URL:</label>' +
            '<input type="text" id="bosh_service_url">' +
            '<input type="submit" name="submit"/>' +
            '</form">'),

        authenticate: function (ev) {
            ev.preventDefault();
            var $form = $(ev.target),
                bosh_service_url = $form.find('input#bosh_service_url').val(),
                jid = $form.find('input#jid').val(),
                password = $form.find('input#password').val(),
                connection = new Strophe.Connection(bosh_service_url);

            connection.connect(jid, password, $.proxy(function (status) {
                if (status === Strophe.Status.CONNECTED) {
                    $(document).trigger('jarnxmpp.connected', connection);
                } else if (status === Strophe.Status.DISCONNECTED) {
                    console.log('Disconnected');
                    $(document).trigger('jarnxmpp.disconnected');
                } else if (status === Strophe.Status.Error) {
                    console.log('Error');
                } else if (status === Strophe.Status.CONNECTING) {
                    console.log('Connecting');
                    $(document).trigger('jarnxmpp.connecting');
                } else if (status === Strophe.Status.CONNFAIL) {
                    console.log('Connection Failed');
                } else if (status === Strophe.Status.AUTHENTICATING) {
                    console.log('Authenticating');
                } else if (status === Strophe.Status.AUTHFAIL) {
                    console.log('Authenticating Failed');
                } else if (status === Strophe.Status.DISCONNECTING) {
                    console.log('Disconnecting');
                } else if (status === Strophe.Status.ATTACHED) {
                    console.log('Attached');
                }
            }, this));
        },

        remove: function () {
            this.$parent.find('#controlbox-tabs').empty();
            this.$parent.find('#controlbox-panes').empty();
        },

        render: function () {
            this.$parent.find('#controlbox-tabs').append(this.tab_template());
            this.$parent.find('#controlbox-panes').append(this.$el.html(this.template()));
            return this;
        }
    });

    // Event handlers
    // --------------
    $(document).ready($.proxy(function () {
        var chatdata = $('div#collective-xmpp-chat-data'),
            $connecting = $('span#connecting-to-chat').hide(),
            $toggle = $('a#toggle-online-users');
        this.prebind = chatdata.attr('prebind');
        this.fullname = chatdata.attr('fullname');
        this.auto_subscribe = chatdata.attr('auto_subscribe') === "True" || false;

        this.chatboxes = new this.ChatBoxes();
        this.chatboxesview = new this.ChatBoxesView({model: this.chatboxes});

        $toggle.bind('click', $.proxy(function (e) {
            e.preventDefault();
            if ($("div#controlbox").is(':visible')) {
                this.chatboxes.get('controlbox').destroy();
            } else {
                var controlbox = this.chatboxes.get('controlbox');
                if (!controlbox) {
                    controlbox = this.chatboxes.create({
                        id: 'controlbox',
                        box_id: 'controlbox',
                        visible: true
                    });
                } else {
                    controlbox.trigger('show');
                }
            }
        }, this));

        $(document).bind('jarnxmpp.connecting', $.proxy(function (ev, conn) {
            $toggle.hide(function () {
                $connecting.show();
            });
        }, this));

        $(document).bind('jarnxmpp.disconnected', $.proxy(function (ev, conn) {
            $toggle.hide();
            $connecting.html('Unable to communicate with chat server')
                       .css('background-image', "url(images/error_icon.png)")
                       .show();
            console.log("Connection Failed :(");
        }, this));

        $(document).unbind('jarnxmpp.connected');
        $(document).bind('jarnxmpp.connected', $.proxy(function (ev, connection) {
            this.connection = connection;
            this.connection.xmlInput = function (body) { console.log(body); };
            this.connection.xmlOutput = function (body) { console.log(body); };
            this.connection.bare_jid = Strophe.getBareJidFromJid(this.connection.jid);
            this.connection.domain = Strophe.getDomainFromJid(this.connection.jid);
            this.connection.muc_domain = 'conference.' +  this.connection.domain;

            // Set up the roster
            this.roster = new this.RosterItems();
            this.roster.localStorage = new Backbone.LocalStorage(
                hex_sha1('converse.rosteritems-'+this.connection.bare_jid));
            this.rosterview = new this.RosterView({'model':this.roster});

            this.xmppstatus = new this.XMPPStatus();
            this.chatboxes.onConnected();

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
                            this.chatboxes.messageReceived(message);
                            return true;
                        }, this), null, 'message', 'chat');

                // XMPP Status
                this.xmppstatusview = new this.XMPPStatusView({
                    'model': this.xmppstatus
                });
                this.xmppstatusview.render();
            }, this));
            $connecting.hide();
            $toggle.show();
        }, this));
    }, xmppchat));

    return xmppchat;
}));
