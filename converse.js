/*!
 * Converse.js (Web-based XMPP instant messaging client)
 * http://conversejs.org
 *
 * Copyright (c) 2012, Jan-Carel Brand <jc@opkode.com>
 * Dual licensed under the MIT and GPL Licenses
 */

// AMD/global registrations
(function (root, factory) {
    if (console===undefined || console.log===undefined) {
        console = { log: function () {}, error: function () {} };
    }
    if (typeof define === 'function' && define.amd) {
        require.config({
            paths: {
                "sjcl": "Libraries/sjcl",
                "tinysort": "Libraries/jquery.tinysort",
                "underscore": "Libraries/underscore",
                "backbone": "Libraries/backbone",
                "localstorage": "Libraries/backbone.localStorage",
                "strophe": "Libraries/strophe",
                "strophe.muc": "Libraries/strophe.muc",
                "strophe.roster": "Libraries/strophe.roster",
                "strophe.vcard": "Libraries/strophe.vcard",
                "strophe.disco": "Libraries/strophe.disco"
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
                'underscore':   { exports: '_' },
                'strophe.muc':  { deps: ['strophe', 'jquery'] },
                'strophe.roster':   { deps: ['strophe', 'jquery'] },
                'strophe.vcard':    { deps: ['strophe', 'jquery'] },
                'strophe.disco':    { deps: ['strophe', 'jquery'] }
            }
        });

        define("converse", [
            "localstorage",
            "tinysort",
            "sjcl",
            "strophe.muc",
            "strophe.roster",
            "strophe.vcard",
            "strophe.disco"
            ], function() {
                // Use Mustache style syntax for variable interpolation
                _.templateSettings = {
                    evaluate : /\{\[([\s\S]+?)\]\}/g,
                    interpolate : /\{\{([\s\S]+?)\}\}/g
                };
                return factory(jQuery, _, console);
            }
        );
    } else {
        // Browser globals
        _.templateSettings = {
            evaluate : /\{\[([\s\S]+?)\]\}/g,
            interpolate : /\{\{([\s\S]+?)\}\}/g
        };
        root.converse = factory(jQuery, _, console || {log: function(){}});
    }
}(this, function ($, _, console) {
    var converse = {};
    converse.msg_counter = 0;

    var strinclude = function(str, needle){
      if (needle === '') { return true; }
      if (str === null) { return false; }
      return String(str).indexOf(needle) !== -1;
    };

    converse.autoLink = function (text) {
        // Convert URLs into hyperlinks
        var re = /((http|https|ftp):\/\/[\w?=&.\/\-;#~%\-]+(?![\w\s?&.\/;#~%"=\-]*>))/g;
        return text.replace(re, '<a target="_blank" href="$1">$1</a>');
    };

    converse.toISOString = function (date) {
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

    converse.parseISO8601 = function (datestr) {
        /* Parses string formatted as 2013-02-14T11:27:08.268Z to a Date obj.
        */
        var numericKeys = [1, 4, 5, 6, 7, 10, 11],
            struct = /^\s*(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}\.?\d*)Z\s*$/.exec(datestr),
            minutesOffset = 0,
            i, k;

        for (i = 0; (k = numericKeys[i]); ++i) {
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

    converse.updateMsgCounter = function () {
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

    converse.incrementMsgCounter = function () {
        this.msg_counter += 1;
        this.updateMsgCounter();
    };

    converse.clearMsgCounter = function () {
        this.msg_counter = 0;
        this.updateMsgCounter();
    };

    converse.collections = {
        /* FIXME: XEP-0136 specifies 'urn:xmpp:archive' but the mod_archive_odbc
        *  add-on for ejabberd wants the URL below. This might break for other
        *  Jabber servers.
        */
        'URI': 'http://www.xmpp.org/extensions/xep-0136.html#ns'
    };

    converse.collections.getLastCollection = function (jid, callback) {
        var bare_jid = Strophe.getBareJidFromJid(jid),
            iq = $iq({'type':'get'})
                    .c('list', {'xmlns': this.URI,
                                'with': bare_jid
                                })
                    .c('set', {'xmlns': 'http://jabber.org/protocol/rsm'})
                    .c('before').up()
                    .c('max')
                    .t('1');

        converse.connection.sendIQ(iq,
                    callback,
                    function () {
                        console.log('Error while retrieving collections');
                    });
    };

    converse.collections.getLastMessages = function (jid, callback) {
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
            converse.connection.sendIQ(iq, callback);
        });
    };

    converse.Message = Backbone.Model.extend();

    converse.Messages = Backbone.Collection.extend({
        model: converse.Message
    });

    converse.ChatBox = Backbone.Model.extend({
        initialize: function () {
            if (this.get('box_id') !== 'controlbox') {
                this.messages = new converse.Messages();
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
                body = converse.autoLink($message.children('body').text()),
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
                        time: converse.toISOString(new Date()),
                        composing: composing.length
                    });
                }
            } else {
                if (delayed) {
                    stamp = $message.find('delay').attr('stamp');
                    time = stamp;
                } else {
                    time = converse.toISOString(new Date());
                }
                if (from == converse.bare_jid) {
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

    converse.ChatBoxView = Backbone.View.extend({
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

        new_day_template: _.template(
                            '<time class="chat-date" datetime="{{isodate}}">{{datestring}}</time>'
                            ),

        insertStatusNotification: function (message, replace) {
            var $chat_content = this.$el.find('.chat-content');
            $chat_content.find('div.chat-event').remove().end()
                .append($('<div class="chat-event"></div>').text(message));
            this.scrollDown();
        },

        showMessage: function (message) {
            var time = message.get('time'),
                times = this.model.messages.pluck('time'),
                this_date = converse.parseISO8601(time),
                $chat_content = this.$el.find('.chat-content'),
                previous_message, idx, prev_date, isodate;

            // If this message is on a different day than the one received
            // prior, then indicate it on the chatbox.
            idx = _.indexOf(times, time)-1;
            if (idx >= 0) {
                previous_message = this.model.messages.at(idx);
                prev_date = converse.parseISO8601(previous_message.get('time'));
                isodate = new Date(this_date.getTime());
                isodate.setUTCHours(0,0,0,0);
                isodate = converse.toISOString(isodate);
                if (this.isDifferentDay(prev_date, this_date)) {
                    $chat_content.append(this.new_day_template({
                        isodate: isodate,
                        datestring: this_date.toString().substring(0,15)
                    }));
                }
            }
            if (converse.xmppstatus.get('status') === 'offline') {
                // only update the UI if the user is not offline
                return;
            }
            if (message.get('composing')) {
                this.insertStatusNotification(message.get('fullname')+' '+'is typing');
                return;
            } else {
                $chat_content.find('div.chat-event').remove();
                $chat_content.append(
                        this.message_template({
                            'sender': message.get('sender'),
                            'time': this_date.toLocaleTimeString().substring(0,5),
                            'message': message.get('message'),
                            'username': message.get('fullname'),
                            'extra_classes': message.get('delayed') && 'delayed' || ''
                        }));
            }
            if (message.get('sender') != 'me') {
                converse.incrementMsgCounter();
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

            var message = $msg({from: converse.bare_jid, to: bare_jid, type: 'chat', id: timestamp})
                .c('body').t(text).up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'});
            // Forward the message, so that other connected resources are also aware of it.
            // TODO: Forward the message only to other connected resources (inside the browser)
            var forwarded = $msg({to:converse.bare_jid, type:'chat', id:timestamp})
                            .c('forwarded', {xmlns:'urn:xmpp:forward:0'})
                            .c('delay', {xmns:'urn:xmpp:delay',stamp:timestamp}).up()
                            .cnode(message.tree());
            converse.connection.send(message);
            converse.connection.send(forwarded);
            // Add the new message
            this.model.messages.create({
                fullname: 'me',
                sender: 'me',
                time: converse.toISOString(new Date()),
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
                        converse.connection.send(notify);
                    }
                    this.$el.data('composing', true);
                }
            }
        },

        onChange: function (item, changed) {
            if (_.has(item.changed, 'chat_status')) {
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
            } if (_.has(item.changed, 'status')) {
                this.showStatusMessage(item.get('status'));
            }
        },

        showStatusMessage: function (msg) {
            this.$el.find('p.user-custom-message').text(msg).attr('title', msg);
        },

        closeChat: function () {
            if (converse.connection) {
                this.model.destroy();
            } else {
                this.model.trigger('hide');
            }
        },

        initialize: function (){
            this.model.messages.on('add', this.showMessage, this);
            this.model.on('show', this.show, this);
            this.model.on('destroy', this.hide, this);
            this.model.on('change', this.onChange, this);

            this.$el.appendTo(converse.chatboxesview.$el);
            this.render().show().model.messages.fetch({add: true});
            if (this.model.get('status')) {
                this.showStatusMessage(this.model.get('status'));
            }
            converse.clearMsgCounter();
        },

        template: _.template(
                    '<div class="chat-head chat-head-chatbox">' +
                        '<a class="close-chatbox-button">X</a>' +
                        '<a href="{{url}}" target="_blank" class="user">' +
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
            if (this.model.get('image')) {
                var img_src = 'data:'+this.model.get('image_type')+';base64,'+this.model.get('image'),
                    canvas = $('<canvas height="35px" width="35px" class="avatar"></canvas>'),
                    ctx = canvas.get(0).getContext('2d'),
                    img = new Image();   // Create new Image object
                img.onload = function() {
                    var ratio = img.width/img.height;
                    ctx.drawImage(img,0,0, 35*ratio, 35);
                };
                img.src = img_src;
                this.$el.find('.chat-title').before(canvas);
            }
            return this;
        },

        focus: function () {
            this.$el.find('.chat-textarea').focus();
            return this;
        },

        hide: function () {
            if (converse.animate) {
                this.$el.hide('fast');
            } else {
                this.$el.hide();
            }
        },

        show: function () {
            if (this.$el.is(':visible') && this.$el.css('opacity') == "1") {
                return this.focus();
            }
            if (converse.animate) {
                this.$el.css({'opacity': 0, 'display': 'inline'}).animate({opacity: '1'}, 200);
            } else {
                this.$el.css({'opacity': 1, 'display': 'inline'});
            }
            if (converse.connection) {
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

    converse.ContactsPanel = Backbone.View.extend({
        tagName: 'div',
        className: 'oc-chat-content',
        id: 'users',
        events: {
            'click a.toggle-xmpp-contact-form': 'toggleContactForm',
            'submit form.add-xmpp-contact': 'addContactFromForm',
            'submit form.search-xmpp-contact': 'searchContacts',
            'click a.subscribe-to-user': 'addContactFromList'
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
            '<dl class="add-converse-contact dropdown">' +
                '<dt id="xmpp-contact-search" class="fancy-dropdown">' +
                    '<a class="toggle-xmpp-contact-form" href="#" title="Click to add new chat contacts">Add a contact</a>' +
                '</dt>' +
                '<dd class="search-xmpp" style="display:none"><ul></ul></dd>' +
            '</dl>'
        ),

        add_contact_template: _.template(
                '<form class="add-xmpp-contact">' +
                    '<input type="text" name="identifier" class="username" placeholder="Contact name"/>' +
                    '<button type="submit">Add</button>' +
                '</form>'),

        search_contact_template: _.template(
                '<form class="search-xmpp-contact">' +
                    '<input type="text" name="identifier" class="username" placeholder="Contact name"/>' +
                    '<button type="submit">Search</button>' +
                    '<ul id="found-users"></ul>' +
                '</form>'),

        render: function () {
            var markup;
            this.$parent.find('#controlbox-tabs').append(this.tab_template());
            this.$parent.find('#controlbox-panes').append(this.$el.html(this.template()));
            if (converse.xhr_user_search) {
                markup = this.search_contact_template();
            } else {
                markup = this.add_contact_template();
            }
            this.$el.find('.search-xmpp ul').append(markup);
            return this;
        },

        toggleContactForm: function (ev) {
            ev.preventDefault();
            this.$el.find('.search-xmpp').toggle('fast', function () {
                if ($(this).is(':visible')) {
                    $(this).find('input.username').focus();
                }
            });
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
                            .attr('data-recipient', Strophe.escapeNode(obj.id)+'@'+converse.domain)
                            .text(obj.fullname)
                        )
                    );
                });
            });
        },

        addContactFromForm: function (ev) {
            ev.preventDefault();
            var $input = $(ev.target).find('input');
            var jid = $input.val();
            if (! jid) {
                // this is not a valid JID
                $input.addClass('error');
                return;
            }
            converse.getVCard(
                jid,
                $.proxy(function (jid, fullname, image, image_type, url) {
                    // XXX: Should we perhaps create a roster item here?
                    this.addContact(jid, fullname);
                }, this),
                $.proxy(function () {
                    console.log("An error occured while fetching vcard");
                }, this));
            $('.search-xmpp').hide();
        },

        addContactFromList: function (ev) {
            ev.preventDefault();
            var $target = $(ev.target),
                jid = $target.attr('data-recipient'),
                name = $target.text();
            this.addContact(jid, name);
            $target.parent().remove();
            $('.search-xmpp').hide();
        },

        addContact: function (jid, name) {
            converse.connection.roster.add(jid, name, [], function (iq) {
                converse.connection.roster.subscribe(jid, null, converse.fullname);
            });
        }
    });

    converse.RoomsPanel = Backbone.View.extend({
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
                '<input type="text" name="chatroom" class="new-chatroom-name" placeholder="Room name"/>'+
                '<input type="text" name="server" class="new-chatroom-server" placeholder="Server" value="{{server_name}}"/>'+
                '<button type="submit">Join</button>'+
            '</form>'+
            '<dl id="available-chatrooms">'+
                '<dt>Available chatrooms</dt>'+
            '</dl>'),

        render: function () {
            this.$parent.find('#controlbox-tabs').append(this.tab_template());
            var server_name = this.muc_domain;
            this.$parent.find('#controlbox-panes').append(this.$el.html(this.template({server_name:server_name})).hide());
            return this;
        },

        initialize: function () {
            this.on('update-rooms-list', function (ev) {
                this.updateRoomsList();
            });
        },

        updateRoomsList: function () {
            converse.connection.muc.listRooms(this.muc_domain, $.proxy(function (iq) {
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
                    name = Strophe.unescapeNode($(rooms[i]).attr('name')||$(rooms[i]).attr('jid'));
                    jid = $(rooms[i]).attr('jid');
                    $available_chatrooms.append(this.room_template({'name':name, 'jid':jid}));
                }
                return true;
            }, this));
        },

        createChatRoom: function (ev) {
            ev.preventDefault();
            var name, server, jid, $name, $server, errors;
            if (ev.type === 'click') {
                jid = $(ev.target).attr('data-room-jid');
            } else {
                $name = this.$el.find('input.new-chatroom-name');
                $server= this.$el.find('input.new-chatroom-server');
                server = $server.val();
                name = $name.val().trim().toLowerCase();
                $name.val(''); // Clear the input
                if (name && server) {
                    jid = Strophe.escapeNode(name) + '@' + server;
                } else {
                    errors = true;
                    if (!name) { $name.addClass('error'); }
                    if (!server) { $server.addClass('error'); }
                    return;
                }
            }
            converse.chatboxes.create({
                'id': jid,
                'jid': jid,
                'name': Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                'nick': converse.xmppstatus.get('fullname')||converse.bare_jid,
                'chatroom': true,
                'box_id' : hex_sha1(jid)
            });
        }
    });

    converse.ControlBoxView = converse.ChatBoxView.extend({
        tagName: 'div',
        className: 'chatbox',
        id: 'controlbox',
        events: {
            'click a.close-chatbox-button': 'closeChat',
            'click ul#controlbox-tabs li a': 'switchTab'
        },

        initialize: function () {
            this.$el.appendTo(converse.chatboxesview.$el);
            this.model.on('change', $.proxy(function (item, changed) {
                var i;
                if (_.has(item.changed, 'connected')) {
                    this.render();
                    converse.features.on('add', $.proxy(this.featureAdded, this));
                    // Features could have been added before the controlbox was
                    // initialized. Currently we're only interested in MUC
                    var feature = converse.features.findWhere({'var': 'http://jabber.org/protocol/muc'});
                    if (feature) {
                        this.featureAdded(feature);
                    }
                }
                if (_.has(item.changed, 'visible')) {
                    if (item.changed.visible === true) {
                        this.show();
                    }
                }
            }, this));
            this.model.on('show', this.show, this);
            this.model.on('destroy', this.hide, this);
            this.model.on('hide', this.hide, this);
            if (this.model.get('visible')) {
                this.show();
            }
        },

        featureAdded: function (feature) {
            if (feature.get('var') == 'http://jabber.org/protocol/muc') {
                if (!this.roomspanel) {
                    this.roomspanel = new converse.RoomsPanel();
                    this.roomspanel.muc_domain = feature.get('from');
                    this.roomspanel.$parent = this.$el;
                    this.roomspanel.render().trigger('update-rooms-list');
                }
            }
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
            if ((!converse.prebind) && (!converse.connection)) {
                // Add login panel if the user still has to authenticate
                this.loginpanel = new converse.LoginPanel();
                this.loginpanel.$parent = this.$el;
                this.loginpanel.render();
            } else {
                this.contactspanel = new converse.ContactsPanel();
                this.contactspanel.$parent = this.$el;
                this.contactspanel.render();
            }
            return this;
        }
    });

    converse.ChatRoomView = converse.ChatBoxView.extend({
        length: 300,
        tagName: 'div',
        className: 'chatroom',
        events: {
            'click a.close-chatbox-button': 'closeChat',
            'keypress textarea.chat-textarea': 'keyPressed'
        },

        info_template: _.template('<div class="chat-event">{{message}}</div>'),

        sendChatRoomMessage: function (body) {
            var match = body.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false],
                $chat_content;
            switch (match[1]) {
                case 'msg':
                    // TODO: Private messages
                    break;
                case 'topic':
                    converse.connection.muc.setTopic(this.model.get('jid'), match[2]);
                    break;
                case 'kick':
                    converse.connection.muc.kick(this.model.get('jid'), match[2]);
                    break;
                case 'ban':
                    converse.connection.muc.ban(this.model.get('jid'), match[2]);
                    break;
                case 'op':
                    converse.connection.muc.op(this.model.get('jid'), match[2]);
                    break;
                case 'deop':
                    converse.connection.muc.deop(this.model.get('jid'), match[2]);
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
                    this.last_msgid = converse.connection.muc.groupchat(this.model.get('jid'), body);
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
            converse.connection.muc.join(
                this.model.get('jid'),
                this.model.get('nick'),
                $.proxy(this.onChatRoomMessage, this),
                $.proxy(this.onChatRoomPresence, this),
                $.proxy(this.onChatRoomRoster, this));


            this.model.messages.on('add', this.showMessage, this);
            this.model.on('destroy', function (model, response, options) {
                this.$el.hide('fast');
                converse.connection.muc.leave(
                    this.model.get('jid'),
                    this.model.get('nick'),
                    this.onLeave,
                    undefined);
            },
            this);
            this.$el.appendTo(converse.chatboxesview.$el);
            this.render().show().model.messages.fetch({add: true});
            converse.clearMsgCounter();
        },

        onLeave: function () {
            var controlboxview = converse.chatboxesview.views.controlbox;
            if (controlboxview) {
                controlboxview.roomspanel.trigger('update-rooms-list');
            }
        },

        onChatRoomPresence: function (presence, room) {
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
                match, template, message_datetime, message_date, dates, isodate;
            if (delayed) {
                stamp = $message.find('delay').attr('stamp');
                message_datetime = converse.parseISO8601(stamp);
            } else {
                message_datetime = new Date();
            }
            // If this message is on a different day than the one received
            // prior, then indicate it on the chatbox.
            dates = $chat_content.find("time").map(function(){return $(this).attr("datetime");}).get();
            message_date = message_datetime;
            message_date.setUTCHours(0,0,0,0);
            isodate = converse.toISOString(message_date);
            if (_.indexOf(dates, isodate) == -1) {
                $chat_content.append(this.new_day_template({
                    isodate: isodate,
                    datestring: message_date.toString().substring(0,15)
                }));
            }
            if (subject) {
                this.$el.find('.chatroom-topic').text(subject).attr('title', subject);
                $chat_content.append(this.info_template({'message': 'Topic set by '+sender+' to: '+subject }));
            }
            if (!body) { return true; }
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
                    'time': message_date.toLocaleTimeString().substring(0,5),
                    'message': body,
                    'username': sender,
                    'extra_classes': delayed && 'delayed' || ''
                })
            );
            this.scrollDown();
            return true;
        },

        onChatRoomRoster: function (roster, room) {
            // underscore size is needed because roster is an object
            var controlboxview = converse.chatboxesview.views.controlbox,
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

    converse.ChatBoxes = Backbone.Collection.extend({
        model: converse.ChatBox,

        onConnected: function () {
            this.localStorage = new Backbone.LocalStorage(
                hex_sha1('converse.chatboxes-'+converse.bare_jid));
            if (!this.get('controlbox')) {
                this.add({
                    id: 'controlbox',
                    box_id: 'controlbox'
                });
            } else {
                this.get('controlbox').save();
            }
            // This will make sure the Roster is set up
            this.get('controlbox').set({connected:true});
            // Get cached chatboxes from localstorage
            this.fetch({
                add: true,
                success: $.proxy(function (collection, resp) {
                    if (_.include(_.pluck(resp, 'id'), 'controlbox')) {
                        // If the controlbox was saved in localstorage, it must be visible
                        this.get('controlbox').set({visible:true}).save();
                    }
                }, this)
            });
        },

        messageReceived: function (message) {
            var  partner_jid, $message = $(message),
                 message_from = $message.attr('from');
            if (message_from == converse.connection.jid) {
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
            if (from == converse.bare_jid) {
                // I am the sender, so this must be a forwarded message...
                partner_jid = to;
                resource = Strophe.getResourceFromJid($message.attr('to'));
            } else {
                partner_jid = from;
                resource = Strophe.getResourceFromJid(message_from);
            }
            chatbox = this.get(partner_jid);
            if (!chatbox) {
                converse.getVCard(
                    partner_jid,
                    $.proxy(function (jid, fullname, image, image_type, url) {
                        var chatbox = this.create({
                            'id': jid,
                            'jid': jid,
                            'fullname': fullname,
                            'image_type': image_type,
                            'image': image,
                            'url': url
                        });
                        chatbox.messageReceived(message);
                        converse.roster.addResource(partner_jid, resource);
                    }, this),
                    $.proxy(function () {
                        // # FIXME
                        console.log("An error occured while fetching vcard");
                    }, this));
                return true;
            }
            chatbox.messageReceived(message);
            converse.roster.addResource(partner_jid, resource);
            return true;
        }
    });

    converse.ChatBoxesView = Backbone.View.extend({
        el: '#collective-xmpp-chat-data',

        initialize: function () {
            // boxesviewinit
            this.views = {};
            this.model.on("add", function (item) {
                var view = this.views[item.get('id')];
                if (!view) {
                    if (item.get('chatroom')) {
                        view = new converse.ChatRoomView({'model': item});
                    } else if (item.get('box_id') === 'controlbox') {
                        view = new converse.ControlBoxView({model: item});
                        view.render();
                    } else {
                        view = new converse.ChatBoxView({model: item});
                    }
                    this.views[item.get('id')] = view;
                } else {
                    view.model = item;
                    view.initialize();
                    if (item.get('id') !== 'controlbox') {
                        // FIXME: Why is it necessary to again append chatboxes?
                        view.$el.appendTo(this.$el);
                    }
                }
            }, this);
        }
    });

    converse.RosterItem = Backbone.Model.extend({
        initialize: function (attributes, options) {
            var jid = attributes.jid;
            if (!attributes.fullname) {
                attributes.fullname = jid;
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

    converse.RosterItemView = Backbone.View.extend({
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
                chatbox  = converse.chatboxes.get(jid);
            if (chatbox) {
                chatbox.trigger('show');
            } else {
                converse.chatboxes.create({
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
            if (result === true) {
                var bare_jid = this.model.get('jid');
                converse.connection.roster.remove(bare_jid, function (iq) {
                    converse.connection.roster.unauthorize(bare_jid);
                    converse.rosterview.model.remove(bare_jid);
                });
            }
        },

        acceptRequest: function (ev) {
            var jid = this.model.get('jid');
            converse.connection.roster.authorize(jid);
            converse.connection.roster.add(jid, this.model.get('fullname'), [], function (iq) {
                converse.connection.roster.subscribe(jid, null, converse.fullname);
            });
            ev.preventDefault();
        },

        declineRequest: function (ev) {
            ev.preventDefault();
            converse.connection.roster.unauthorize(this.model.get('jid'));
            this.model.destroy();
        },

        template: _.template(
                    '<a class="open-chat" title="Click to chat with this contact" href="#">{{ fullname }}</a>' +
                    '<a class="remove-xmpp-contact" title="Click to remove this contact" href="#"></a>'),

        pending_template: _.template(
                    '<span>{{ fullname }}</span>' +
                    '<a class="remove-xmpp-contact" title="Click to remove this contact" href="#"></a>'),

        request_template: _.template('<div>{{ fullname }}</div>' +
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
                converse.showControlBox();
            } else if (subscription === 'both' || subscription === 'to') {
                this.$el.addClass('current-xmpp-contact');
                this.$el.html(this.template(item.toJSON()));
            }

            return this;
        },

        initialize: function () {
            this.options.model.on('change', function (item, changed) {
                if (_.has(item.changed, 'chat_status')) {
                    this.$el.attr('class', item.changed.chat_status);
                }
            }, this);
        }
    });

    converse.getVCard = function (jid, callback, errback) {
        converse.connection.vcard.get($.proxy(function (iq) {
            $vcard = $(iq).find('vCard');
            var fullname = $vcard.find('FN').text(),
                img = $vcard.find('BINVAL').text(),
                img_type = $vcard.find('TYPE').text(),
                url = $vcard.find('URL').text();
            callback(jid, fullname, img, img_type, url);
        }, this), jid, errback);
    }

    converse.RosterItems = Backbone.Collection.extend({
        model: converse.RosterItem,
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
                    converse.connection.roster.add(jid, fullname, [], function (iq) {
                        converse.connection.roster.subscribe(jid, null, converse.fullname);
                    });
                }
            });
            return true;
        },

        isSelf: function (jid) {
            return (Strophe.getBareJidFromJid(jid) === Strophe.getBareJidFromJid(converse.connection.jid));
        },

        getItem: function (id) {
            return Backbone.Collection.prototype.get.call(this, id);
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
            var bare_jid = Strophe.getBareJidFromJid(jid);
            if (converse.connection.roster.findItem(bare_jid)) {
                converse.connection.roster.authorize(bare_jid);
                converse.connection.roster.subscribe(jid, null, converse.fullname);
            } else {
                converse.connection.roster.add(jid, '', [], function (iq) {
                    converse.connection.roster.authorize(bare_jid);
                    converse.connection.roster.subscribe(jid, null, converse.fullname);
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
            converse.xmppstatus.sendPresence('unsubscribe');
            if (converse.connection.roster.findItem(jid)) {
                converse.connection.roster.remove(jid, function (iq) {
                    converse.rosterview.model.remove(jid);
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
                roster_ids.push(items[i].jid);
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
                    this.create({
                        jid: item.jid,
                        subscription: item.subscription,
                        ask: item.ask,
                        fullname: item.name || item.jid,
                        is_last: is_last
                    });
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
                if ((converse.connection.jid !== jid)&&(presence_type !== 'unavailabe')) {
                    // Another resource has changed it's status, we'll update ours as well.
                    // FIXME: We should ideally differentiate between converse.js using
                    // resources and other resources (i.e Pidgin etc.)
                    converse.xmppstatus.set({'status': chat_status});
                }
                return true;
            } else if (($presence.find('x').attr('xmlns') || '').indexOf(Strophe.NS.MUC) === 0) {
                return true; // Ignore MUC
            }

            item = this.getItem(bare_jid);
            if (item && (status_message.text() != item.get('status'))) {
                item.set({'status': status_message.text()});
            }

            if ((presence_type === 'error') || (presence_type === 'subscribed') || (presence_type === 'unsubscribe')) {
                return true;
            } else if (presence_type === 'subscribe') {
                if (converse.auto_subscribe) {
                    if ((!item) || (item.get('subscription') != 'to')) {
                        this.subscribeBack(jid);
                    } else {
                        converse.connection.roster.authorize(bare_jid);
                    }
                } else {
                    if ((item) && (item.get('subscription') != 'none'))  {
                        converse.connection.roster.authorize(bare_jid);
                    } else {
                        converse.getVCard(
                            bare_jid,
                            $.proxy(function (jid, fullname, img, img_type, url) {
                                this.add({
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
                                this.add({jid: bare_jid, subscription: 'none', ask: 'request', fullname: jid, is_last: true});
                            }, this)
                        );
                    }
                }
            } else if (presence_type === 'unsubscribed') {
                this.unsubscribe(bare_jid);
            } else if (presence_type === 'unavailable') {
                if (this.removeResource(bare_jid, resource) === 0) {
                    if (item) {
                        item.set({'chat_status': 'offline'});
                    }
                }
            } else if (item) {
                // presence_type is undefined
                this.addResource(bare_jid, resource);
                item.set({'chat_status': chat_status});
            }
            return true;
        }
    });

    converse.RosterView = Backbone.View.extend({
        tagName: 'dl',
        id: 'converse-roster',
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
                var view = new converse.RosterItemView({model: item});
                this.rosteritemviews[item.id] = view;
                this.render(item);
            }, this);

            this.model.on('change', function (item, changed) {
                if ((_.size(item.changed) === 1) && _.contains(_.keys(item.changed), 'sorted')) {
                    return;
                }
                this.updateChatBox(item, changed);
                this.render(item);
            }, this);

            this.model.on("destroy", function (item) {
                this.removeRosterItem(item);
            }, this);

            this.$el.hide().html(this.template());
            this.model.fetch({add: true}); // Get the cached roster items from localstorage
            this.initialSort();
            this.$el.appendTo(converse.chatboxesview.views.controlbox.contactspanel.$el);
        },

        updateChatBox: function (item, changed) {
            var chatbox = converse.chatboxes.get(item.get('jid')),
                changes = {};
            if (!chatbox) { return; }
            if (_.has(item.changed, 'chat_status')) {
                changes.chat_status = item.get('chat_status');
            }
            if (_.has(item.changed, 'status')) {
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
                presence_change = view.model.changed.chat_status;
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
            $count.text('('+this.model.getNumOnlineContacts()+')');
            if (!$count.is(':visible')) {
                $count.show();
            }
            return this;
        },

        initialSort: function () {
            var $my_contacts = this.$el.find('#xmpp-contacts'),
                crit = {order:'asc'};
            $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.offline').tsort('a', crit));
            $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.unavailable').tsort('a', crit));
        }
    });

    converse.XMPPStatus = Backbone.Model.extend({
        initialize: function () {
            this.set({
                'status' : this.get('status'),
                'status_message' : this.get('status_message')
            });
        },

        initStatus: function () {
            var stat = this.get('status');
            if (stat === undefined) {
                this.save({status: 'online'});
            } else {
                this.sendPresence(stat);
            }
        },

        sendPresence: function (type) {
            var status_message = this.get('status_message'),
                presence;
            // Most of these presence types are actually not explicitly sent,
            // but I add all of them here fore reference and future proofing.
            if ((type === 'unavailable') ||
                    (type === 'probe') ||
                    (type === 'error') ||
                    (type === 'unsubscribe') ||
                    (type === 'unsubscribed') ||
                    (type === 'subscribe') ||
                    (type === 'subscribed')) {
                presence = $pres({'type':type});
            } else {
                if (type === 'online') {
                    presence = $pres();
                } else {
                    presence = $pres().c('show').t(type);
                }
                if (status_message) {
                    presence.c('status').t(status_message);
                }
            }
            converse.connection.send(presence);
        },

        setStatus: function (value) {
            this.sendPresence(value);
            this.save({'status': value});
        },

        setStatusMessage: function (status_message) {
            converse.connection.send($pres().c('show').t(this.get('status')).up().c('status').t(status_message));
            this.save({'status_message': status_message});
        }

    });

    converse.XMPPStatusView = Backbone.View.extend({
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
            var status_message = this.model.get('status') || 'offline';
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

        updateStatusUI: function (model) {
            if (!(_.has(model.changed, 'status')) && !(_.has(model.changed, 'status_message'))) {
                return;
            }
            var stat = model.get('status'),
                status_message = model.get('status_message') || "I am " + this.getPrettyStatus(stat);
            this.$el.find('#fancy-xmpp-status-select').html(
                this.status_template({
                    'chat_status': stat,
                    'status_message': status_message
                }));
        },

        choose_template: _.template(
            '<dl id="target" class="dropdown">' +
                '<dt id="fancy-xmpp-status-select" class="fancy-dropdown"></dt>' +
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
            this.model.on("change", this.updateStatusUI, this);
        },

        render: function () {
            // Replace the default dropdown with something nicer
            var $select = this.$el.find('select#select-xmpp-status'),
                chat_status = this.model.get('status') || 'offline',
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
                options_list.push(that.option_template({'value': $(this).val(),
                                                        'text': $(this).text()
                                                        }));
            });
            $options_target = this.$el.find("#target dd ul").hide();
            $options_target.append(options_list.join(''));
            $select.remove();
            return this;
        }
    });

    converse.Feature = Backbone.Model.extend();
    converse.Features = Backbone.Collection.extend({
        /* This collection stores Feature Models, representing features
         * provided by available XMPP entities (e.g. servers)
         *
         * See XEP-0030 for more details: http://xmpp.org/extensions/xep-0030.html
         */
        model: converse.Feature,
        initialize: function () {
            this.localStorage = new Backbone.LocalStorage(
                hex_sha1('converse.features'+converse.bare_jid));
            if (this.localStorage.records.length === 0) {
                // localStorage is empty, so we've likely never queried this
                // domain for features yet
                converse.connection.disco.info(converse.domain, null, this.onInfo, this.onError);
                converse.connection.disco.items(converse.domain, null, $.proxy(this.onItems, this), $.proxy(this.onError, this));
            } else {
                this.fetch({add:true});
            }
        },

        onItems: function (stanza) {
            $(stanza).find('query item').each($.proxy(function (idx, item) {
                converse.connection.disco.info(
                    $(item).attr('jid'),
                    null,
                    $.proxy(this.onInfo, this),
                    $.proxy(this.onError, this));
            }, this));
        },

        onInfo: function (stanza) {
            var $stanza = $(stanza);
            if (($stanza.find('identity[category=server][type=im]').length === 0) &&
                ($stanza.find('identity[category=conference][type=text]').length === 0)) {
                // This isn't an IM server component
                return;
            }
            $stanza.find('feature').each($.proxy(function (idx, feature) {
                this.create({
                    'var': $(feature).attr('var'),
                    'from': $stanza.attr('from')
                });
            }, this));
        },

        onError: function (stanza) {
            console.log("Error while doing service discovery");
        }
    });

    converse.LoginPanel = Backbone.View.extend({
        tagName: 'div',
        id: "login-dialog",
        events: {
            'submit form#converse-login': 'authenticate'
        },
        tab_template: _.template(
            '<li><a class="current" href="#login">Sign in</a></li>'),
        template: _.template(
            '<form id="converse-login">' +
            '<label>XMPP/Jabber Username:</label>' +
            '<input type="text" id="jid">' +
            '<label>Password:</label>' +
            '<input type="password" id="password">' +
            '<button type="submit">Log In</button>' +
            '</form">'),

        bosh_url_input: _.template(
            '<label>BOSH Service URL:</label>' +
            '<input type="text" id="bosh_service_url">'),

        authenticate: $.proxy(function (ev) {
            ev.preventDefault();
            var $form = $(ev.target),
                $jid_input = $form.find('input#jid'),
                jid = $jid_input.val(),
                $pw_input = $form.find('input#password'),
                password = $pw_input.val(),
                $bsu_input = null,
                errors = false;

            if (! this.bosh_service_url) {
                $bsu_input = $form.find('input#bosh_service_url');
                this.bosh_service_url = $bsu_input.val();
                if (! this.bosh_service_url)  {
                    errors = true;
                    $bsu_input.addClass('error');
                }
            }
            if (! jid) {
                errors = true;
                $jid_input.addClass('error');
            }
            if (! password)  {
                errors = true;
                $pw_input.addClass('error');
            }
            if (errors) { return; }
            // Clear the form's fields, so that it can't be submitted twice
            if ($bsu_input) {
                $bsu_input.val('');
            }
            $jid_input.val('');
            $pw_input.val('');

            var connection = new Strophe.Connection(this.bosh_service_url);
            connection.connect(jid, password, $.proxy(function (status) {
                if (status === Strophe.Status.CONNECTED) {
                    console.log('Connected');
                    this.onConnected(connection);
                } else if (status === Strophe.Status.DISCONNECTED) {
                    this.giveFeedback('Disconnected').css('background-image', "url(images/error_icon.png)");
                } else if (status === Strophe.Status.Error) {
                    this.giveFeedback('Error');
                } else if (status === Strophe.Status.CONNECTING) {
                    this.giveFeedback('Connecting');
                } else if (status === Strophe.Status.CONNFAIL) {
                    this.giveFeedback('Connection Failed');
                } else if (status === Strophe.Status.AUTHENTICATING) {
                    this.giveFeedback('Authenticating');
                } else if (status === Strophe.Status.AUTHFAIL) {
                    this.giveFeedback('Authentication Failed');
                } else if (status === Strophe.Status.DISCONNECTING) {
                    this.giveFeedback('Disconnecting');
                } else if (status === Strophe.Status.ATTACHED) {
                    console.log('Attached');
                }
            }, converse));
        }, converse),

        remove: function () {
            this.$parent.find('#controlbox-tabs').empty();
            this.$parent.find('#controlbox-panes').empty();
        },

        render: function () {
            this.$parent.find('#controlbox-tabs').append(this.tab_template());
            var template = this.template();
            if (! this.bosh_url_input) {
                template.find('form').append(this.bosh_url_input);
            }
            this.$parent.find('#controlbox-panes').append(this.$el.html(template));
            this.$el.find('input#jid').focus();
            return this;
        }
    });

    converse.showControlBox = function () {
        var controlbox = this.chatboxes.get('controlbox');
        if (!controlbox) {
            this.chatboxes.add({
                id: 'controlbox',
                box_id: 'controlbox',
                visible: true
            });
            if (this.connection) {
                this.chatboxes.get('controlbox').save();
            }
        } else {
            controlbox.trigger('show');
        }
    }

    converse.toggleControlBox = function () {
        if ($("div#controlbox").is(':visible')) {
            var controlbox = this.chatboxes.get('controlbox');
            if (this.connection) {
                controlbox.destroy();
            } else {
                controlbox.trigger('hide');
            }
        } else {
            this.showControlBox();
        }
    };

    converse.giveFeedback = function (message) {
        return $('.conn-feedback').text(message);
    }

    converse.onConnected = function (connection) {
        this.connection = connection;
        this.connection.xmlInput = function (body) { console.log(body); };
        this.connection.xmlOutput = function (body) { console.log(body); };
        this.bare_jid = Strophe.getBareJidFromJid(this.connection.jid);
        this.domain = Strophe.getDomainFromJid(this.connection.jid);
        this.features = new this.Features();

        // Set up the roster
        this.roster = new this.RosterItems();
        this.roster.localStorage = new Backbone.LocalStorage(
            hex_sha1('converse.rosteritems-'+this.bare_jid));

        this.xmppstatus = new this.XMPPStatus({id:1});
        this.xmppstatus.localStorage = new Backbone.LocalStorage(
            hex_sha1('converse.xmppstatus-'+this.bare_jid));

        this.chatboxes.onConnected();
        this.rosterview = new this.RosterView({'model':this.roster});

        this.xmppstatusview = new this.XMPPStatusView({'model': this.xmppstatus}).render();
        this.xmppstatus.fetch();

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

            this.xmppstatus.initStatus();
        }, this));
        this.giveFeedback('Online Contacts');
    };

    converse.initialize = function (settings) {
        _.extend(this, settings);
        this.chatboxes = new this.ChatBoxes();
        this.chatboxesview = new this.ChatBoxesView({model: this.chatboxes});
        $('a.toggle-online-users').bind(
            'click',
            $.proxy(function (e) {
                e.preventDefault(); this.toggleControlBox();
            }, this)
        );
    };

    return converse;
}));
