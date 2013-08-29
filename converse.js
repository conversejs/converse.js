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
        define("converse", [
            "locales",
            "backbone.localStorage",
            "jquery.tinysort",
            "strophe",
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
    converse.initialize = function (settings, callback) {
        // Default values
        var converse = this;
        this.animate = true;
        this.auto_list_rooms = false;
        this.auto_subscribe = false;
        this.bosh_service_url = undefined; // The BOSH connection manager URL.
        this.debug = false;
        this.hide_muc_server = false;
        this.i18n = locales.en;
        this.prebind = false;
        this.show_controlbox_by_default = false;
        this.xhr_user_search = false;
        this.xhr_custom_status = false;
        this.testing = false; // Exposes sensitive data for testing. Never set to true in production systems!
        this.callback = callback || function () {};

        // Allow only the whitelisted settings attributes to be overwritten,
        // nothing else.
        whitelist = [
            'animate',
            'auto_list_rooms',
            'auto_subscribe',
            'bosh_service_url',
            'fullname',
            'debug',
            'hide_muc_server',
            'i18n',
            'prebind',
            'show_controlbox_by_default',
            'xhr_user_search',
            'xhr_custom_status',
            'connection',
            'testing',
            'jid',
            'sid',
            'rid'
        ];
        _.extend(this, _.pick(settings, whitelist));

        var __ = $.proxy(function (str) {
            /* Translation factory
             */
            if (this.i18n === undefined) {
                this.i18n = locales['en'];
            }
            var t = this.i18n.translate(str);
            if (arguments.length>1) {
                return t.fetch.apply(t, [].slice.call(arguments,1));
            } else {
                return t.fetch();
            }
        }, this);

        var ___ = function (str) {
            /* XXX: This is part of a hack to get gettext to scan strings to be
             * translated. Strings we cannot send to the function above because
             * they require variable interpolation and we don't yet have the
             * variables at scan time.
             *
             * See actionInfoMessages
             */
            return str;
        };

        this.msg_counter = 0;
        this.autoLink = function (text) {
            // Convert URLs into hyperlinks
            var re = /((http|https|ftp):\/\/[\w?=&.\/\-;#~%\-]+(?![\w\s?&.\/;#~%"=\-]*>))/g;
            return text.replace(re, '<a target="_blank" href="$1">$1</a>');
        };

        this.giveFeedback = function (message, klass) {
            $('.conn-feedback').text(message);
            $('.conn-feedback').attr('class', 'conn-feedback');
            if (klass) {
                $('.conn-feedback').addClass(klass);
            }
        };

        this.log = function (txt) {
            if (this.debug) {
                console.log(txt);
            }
        };

        this.onConnect = function (status) {
            if (status === Strophe.Status.CONNECTED) {
                converse.log('Connected');
                converse.onConnected();
            } else if (status === Strophe.Status.DISCONNECTED) {
                if ($button) { $button.show().siblings('span').remove(); }
                converse.giveFeedback(__('Disconnected'), 'error');
                converse.connection.connect(connection.jid, connection.pass, converse.onConnect);
            } else if (status === Strophe.Status.Error) {
                if ($button) { $button.show().siblings('span').remove(); }
                converse.giveFeedback(__('Error'), 'error');
            } else if (status === Strophe.Status.CONNECTING) {
                converse.giveFeedback(__('Connecting'));
            } else if (status === Strophe.Status.CONNFAIL) {
                converse.chatboxesview.views.controlbox.trigger('connection-fail');
                converse.giveFeedback(__('Connection Failed'), 'error');
            } else if (status === Strophe.Status.AUTHENTICATING) {
                converse.giveFeedback(__('Authenticating'));
            } else if (status === Strophe.Status.AUTHFAIL) {
                converse.chatboxesview.views.controlbox.trigger('auth-fail');
                converse.giveFeedback(__('Authentication Failed'), 'error');
            } else if (status === Strophe.Status.DISCONNECTING) {
                converse.giveFeedback(__('Disconnecting'), 'error');
            } else if (status === Strophe.Status.ATTACHED) {
                converse.log('Attached');
                converse.onConnected();
            }
        };

        this.toISOString = function (date) {
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

        this.parseISO8601 = function (datestr) {
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

        this.updateMsgCounter = function () {
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

        this.incrementMsgCounter = function () {
            this.msg_counter += 1;
            this.updateMsgCounter();
        };

        this.clearMsgCounter = function () {
            this.msg_counter = 0;
            this.updateMsgCounter();
        };

        this.collections = {
            /* FIXME: XEP-0136 specifies 'urn:xmpp:archive' but the mod_archive_odbc
            *  add-on for ejabberd wants the URL below. This might break for other
            *  Jabber servers.
            */
            'URI': 'http://www.xmpp.org/extensions/xep-0136.html#ns'
        };

        this.collections.getLastCollection = function (jid, callback) {
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
                    converse.log('Error while retrieving collections');
                });
        };

        this.collections.getLastMessages = function (jid, callback) {
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

        this.Message = Backbone.Model.extend();

        this.Messages = Backbone.Collection.extend({
            model: converse.Message
        });

        this.ChatBox = Backbone.Model.extend({
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
                        'image': this.get('image')
                    });
                }
            },

            messageReceived: function (message) {
                var $message = $(message),
                    body = converse.autoLink($message.children('body').text()),
                    from = Strophe.getBareJidFromJid($message.attr('from')),
                    composing = $message.find('composing'),
                    delayed = $message.find('delay').length > 0,
                    fullname = (this.get('fullname')||'').split(' ')[0],
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

        this.ChatBoxView = Backbone.View.extend({
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
                                    '<span class="chat-message-{{sender}}">{{time}} **{{username}} </span>' +
                                    '<span class="chat-message-content">{{message}}</span>' +
                                '</div>'),

            new_day_template: _.template(
                                '<time class="chat-date" datetime="{{isodate}}">{{datestring}}</time>'
                                ),

            appendMessage: function ($el, msg_dict) {
                var this_date = converse.parseISO8601(msg_dict.time),
                    text = msg_dict.message,
                    match = text.match(/^\/(.*?)(?: (.*))?$/),
                    sender = msg_dict.sender,
                    template, username;

                if ((match) && (match[1] === 'me')) {
                    text = text.replace(/^\/me/, '');
                    template = this.action_template;
                    username = msg_dict.fullname;
                } else  {
                    template = this.message_template;
                    username = sender === 'me' && sender || msg_dict.fullname;
                }
                $el.find('div.chat-event').remove();
                $el.append(
                    template({
                        'sender': sender,
                        'time': this_date.toTimeString().substring(0,5),
                        'message': text,
                        'username': username,
                        'extra_classes': msg_dict.delayed && 'delayed' || ''
                    }));
            },

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
                    previous_message, idx, prev_date, isodate, text, match;

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
                if (message.get('composing')) {
                    this.insertStatusNotification(message.get('fullname')+' '+'is typing');
                    return;
                } else {
                    this.appendMessage($chat_content, _.clone(message.attributes));
                }
                if ((message.get('sender') != 'me') && (converse.windowState == 'blur')) {
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
                    $chat_content.append($('<div class="chat-info">'+msgs[i]+'</div>'));
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
                        msgs = [
                            '<strong>/help</strong>:'+__('Show this menu')+'',
                            '<strong>/me</strong>:'+__('Write in the third person')+'',
                            '<strong>/clear</strong>:'+__('Remove messages')+''
                            ];
                        this.addHelpMessages(msgs);
                        return;
                    }
                }
                var message = $msg({from: converse.connection.jid, to: bare_jid, type: 'chat', id: timestamp})
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
                    fullname: converse.xmppstatus.get('fullname')||converse.bare_jid,
                    sender: 'me',
                    time: converse.toISOString(new Date()),
                    message: text
                });
            },

            keyPressed: function (ev) {
                var $textarea = $(ev.target),
                    message, notify, composing;
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
                } if (_.has(item.changed, 'image')) {
                    this.renderAvatar();
                }
                // TODO check for changed fullname as well
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

            updateVCard: function () {
                var jid = this.model.get('jid'),
                    rosteritem = converse.roster.get(jid);
                if ((rosteritem)&&(!rosteritem.get('vcard_updated'))) {
                    converse.getVCard(
                        jid,
                        $.proxy(function (jid, fullname, image, image_type, url) {
                            this.model.save({
                                'fullname' : fullname || jid,
                                'url': url,
                                'image_type': image_type,
                                'image': image,
                                'vcard_updated': converse.toISOString(new Date())
                            });
                        }, this),
                        $.proxy(function (stanza) {
                            converse.log("ChatBoxView.initialize: An error occured while fetching vcard");
                        }, this)
                    );
                }
            },

            initialize: function (){
                this.model.messages.on('add', this.showMessage, this);
                this.model.on('show', this.show, this);
                this.model.on('destroy', this.hide, this);
                this.model.on('change', this.onChange, this);
                this.updateVCard();
                this.$el.appendTo(converse.chatboxesview.$el);
                this.render().show().model.messages.fetch({add: true});
                if (this.model.get('status')) {
                    this.showStatusMessage(this.model.get('status'));
                }
            },

            template: _.template(
                '<div class="chat-head chat-head-chatbox">' +
                    '<a class="close-chatbox-button icon-close"></a>' +
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
                    'placeholder="'+__('Personal message')+'"/>'+
                '</form>'),

            renderAvatar: function () {
                if (!this.model.get('image')) {
                    return;
                }
                var img_src = 'data:'+this.model.get('image_type')+';base64,'+this.model.get('image'),
                    canvas = $('<canvas height="33px" width="33px" class="avatar"></canvas>'),
                    ctx = canvas.get(0).getContext('2d'),
                    img = new Image();   // Create new Image object
                img.onload = function() {
                    var ratio = img.width/img.height;
                    ctx.drawImage(img, 0,0, 35*ratio, 35);
                };
                img.src = img_src;
                this.$el.find('.chat-title').before(canvas);
            },

            render: function () {
                this.$el.attr('id', this.model.get('box_id'))
                    .html(this.template(this.model.toJSON()));
                this.renderAvatar();
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

        this.ContactsPanel = Backbone.View.extend({
            tagName: 'div',
            className: 'oc-chat-content',
            id: 'users',
            events: {
                'click a.toggle-xmpp-contact-form': 'toggleContactForm',
                'submit form.add-xmpp-contact': 'addContactFromForm',
                'submit form.search-xmpp-contact': 'searchContacts',
                'click a.subscribe-to-user': 'addContactFromList'
            },

            tab_template: _.template('<li><a class="s current" href="#users">'+__('Contacts')+'</a></li>'),
            template: _.template(
                '<form class="set-xmpp-status" action="" method="post">'+
                    '<span id="xmpp-status-holder">'+
                        '<select id="select-xmpp-status" style="display:none">'+
                            '<option value="online">'+__('Online')+'</option>'+
                            '<option value="dnd">'+__('Busy')+'</option>'+
                            '<option value="away">'+__('Away')+'</option>'+
                            '<option value="offline">'+__('Offline')+'</option>'+
                        '</select>'+
                    '</span>'+
                '</form>'+
                '<dl class="add-converse-contact dropdown">' +
                    '<dt id="xmpp-contact-search" class="fancy-dropdown">' +
                        '<a class="toggle-xmpp-contact-form" href="#"'+
                            'title="'+__('Click to add new chat contacts')+'">'+
                        '<span class="icon-plus"></span>'+__('Add a contact')+'</a>' +
                    '</dt>' +
                    '<dd class="search-xmpp" style="display:none"><ul></ul></dd>' +
                '</dl>'
            ),

            add_contact_template: _.template(
                '<li>'+
                    '<form class="add-xmpp-contact">' +
                        '<input type="text" name="identifier" class="username" placeholder="'+__('Contact username')+'"/>' +
                        '<button type="submit">'+__('Add')+'</button>' +
                    '</form>'+
                '<li>'
            ),

            search_contact_template: _.template(
                '<li>'+
                    '<form class="search-xmpp-contact">' +
                        '<input type="text" name="identifier" class="username" placeholder="'+__('Contact name')+'"/>' +
                        '<button type="submit">'+__('Search')+'</button>' +
                    '</form>'+
                '<li>'
            ),

            initialize: function (cfg) {
                cfg.$parent.append(this.$el);
                this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
            },

            render: function () {
                var markup;
                this.$tabs.append(this.tab_template());
                if (converse.xhr_user_search) {
                    markup = this.search_contact_template();
                } else {
                    markup = this.add_contact_template();
                }
                this.$el.html(this.template());
                this.$el.find('.search-xmpp ul').append(markup);
                this.$el.append(converse.rosterview.$el);
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
                    var $ul= $('.search-xmpp ul');
                    $ul.find('li.found-user').remove();
                    $ul.find('li.chat-info').remove();
                    if (!data.length) {
                        $ul.append('<li class="chat-info">'+__('No users found')+'</li>');
                    }

                    $(data).each(function (idx, obj) {
                        $ul.append(
                            $('<li class="found-user"></li>')
                            .append(
                                $('<a class="subscribe-to-user" href="#" title="'+__('Click to add as a chat contact')+'"></a>')
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
                        this.addContact(jid, fullname);
                    }, this),
                    $.proxy(function (stanza) {
                        converse.log("An error occured while fetching vcard");
                        var jid = $(stanza).attr('from');
                        this.addContact(jid, jid);
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
                    converse.connection.roster.subscribe(jid, null, converse.xmppstatus.get('fullname'));
                });
            }
        });

        this.RoomsPanel = Backbone.View.extend({
            tagName: 'div',
            id: 'chatrooms',
            events: {
                'submit form.add-chatroom': 'createChatRoom',
                'click input#show-rooms': 'showRooms',
                'click a.open-room': 'createChatRoom',
                'click a.room-info': 'showRoomInfo'
            },
            room_template: _.template(
                '<dd class="available-chatroom">'+
                '<a class="open-room" data-room-jid="{{jid}}"'+
                    'title="'+__('Click to open this room')+'" href="#">{{name}}</a>'+
                '<a class="room-info icon-room-info" data-room-jid="{{jid}}"'+
                    'title="'+__('Show more information on this room')+'" href="#">&nbsp;</a>'+
                '</dd>'),

            // FIXME: check markup in mockup
            room_description_template: _.template(
                '<div class="room-info">'+
                '<p class="room-info"><strong>'+__('Description:')+'</strong> {{desc}}</p>' +
                '<p class="room-info"><strong>'+__('Occupants:')+'</strong> {{occ}}</p>' +
                '<p class="room-info"><strong>'+__('Features:')+'</strong> <ul>'+
                '{[ if (passwordprotected) { ]}' +
                    '<li class="room-info locked">'+__('Requires authentication')+'</li>' +
                '{[ } ]}' +
                '{[ if (hidden) { ]}' +
                    '<li class="room-info">'+__('Hidden')+'</li>' +
                '{[ } ]}' +
                '{[ if (membersonly) { ]}' +
                    '<li class="room-info">'+__('Requires an invitation')+'</li>' +
                '{[ } ]}' +
                '{[ if (moderated) { ]}' +
                    '<li class="room-info">'+__('Moderated')+'</li>' +
                '{[ } ]}' +
                '{[ if (nonanonymous) { ]}' +
                    '<li class="room-info">'+__('Non-anonymous')+'</li>' +
                '{[ } ]}' +
                '{[ if (open) { ]}' +
                    '<li class="room-info">'+__('Open room')+'</li>' +
                '{[ } ]}' +
                '{[ if (persistent) { ]}' +
                    '<li class="room-info">'+__('Permanent room')+'</li>' +
                '{[ } ]}' +
                '{[ if (publicroom) { ]}' +
                    '<li class="room-info">'+__('Public')+'</li>' +
                '{[ } ]}' +
                '{[ if (semianonymous) { ]}' +
                    '<li class="room-info">'+__('Semi-anonymous')+'</li>' +
                '{[ } ]}' +
                '{[ if (temporary) { ]}' +
                    '<li class="room-info">'+__('Temporary room')+'</li>' +
                '{[ } ]}' +
                '{[ if (unmoderated) { ]}' +
                    '<li class="room-info">'+__('Unmoderated')+'</li>' +
                '{[ } ]}' +
                '</p>' +
                '</div>'
            ),

            tab_template: _.template('<li><a class="s" href="#chatrooms">'+__('Rooms')+'</a></li>'),

            template: _.template(
                '<form class="add-chatroom" action="" method="post">'+
                    '<input type="text" name="chatroom" class="new-chatroom-name" placeholder="'+__('Room name')+'"/>'+
                    '<input type="text" name="nick" class="new-chatroom-nick" placeholder="'+__('Nickname')+'"/>'+
                    '<input type="{{ server_input_type }}" name="server" class="new-chatroom-server" placeholder="'+__('Server')+'"/>'+
                    '<input type="submit" name="join" value="'+__('Join')+'"/>'+
                    '<input type="button" name="show" id="show-rooms" value="'+__('Show rooms')+'"/>'+
                '</form>'+
                '<dl id="available-chatrooms"></dl>'),

            initialize: function (cfg) {
                cfg.$parent.append(
                    this.$el.html(
                        this.template({
                            server_input_type: converse.hide_muc_server && 'hidden' || 'text'
                        })
                    ).hide());
                this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');

                this.on('update-rooms-list', function (ev) {
                    this.updateRoomsList();
                });
                converse.xmppstatus.on("change", $.proxy(function (model) {
                    if (!(_.has(model.changed, 'fullname'))) {
                        return;
                    }
                    var $nick = this.$el.find('input.new-chatroom-nick');
                    if (! $nick.is(':focus')) {
                        $nick.val(model.get('fullname'));
                    }
                }, this));
            },

            render: function () {
                this.$tabs.append(this.tab_template());
                return this;
            },

            informNoRoomsFound: function () {
                var $available_chatrooms = this.$el.find('#available-chatrooms');
                // # For translators: %1$s is a variable and will be replaced with the XMPP server name
                $available_chatrooms.html('<dt>'+__('No rooms on %1$s',this.muc_domain)+'</dt>');
                $('input#show-rooms').show().siblings('span.spinner').remove();
            },

            updateRoomsList: function (domain) {
                converse.connection.muc.listRooms(
                    this.muc_domain,
                    $.proxy(function (iq) { // Success
                        var name, jid, i, fragment,
                            that = this,
                            $available_chatrooms = this.$el.find('#available-chatrooms');
                        this.rooms = $(iq).find('query').find('item');
                        if (this.rooms.length) {
                            // # For translators: %1$s is a variable and will be
                            // # replaced with the XMPP server name
                            $available_chatrooms.html('<dt>'+__('Rooms on %1$s',this.muc_domain)+'</dt>');
                            fragment = document.createDocumentFragment();
                            for (i=0; i<this.rooms.length; i++) {
                                name = Strophe.unescapeNode($(this.rooms[i]).attr('name')||$(this.rooms[i]).attr('jid'));
                                jid = $(this.rooms[i]).attr('jid');
                                fragment.appendChild($(this.room_template({
                                    'name':name,
                                    'jid':jid
                                    }))[0]);
                            }
                            $available_chatrooms.append(fragment);
                            $('input#show-rooms').show().siblings('span.spinner').remove();
                        } else {
                            this.informNoRoomsFound();
                        }
                        return true;
                    }, this),
                    $.proxy(function (iq) { // Failure
                        this.informNoRoomsFound();
                    }, this));
            },

            showRooms: function (ev) {
                var $available_chatrooms = this.$el.find('#available-chatrooms');
                var $server = this.$el.find('input.new-chatroom-server');
                var server = $server.val();
                if (!server) {
                    $server.addClass('error');
                    return;
                }
                this.$el.find('input.new-chatroom-name').removeClass('error');
                $server.removeClass('error');
                $available_chatrooms.empty();
                $('input#show-rooms').hide().after('<span class="spinner"/>');
                this.muc_domain = server;
                this.updateRoomsList();
            },

            showRoomInfo: function (ev) {
                var target = ev.target,
                    $dd = $(target).parent('dd'),
                    $div = $dd.find('div.room-info');
                if ($div.length) {
                    $div.remove();
                } else {
                    $dd.find('span.spinner').remove();
                    $dd.append('<span class="spinner hor_centered"/>');
                    converse.connection.disco.info(
                        $(target).attr('data-room-jid'),
                        null,
                        $.proxy(function (stanza) {
                            var $stanza = $(stanza);
                            // All MUC features found here: http://xmpp.org/registrar/disco-features.html
                            $dd.find('span.spinner').replaceWith(
                                this.room_description_template({
                                    'desc': $stanza.find('field[var="muc#roominfo_description"] value').text(),
                                    'occ': $stanza.find('field[var="muc#roominfo_occupants"] value').text(),
                                    'hidden': $stanza.find('feature[var="muc_hidden"]').length,
                                    'membersonly': $stanza.find('feature[var="muc_membersonly"]').length,
                                    'moderated': $stanza.find('feature[var="muc_moderated"]').length,
                                    'nonanonymous': $stanza.find('feature[var="muc_nonanonymous"]').length,
                                    'open': $stanza.find('feature[var="muc_open"]').length,
                                    'passwordprotected': $stanza.find('feature[var="muc_passwordprotected"]').length,
                                    'persistent': $stanza.find('feature[var="muc_persistent"]').length,
                                    'publicroom': $stanza.find('feature[var="muc_public"]').length,
                                    'semianonymous': $stanza.find('feature[var="muc_semianonymous"]').length,
                                    'temporary': $stanza.find('feature[var="muc_temporary"]').length,
                                    'unmoderated': $stanza.find('feature[var="muc_unmoderated"]').length
                                }));
                        }, this));
                }
            },

            createChatRoom: function (ev) {
                ev.preventDefault();
                var name, $name,
                    server, $server,
                    jid,
                    $nick = this.$el.find('input.new-chatroom-nick'),
                    nick = $nick.val(),
                    chatroom;

                if (!nick) { $nick.addClass('error'); }
                else { $nick.removeClass('error'); }

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
                        $name.removeClass('error');
                        $server.removeClass('error');
                        this.muc_domain = server;
                    } else {
                        if (!name) { $name.addClass('error'); }
                        if (!server) { $server.addClass('error'); }
                        return;
                    }
                }
                if (!nick) { return; }
                chatroom = converse.chatboxesview.showChatBox({
                    'id': jid,
                    'jid': jid,
                    'name': Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                    'nick': nick,
                    'chatroom': true,
                    'box_id' : hex_sha1(jid)
                });
                if (!chatroom.get('connected')) {
                    converse.chatboxesview.views[jid].connect(null);
                }
            }
        });

        this.ControlBoxView = converse.ChatBoxView.extend({
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
                    this.roomspanel.muc_domain = feature.get('from');
                    var $server= this.$el.find('input.new-chatroom-server');
                    if (! $server.is(':focus')) {
                        $server.val(this.roomspanel.muc_domain);
                    }
                    if (converse.auto_list_rooms) {
                        this.roomspanel.trigger('update-rooms-list');
                    }
                }
            },

            template: _.template(
                '<div class="chat-head oc-chat-head">'+
                    '<ul id="controlbox-tabs"></ul>'+
                    '<a class="close-chatbox-button icon-close"></a>'+
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
                if ((!converse.prebind) && (!converse.connection)) {
                    // Add login panel if the user still has to authenticate
                    this.$el.html(this.template(this.model.toJSON()));
                    this.loginpanel = new converse.LoginPanel({'$parent': this.$el.find('#controlbox-panes'), 'model': this});
                    this.loginpanel.render();
                } else if (!this.contactspanel) {
                    this.$el.html(this.template(this.model.toJSON()));
                    this.contactspanel = new converse.ContactsPanel({'$parent': this.$el.find('#controlbox-panes')});
                    this.contactspanel.render();
                    converse.xmppstatusview = new converse.XMPPStatusView({'model': converse.xmppstatus});
                    converse.xmppstatusview.render();
                    this.roomspanel = new converse.RoomsPanel({'$parent': this.$el.find('#controlbox-panes')});
                    this.roomspanel.render();
                }
                return this;
            }
        });

        this.ChatRoomView = converse.ChatBoxView.extend({
            length: 300,
            tagName: 'div',
            className: 'chatroom',
            events: {
                'click a.close-chatbox-button': 'closeChat',
                'click a.configure-chatroom-button': 'configureChatRoom',
                'keypress textarea.chat-textarea': 'keyPressed'
            },
            info_template: _.template('<div class="chat-info">{{message}}</div>'),

            sendChatRoomMessage: function (body) {
                var match = body.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false],
                    $chat_content;
                switch (match[1]) {
                    case 'msg':
                        // TODO: Private messages
                        break;
                    case 'clear':
                        this.$el.find('.chat-content').empty();
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
                        msgs = [
                            '<strong>/help</strong>:'+__('Show this menu')+'',
                            '<strong>/me</strong>:'+__('Write in the third person')+'',
                            '<strong>/topic</strong>:'+__('Set chatroom topic')+'',
                            '<strong>/kick</strong>:'+__('Kick user from chatroom')+'',
                            '<strong>/ban</strong>:'+__('Ban user from chatroom')+'',
                            '<strong>/clear</strong>:'+__('Remove messages')+''
                            ];
                        this.addHelpMessages(msgs);
                        break;
                    default:
                        this.last_msgid = converse.connection.muc.groupchat(this.model.get('jid'), body);
                    break;
                }
            },

            template: _.template(
                '<div class="chat-head chat-head-chatroom">' +
                    '<a class="close-chatbox-button icon-close"></a>' +
                    '<a class="configure-chatroom-button icon-wrench" style="display:none"></a>' +
                    '<div class="chat-title"> {{ name }} </div>' +
                    '<p class="chatroom-topic"><p/>' +
                '</div>' +
                '<div class="chat-body">' +
                '<span class="spinner centered"/>' +
                '</div>'),

            chatarea_template: _.template(
                '<div class="chat-area">' +
                    '<div class="chat-content"></div>' +
                    '<form class="sendXMPPMessage" action="" method="post">' +
                        '<textarea type="text" class="chat-textarea" ' +
                            'placeholder="'+__('Message')+'"/>' +
                    '</form>' +
                '</div>' +
                '<div class="participants">' +
                    '<ul class="participant-list"></ul>' +
                '</div>'
            ),

            render: function () {
                this.$el.attr('id', this.model.get('box_id'))
                        .html(this.template(this.model.toJSON()));
                return this;
            },

            renderChatArea: function () {
                if (!this.$el.find('.chat-area').length) {
                    this.$el.find('.chat-body').empty().append(this.chatarea_template());
                }
                return this;
            },

            connect: function (password) {
                if (_.has(converse.connection.muc.rooms, this.model.get('jid'))) {
                    // If the room exists, it already has event listeners, so we
                    // doing add them again.
                    converse.connection.muc.join(
                        this.model.get('jid'), this.model.get('nick'), null, null, null, password);
                } else {
                    converse.connection.muc.join(
                        this.model.get('jid'),
                        this.model.get('nick'),
                        $.proxy(this.onChatRoomMessage, this),
                        $.proxy(this.onChatRoomPresence, this),
                        $.proxy(this.onChatRoomRoster, this),
                        password);
                }
            },

            initialize: function () {
                this.connect(null);
                this.model.messages.on('add', this.showMessage, this);
                this.model.on('destroy', function (model, response, options) {
                    this.$el.hide('fast');
                    converse.connection.muc.leave(
                        this.model.get('jid'),
                        this.model.get('nick'),
                        $.proxy(this.onLeave, this),
                        undefined);
                },
                this);
                this.$el.appendTo(converse.chatboxesview.$el);
                this.render().show().model.messages.fetch({add: true});
            },

            onLeave: function () {
                this.model.set('connected', false);
            },

            form_input_template: _.template('<label>{{label}}<input name="{{name}}" type="{{type}}" value="{{value}}"></label>'),
            select_option_template: _.template('<option value="{{value}}">{{label}}</option>'),
            form_select_template: _.template('<label>{{label}}<select name="{{name}}">{{options}}</select></label>'),
            form_checkbox_template: _.template('<label>{{label}}<input name="{{name}}" type="{{type}}" {{checked}}"></label>'),

            renderConfigurationForm: function (stanza) {
                var $form= this.$el.find('form.chatroom-form'),
                    $stanza = $(stanza),
                    $fields = $stanza.find('field'),
                    title = $stanza.find('title').text(),
                    instructions = $stanza.find('instructions').text(),
                    i, j, options=[];
                var input_types = {
                    'text-private': 'password',
                    'text-single': 'textline',
                    'boolean': 'checkbox',
                    'hidden': 'hidden',
                    'list-single': 'dropdown'
                };
                $form.find('span.spinner').remove();
                $form.append($('<legend>').text(title));
                if (instructions != title) {
                    $form.append($('<p>').text(instructions));
                }
                for (i=0; i<$fields.length; i++) {
                    $field = $($fields[i]);
                    if ($field.attr('type') == 'list-single') {
                        options = [];
                        $options = $field.find('option');
                        for (j=0; j<$options.length; j++) {
                            options.push(this.select_option_template({
                                value: $($options[j]).find('value').text(),
                                label: $($options[j]).attr('label')
                            }));
                        }
                        $form.append(this.form_select_template({
                            name: $field.attr('var'),
                            label: $field.attr('label'),
                            options: options.join('')
                        }));
                    } else if ($field.attr('type') == 'boolean') {
                        $form.append(this.form_checkbox_template({
                            name: $field.attr('var'),
                            type: input_types[$field.attr('type')],
                            label: $field.attr('label') || '',
                            checked: $field.find('value').text() === "1" && 'checked="1"' || ''
                        }));
                    } else {
                        $form.append(this.form_input_template({
                            name: $field.attr('var'),
                            type: input_types[$field.attr('type')],
                            label: $field.attr('label') || '',
                            value: $field.find('value').text()
                        }));
                    }
                }
                $form.append('<input type="submit" value="'+__('Save')+'"/>');
                $form.append('<input type="button" value="'+__('Cancel')+'"/>');
                $form.on('submit', $.proxy(this.saveConfiguration, this));
                $form.find('input[type=button]').on('click', $.proxy(this.cancelConfiguration, this));
            },

            field_template: _.template('<field var="{{name}}"><value>{{value}}</value></field>'),

            saveConfiguration: function (ev) {
                ev.preventDefault();
                var that = this;
                var $inputs = $(ev.target).find(':input:not([type=button]):not([type=submit])'),
                    count = $inputs.length,
                    configArray = [];
                $inputs.each(function () {
                    var $input = $(this), value;
                    if ($input.is('[type=checkbox]')) {
                        value = $input.is(':checked') && 1 || 0;
                    } else {
                        value = $input.val();
                    }
                    var cnode = $(that.field_template({
                        name: $input.attr('name'),
                        value: value
                    }))[0];
                    configArray.push(cnode);
                    if (!--count) {
                        converse.connection.muc.saveConfiguration(
                            that.model.get('jid'),
                            configArray,
                            $.proxy(that.onConfigSaved, that),
                            $.proxy(that.onErrorConfigSaved, that)
                        );
                    }
                });
                this.$el.find('div.chatroom-form-container').hide(
                    function () {
                        $(this).remove();
                        that.$el.find('.chat-area').show();
                        that.$el.find('.participants').show();
                    });
            },

            onConfigSaved: function (stanza) {
                // XXX
            },

            onErrorConfigSaved: function (stanza) {
                this.insertStatusNotification(__("An error occurred while trying to save the form."));
            },

            cancelConfiguration: function (ev) {
                ev.preventDefault();
                var that = this;
                this.$el.find('div.chatroom-form-container').hide(
                    function () {
                        $(this).remove();
                        that.$el.find('.chat-area').show();
                        that.$el.find('.participants').show();
                    });
            },

            configureChatRoom: function (ev) {
                ev.preventDefault();
                if (this.$el.find('div.chatroom-form-container').length) {
                    return;
                }
                this.$el.find('.chat-area').hide();
                this.$el.find('.participants').hide();
                this.$el.find('.chat-body').append(
                    $('<div class="chatroom-form-container">'+
                        '<form class="chatroom-form">'+
                        '<span class="spinner centered"/>'+
                        '</form>'+
                    '</div>'));
                converse.connection.muc.configure(
                    this.model.get('jid'),
                    $.proxy(this.renderConfigurationForm, this)
                );
            },

            submitPassword: function (ev) {
                ev.preventDefault();
                var password = this.$el.find('.chatroom-form').find('input[type=password]').val();
                this.$el.find('.chatroom-form-container').replaceWith(
                    '<span class="spinner centered"/>');
                this.connect(password);
            },

            renderPasswordForm: function () {
                this.$el.find('span.centered.spinner').remove();
                this.$el.find('.chat-body').append(
                    $('<div class="chatroom-form-container">'+
                        '<form class="chatroom-form">'+
                            '<legend>'+__('This chatroom requires a password')+'</legend>' +
                            '<label>'+__('Password: ')+'<input type="password" name="password"/></label>' +
                            '<input type="submit" value="'+__('Submit')+'/>' +
                        '</form>'+
                    '</div>'));
                this.$el.find('.chatroom-form').on('submit', $.proxy(this.submitPassword, this));
            },

            showDisconnectMessage: function (msg) {
                this.$el.find('.chat-area').remove();
                this.$el.find('.participants').remove();
                this.$el.find('span.centered.spinner').remove();
                this.$el.find('.chat-body').append($('<p>'+msg+'</p>'));
            },

            infoMessages: {
                100: __('This room is not anonymous'),
                102: __('This room now shows unavailable members'),
                103: __('This room does not show unavailable members'),
                104: __('Non-privacy-related room configuration has changed'),
                170: __('Room logging is now enabled'),
                171: __('Room logging is now disabled'),
                172: __('This room is now non-anonymous'),
                173: __('This room is now semi-anonymous'),
                174: __('This room is now fully-anonymous'),
                201: __('A new room has been created'),
                210: __('Your nickname has been changed')
            },

            actionInfoMessages: {
                /* XXX: Note the triple underscore function and not double
                 * underscore.
                 *
                 * This is a hack. We can't pass the strings to __ because we
                 * don't yet know what the variable to interpolate is.
                 *
                 * Triple underscore will just return the string again, but we
                 * can then at least tell gettext to scan for it so that these
                 * strings are picked up by the translation machinery.
                 */
                301: ___("<strong>%1$s</strong> has been banned"),
                307: ___("<strong>%1$s</strong> has been kicked out"),
                321: ___("<strong>%1$s</strong> has been removed because of an affiliation change"),
                322: ___("<strong>%1$s</strong> has been removed for not being a member")
            },

            disconnectMessages: {
                301: __('You have been banned from this room'),
                307: __('You have been kicked from this room'),
                321: __("You have been removed from this room because of an affiliation change"),
                322: __("You have been removed from this room because the room has changed to members-only and you're not a member"),
                332: __("You have been removed from this room because the MUC (Multi-user chat) service is being shut down.")
            },

            showStatusMessages: function ($el, is_self) {
                /* Check for status codes and communicate their purpose to the user
                * See: http://xmpp.org/registrar/mucstatus.html
                */
                var $chat_content = this.$el.find('.chat-content'),
                    $stats = $el.find('status'),
                    disconnect_msgs = [],
                    info_msgs = [],
                    action_msgs = [],
                    msgs, i;
                for (i=0; i<$stats.length; i++) {
                    var stat = $stats[i].getAttribute('code');
                    if (is_self) {
                        if (_.contains(_.keys(this.disconnectMessages), stat)) {
                            disconnect_msgs.push(this.disconnectMessages[stat]);
                        }
                    } else {
                        if (_.contains(_.keys(this.infoMessages), stat)) {
                            info_msgs.push(this.infoMessages[stat]);
                        } else if (_.contains(_.keys(this.actionInfoMessages), stat)) {
                            action_msgs.push(
                                __(this.actionInfoMessages[stat], Strophe.unescapeNode(Strophe.getResourceFromJid($el.attr('from'))))
                            );
                        }
                    }
                }
                if (disconnect_msgs.length > 0) {
                    for (i=0; i<disconnect_msgs.length; i++) {
                        this.showDisconnectMessage(disconnect_msgs[i]);
                    }
                    this.model.set('connected', false);
                    return;
                }
                this.renderChatArea();
                for (i=0; i<info_msgs.length; i++) {
                    $chat_content.append(this.info_template({message: info_msgs[i]}));
                }
                for (i=0; i<action_msgs.length; i++) {
                    $chat_content.append(this.info_template({message: action_msgs[i]}));
                }
                this.scrollDown();
            },

            showErrorMessage: function ($error, room) {
                // We didn't enter the room, so we must remove it from the MUC
                // add-on
                delete converse.connection.muc[room.name];
                if ($error.attr('type') == 'auth') {
                    if ($error.find('not-authorized').length) {
                        this.renderPasswordForm();
                    } else if ($error.find('registration-required').length) {
                        this.showDisconnectMessage(__('You are not on the member list of this room'));
                    } else if ($error.find('forbidden').length) {
                        this.showDisconnectMessage(__('You have been banned from this room'));
                    }
                } else if ($error.attr('type') == 'modify') {
                    if ($error.find('jid-malformed').length) {
                        this.showDisconnectMessage(__('No nickname was specified'));
                    }
                } else if ($error.attr('type') == 'cancel') {
                    if ($error.find('not-allowed').length) {
                        this.showDisconnectMessage(__('You are not allowed to create new rooms'));
                    } else if ($error.find('not-acceptable').length) {
                        this.showDisconnectMessage(__("Your nickname doesn't conform to this room's policies"));
                    } else if ($error.find('conflict').length) {
                        this.showDisconnectMessage(__("Your nickname is already taken"));
                    } else if ($error.find('item-not-found').length) {
                        this.showDisconnectMessage(__("This room does not (yet) exist"));
                    } else if ($error.find('service-unavailable').length) {
                        this.showDisconnectMessage(__("This room has reached it's maximum number of occupants"));
                    }
                }
            },

            onChatRoomPresence: function (presence, room) {
                var nick = room.nick,
                    $presence = $(presence),
                    from = $presence.attr('from'),
                    is_self = ($presence.find("status[code='110']").length) || (from == room.name+'/'+Strophe.escapeNode(nick)),
                    $item;

                if ($presence.attr('type') === 'error') {
                    this.model.set('connected', false);
                    this.showErrorMessage($presence.find('error'), room);
                } else {
                    this.model.set('connected', true);
                    this.showStatusMessages($presence, is_self);
                    if (!this.model.get('connected')) {
                        return true;
                    }
                    if ($presence.find("status[code='201']").length) {
                        // This is a new chatroom. We create an instant
                        // chatroom, and let the user manually set any
                        // configuration setting.
                        converse.connection.muc.createInstantRoom(room.name);
                    }
                    if (is_self) {
                        $item = $presence.find('item');
                        if ($item.length) {
                            if ($item.attr('affiliation') == 'owner') {
                                this.$el.find('a.configure-chatroom-button').show();
                            }
                        }
                        if ($presence.find("status[code='210']").length) {
                            // check if server changed our nick
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
                    resource = Strophe.getResourceFromJid(jid),
                    sender = resource && Strophe.unescapeNode(resource) || '',
                    delayed = $message.find('delay').length > 0,
                    subject = $message.children('subject').text(),
                    match, template, message_datetime, message_date, dates, isodate, stamp;

                if (delayed) {
                    stamp = $message.find('delay').attr('stamp');
                    message_datetime = converse.parseISO8601(stamp);
                } else {
                    message_datetime = new Date();
                }
                // If this message is on a different day than the one received
                // prior, then indicate it on the chatbox.
                dates = $chat_content.find("time").map(function(){return $(this).attr("datetime");}).get();
                message_date = new Date(message_datetime.getTime());
                message_date.setUTCHours(0,0,0,0);
                isodate = converse.toISOString(message_date);
                if (_.indexOf(dates, isodate) == -1) {
                    $chat_content.append(this.new_day_template({
                        isodate: isodate,
                        datestring: message_date.toString().substring(0,15)
                    }));
                }
                this.showStatusMessages($message);
                if (subject) {
                    this.$el.find('.chatroom-topic').text(subject).attr('title', subject);
                    // # For translators: the %1$s and %2$s parts will get replaced by the user and topic text respectively
                    // # Example: Topic set by JC Brand to: Hello World!
                    $chat_content.append(this.info_template({'message': __('Topic set by %1$s to: %2$s', sender, subject)}));
                }
                if (!body) { return true; }
                this.appendMessage($chat_content,
                                {'message': body,
                                    'sender': sender === this.model.get('nick') && 'me' || 'room',
                                    'fullname': sender,
                                    'time': converse.toISOString(message_datetime)
                                });
                this.scrollDown();
                return true;
            },

            occupant_template: _.template(
                '<li class="{{role}}" '+
                    '{[ if (role === "moderator") { ]}' +
                        'title="'+__('This user is a moderator')+'"' +
                    '{[ } ]}'+
                    '{[ if (role === "participant") { ]}' +
                        'title="'+__('This user can send messages in this room')+'"' +
                    '{[ } ]}'+
                    '{[ if (role === "visitor") { ]}' +
                        'title="'+__('This user can NOT send messages in this room')+'"' +
                    '{[ } ]}'+
                '>{{nick}}</li>'
            ),

            onChatRoomRoster: function (roster, room) {
                this.renderChatArea();
                var controlboxview = converse.chatboxesview.views.controlbox,
                    roster_size = _.size(roster),
                    $participant_list = this.$el.find('.participant-list'),
                    participants = [], keys = _.keys(roster), i;
                this.$el.find('.participant-list').empty();
                for (i=0; i<roster_size; i++) {
                    participants.push(
                        this.occupant_template({
                            role: roster[keys[i]].role,
                            nick: Strophe.unescapeNode(keys[i])
                        }));
                }
                $participant_list.append(participants.join(""));
                return true;
            }
        });

        this.ChatBoxes = Backbone.Collection.extend({
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
                var partner_jid, $message = $(message),
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
                    resource, chatbox, roster_item;
                if (from == converse.bare_jid) {
                    // I am the sender, so this must be a forwarded message...
                    partner_jid = to;
                    resource = Strophe.getResourceFromJid($message.attr('to'));
                } else {
                    partner_jid = from;
                    resource = Strophe.getResourceFromJid(message_from);
                }
                chatbox = this.get(partner_jid);
                roster_item = converse.roster.get(partner_jid);
                if (!chatbox) {
                    chatbox = this.create({
                        'id': partner_jid,
                        'jid': partner_jid,
                        'fullname': roster_item.get('fullname') || jid,
                        'image_type': roster_item.get('image_type'),
                        'image': roster_item.get('image'),
                        'url': roster_item.get('url')
                    });
                }
                chatbox.messageReceived(message);
                converse.roster.addResource(partner_jid, resource);
                return true;
            }
        });

        this.ChatBoxesView = Backbone.View.extend({
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
                        delete view.model; // Remove ref to old model to help garbage collection
                        view.model = item;
                        view.initialize();
                        if (item.get('id') !== 'controlbox') {
                            // FIXME: Why is it necessary to again append chatboxes?
                            view.$el.appendTo(this.$el);
                        }
                    }
                }, this);
            },

            showChatBox: function (attrs) {
                var chatbox  = this.model.get(attrs.jid);
                if (chatbox) {
                    chatbox.trigger('show');
                } else {
                    chatbox = this.model.create(attrs, {
                        'error': function (model, response) {
                            converse.log(response.responseText);
                        }
                    });
                }
                return chatbox;
            }
        });

        this.RosterItem = Backbone.Model.extend({
            initialize: function (attributes, options) {
                var jid = attributes.jid;
                if (!attributes.fullname) {
                    attributes.fullname = jid;
                }
                var attrs = _.extend({
                    'id': jid,
                    'user_id': Strophe.getNodeFromJid(jid),
                    'resources': [],
                    'status': ''
                }, attributes);
                attrs.sorted = false;
                attrs.chat_status = 'offline';
                this.set(attrs);
            }
        });

        this.RosterItemView = Backbone.View.extend({
            tagName: 'dd',

            events: {
                "click .accept-xmpp-request": "acceptRequest",
                "click .decline-xmpp-request": "declineRequest",
                "click .open-chat": "openChat",
                "click .remove-xmpp-contact": "removeContact"
            },

            openChat: function (ev) {
                ev.preventDefault();
                converse.chatboxesview.showChatBox({
                    'id': this.model.get('jid'),
                    'jid': this.model.get('jid'),
                    'fullname': this.model.get('fullname'),
                    'image_type': this.model.get('image_type'),
                    'image': this.model.get('image'),
                    'url': this.model.get('url'),
                    'status': this.model.get('status')
                });
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
                    converse.connection.roster.subscribe(jid, null, converse.xmppstatus.get('fullname'));
                });
                ev.preventDefault();
            },

            declineRequest: function (ev) {
                ev.preventDefault();
                converse.connection.roster.unauthorize(this.model.get('jid'));
                this.model.destroy();
            },

            template: _.template(
                '<a class="open-chat" title="'+__('Click to chat with this contact')+'" href="#">'+
                    '<span class="icon-{{ chat_status }}" title="{{ status_desc }}"></span>{{ fullname }}'+
                '</a>' +
                '<a class="remove-xmpp-contact icon-remove" title="'+__('Click to remove this contact')+'" href="#"></a>'),

            pending_template: _.template(
                '<span>{{ fullname }}</span>' +
                '<a class="remove-xmpp-contact icon-remove" title="'+__('Click to remove this contact')+'" href="#"></a>'),

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
                    _.each(['pending-xmpp-contact', 'requesting-xmpp-contact'], 
                        function (cls) {
                            if (this.el.className.indexOf(cls) !== -1) {
                                this.$el.removeClass(cls);
                            }
                        }, this);
                    this.$el.addClass('current-xmpp-contact');
                    var status_desc = {
                        'dnd': 'This contact is busy',
                        'online': 'This contact is online',
                        'offline': 'This contact is offline',
                        'away': 'This contact is away'
                        }[item.get('chat_status')||'offline'];
                    this.$el.html(this.template(
                        _.extend(item.toJSON(), {'status_desc': status_desc})
                        ));
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

        this.getVCard = function (jid, callback, errback) {
            converse.connection.vcard.get($.proxy(function (iq) {
                $vcard = $(iq).find('vCard');
                var fullname = $vcard.find('FN').text(),
                    img = $vcard.find('BINVAL').text(),
                    img_type = $vcard.find('TYPE').text(),
                    url = $vcard.find('URL').text();
                var rosteritem = converse.roster.get(jid);
                if (rosteritem) {
                    rosteritem.save({
                        'fullname': fullname || jid,
                        'image_type': img_type,
                        'image': img,
                        'url': url,
                        'vcard_updated': converse.toISOString(new Date())
                    });
                }
                callback(jid, fullname, img, img_type, url);
            }, this), jid, errback);
        };

        this.RosterItems = Backbone.Collection.extend({
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
                            converse.connection.roster.subscribe(jid, null, converse.xmppstatus.get('fullname'));
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
                    converse.connection.roster.subscribe(jid, null, converse.xmppstatus.get('fullname'));
                } else {
                    converse.connection.roster.add(jid, '', [], function (iq) {
                        converse.connection.roster.authorize(bare_jid);
                        converse.connection.roster.subscribe(jid, null, converse.xmppstatus.get('fullname'));
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
                    presence_type = $presence.attr('type');
                if (presence_type === 'error') {
                    // TODO
                    // error presence stanzas don't necessarily have a 'from' attr.
                    return true;
                }
                var jid = $presence.attr('from'),
                    bare_jid = Strophe.getBareJidFromJid(jid),
                    resource = Strophe.getResourceFromJid(jid),
                    $show = $presence.find('show'),
                    chat_status = $show.text() || 'online',
                    status_message = $presence.find('status'),
                    item;

                if (this.isSelf(bare_jid)) {
                    if ((converse.connection.jid !== jid)&&(presence_type !== 'unavailable')) {
                        // Another resource has changed it's status, we'll update ours as well.
                        // FIXME: We should ideally differentiate between converse.js using
                        // resources and other resources (i.e Pidgin etc.)
                        converse.xmppstatus.save({'status': chat_status});
                    }
                    return true;
                } else if (($presence.find('x').attr('xmlns') || '').indexOf(Strophe.NS.MUC) === 0) {
                    return true; // Ignore MUC
                }
                item = this.getItem(bare_jid);
                if (item && (status_message.text() != item.get('status'))) {
                    item.save({'status': status_message.text()});
                }
                if ((presence_type === 'subscribed') || (presence_type === 'unsubscribe')) {
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
                                    converse.log("Error while retrieving vcard");
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

        this.RosterView = Backbone.View.extend({
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

                this.model.on("remove", function (item) { this.removeRosterItem(item); }, this);
                this.model.on("destroy", function (item) { this.removeRosterItem(item); }, this);

                this.$el.hide().html(this.template());
                this.model.fetch({
                    add: true,
                    success: function (model, resp, options) {
                        if (resp.length === 0) {
                            // The presence stanza is sent out once all
                            // roster contacts have been added and rendered.
                            // See RosterView's render method.
                            //
                            // If there aren't any roster contacts, we still
                            // want to send a presence stanza, so we do it here.
                            converse.xmppstatus.sendPresence();
                        }
                    },
                }); // Get the cached roster items from localstorage
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

            template: _.template('<dt id="xmpp-contact-requests">'+__('Contact requests')+'</dt>' +
                                '<dt id="xmpp-contacts">'+__('My contacts')+'</dt>' +
                                '<dt id="pending-xmpp-contacts">'+__('Pending contacts')+'</dt>'),

            render: function (item) {
                var $my_contacts = this.$el.find('#xmpp-contacts'),
                    $contact_requests = this.$el.find('#xmpp-contact-requests'),
                    $pending_contacts = this.$el.find('#pending-xmpp-contacts'),
                    sorted = false,
                    $count, changed_presence;
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
                        if ($.contains(document.documentElement, view.el)) {
                            view.render();
                        } else {
                            $my_contacts.after(view.render().el);
                        }
                    }
                    changed_presence = view.model.changed.chat_status;
                    if (changed_presence) {
                        this.sortRoster(changed_presence)
                        sorted = true;
                    } 
                    if (item.get('is_last')) {
                        if (!sorted) {
                            this.sortRoster(item.get('chat_status'));
                        }
                        if (!this.$el.is(':visible')) {
                            // Once all initial roster items have been added, we
                            // can show the roster.
                            this.$el.show();
                        }
                        converse.xmppstatus.sendPresence();
                    }
                }
                // Hide the headings if there are no contacts under them
                _.each([$my_contacts, $contact_requests, $pending_contacts], function (h) {
                    if (h.nextUntil('dt').length) {
                        if (!h.is(':visible')) {
                            h.show();
                        }
                    }
                    else if (h.is(':visible')) {
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

            sortRoster: function (chat_status) {
                var $my_contacts = this.$el.find('#xmpp-contacts');
                $my_contacts.siblings('dd.current-xmpp-contact.'+chat_status).tsort('a', {order:'asc'});
                $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.offline'));
                $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.unavailable'));
                $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.away'));
                $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.dnd'));
                $my_contacts.after($my_contacts.siblings('dd.current-xmpp-contact.online'));
            }
        });

        this.XMPPStatus = Backbone.Model.extend({
            initialize: function () {
                this.set({
                    'status' : this.get('status') || 'online'
                });
                this.on('change', $.proxy(function () {
                    if (this.get('fullname') === undefined) {
                        converse.getVCard(
                            null, // No 'to' attr when getting one's own vCard
                            $.proxy(function (jid, fullname, image, image_type, url) {
                                this.save({'fullname': fullname});
                            }, this)
                        );
                    }
                }, this));
            },

            sendPresence: function (type) {
                if (type === undefined) {
                    type = this.get('status') || 'online';
                }
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
                        presence = $pres().c('show').t(type).up();
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
                if (this.xhr_custom_status) {
                    $.ajax({
                        url: 'set-custom-status',
                        type: 'POST',
                        data: {'msg': status_message}
                    });
                }
            }
        });

        this.XMPPStatusView = Backbone.View.extend({
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
                    '<input type="text" class="custom-xmpp-status" {{ status_message }}"'+
                        'placeholder="'+__('Custom status')+'"/>' +
                    '<button type="submit">'+__('Save')+'</button>' +
                '</form>'),

            status_template: _.template(
                '<div class="xmpp-status">' +
                    '<a class="choose-xmpp-status {{ chat_status }}" data-value="{{status_message}}" href="#" title="'+__('Click to change your chat status')+'">' +
                        '<span class="icon-{{ chat_status }}"></span>'+
                        '{{ status_message }}' +
                    '</a>' +
                    '<a class="change-xmpp-status-message icon-pencil" href="#" title="'+__('Click here to write a custom status message')+'"></a>' +
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
                var status_message = $(ev.target).find('input').val();
                if (status_message === "") {
                }
                this.model.setStatusMessage(status_message);
            },

            setStatus: function (ev) {
                ev.preventDefault();
                var $el = $(ev.target),
                    value = $el.attr('data-value');
                this.model.setStatus(value);
                this.$el.find(".dropdown dd ul").hide();
            },

            getPrettyStatus: function (stat) {
                if (stat === 'chat') {
                    pretty_status = __('online');
                } else if (stat === 'dnd') {
                    pretty_status = __('busy');
                } else if (stat === 'xa') {
                    pretty_status = __('away for long');
                } else if (stat === 'away') {
                    pretty_status = __('away');
                } else {
                    pretty_status = __(stat) || __('online'); // XXX: Is 'online' the right default choice here?
                }
                return pretty_status;
            },

            updateStatusUI: function (model) {
                if (!(_.has(model.changed, 'status')) && !(_.has(model.changed, 'status_message'))) {
                    return;
                }
                var stat = model.get('status');
                // # For translators: the %1$s part gets replaced with the status
                // # Example, I am online
                var status_message = model.get('status_message') || __("I am %1$s", this.getPrettyStatus(stat));
                this.$el.find('#fancy-xmpp-status-select').html(
                    this.status_template({
                        'chat_status': stat,
                        'status_message': status_message
                    }));
            },

            choose_template: _.template(
                '<dl id="target" class="dropdown">' +
                    '<dt id="fancy-xmpp-status-select" class="fancy-dropdown"></dt>' +
                    '<dd><ul class="xmpp-status-menu"></ul></dd>' +
                '</dl>'),

            option_template: _.template(
                '<li>' +
                    '<a href="#" class="{{ value }}" data-value="{{ value }}">'+
                        '<span class="icon-{{ value }}"></span>'+
                        '{{ text }}'+
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
                            'status_message': this.model.get('status_message') || __("I am %1$s", this.getPrettyStatus(chat_status)),
                            'chat_status': chat_status
                            }));
                // iterate through all the <option> elements and add option values
                options.each(function(){
                    options_list.push(that.option_template({'value': $(this).val(),
                                                            'text': this.text
                                                            }));
                });
                $options_target = this.$el.find("#target dd ul").hide();
                $options_target.append(options_list.join(''));
                $select.remove();
                return this;
            }
        });

        this.Feature = Backbone.Model.extend();
        this.Features = Backbone.Collection.extend({
            /* Service Discovery
            * -----------------
            * This collection stores Feature Models, representing features
            * provided by available XMPP entities (e.g. servers)
            * See XEP-0030 for more details: http://xmpp.org/extensions/xep-0030.html
            * All features are shown here: http://xmpp.org/registrar/disco-features.html
            */
            model: converse.Feature,
            initialize: function () {
                this.localStorage = new Backbone.LocalStorage(
                    hex_sha1('converse.features'+converse.bare_jid));
                if (this.localStorage.records.length === 0) {
                    // localStorage is empty, so we've likely never queried this
                    // domain for features yet
                    converse.connection.disco.info(converse.domain, null, $.proxy(this.onInfo, this));
                    converse.connection.disco.items(converse.domain, null, $.proxy(this.onItems, this));
                } else {
                    this.fetch({add:true});
                }
            },

            onItems: function (stanza) {
                $(stanza).find('query item').each($.proxy(function (idx, item) {
                    converse.connection.disco.info(
                        $(item).attr('jid'),
                        null,
                        $.proxy(this.onInfo, this));
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
            }
        });

        this.LoginPanel = Backbone.View.extend({
            tagName: 'div',
            id: "login-dialog",
            events: {
                'submit form#converse-login': 'authenticate'
            },
            tab_template: _.template(
                '<li><a class="current" href="#login">'+__('Sign in')+'</a></li>'),
            template: _.template(
                '<form id="converse-login">' +
                '<label>'+__('XMPP/Jabber Username:')+'</label>' +
                '<input type="text" id="jid">' +
                '<label>'+__('Password:')+'</label>' +
                '<input type="password" id="password">' +
                '<input class="login-submit" type="submit" value="'+__('Log In')+'">' +
                '</form">'),

            bosh_url_input: _.template(
                '<label>'+__('BOSH Service URL:')+'</label>' +
                '<input type="text" id="bosh_service_url">'),

            connect: function ($form, jid, password) {
                if ($form) {
                    $form.find('input[type=submit]').hide().after('<span class="spinner login-submit"/>');
                }
                converse.connection = new Strophe.Connection(converse.bosh_service_url);
                converse.connection.connect(jid, password, converse.onConnect);
            },

            showConnectButton: function () {
                var $form = this.$el.find('#converse-login');
                var $button = $form.find('input[type=submit]')
                if ($button.length) {
                    $button.show().siblings('span').remove();
                }
            },

            initialize: function (cfg) {
                cfg.$parent.append(this.$el.html(this.template()));
                this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                this.model.on('connection-fail', function () { this.showConnectButton(); }, this);
                this.model.on('auth-fail', function () { this.showConnectButton(); }, this);
            },

            render: function () {
                this.$tabs.append(this.tab_template());
                this.$el.find('input#jid').focus();
                return this;
            },

            authenticate: function (ev) {
                ev.preventDefault();
                var $form = $(ev.target),
                    $jid_input = $form.find('input#jid'),
                    jid = $jid_input.val(),
                    $pw_input = $form.find('input#password'),
                    password = $pw_input.val(),
                    $bsu_input = null,
                    errors = false;

                if (! converse.bosh_service_url) {
                    $bsu_input = $form.find('input#bosh_service_url');
                    converse.bosh_service_url = $bsu_input.val();
                    if (! converse.bosh_service_url)  {
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
                this.connect($form, jid, password);
            },

            remove: function () {
                this.$tabs.empty();
                this.$el.parent().empty();
            }
        });

        this.showControlBox = function () {
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
        };

        this.toggleControlBox = function () {
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

        this.initStatus = function (callback) {
            this.xmppstatus = new this.XMPPStatus();
            var id = hex_sha1('converse.xmppstatus-'+this.bare_jid);
            this.xmppstatus.id = id; // This appears to be necessary for backbone.localStorage
            this.xmppstatus.localStorage = new Backbone.LocalStorage(id);
            this.xmppstatus.fetch({success: callback, error: callback});
        };

        this.initRoster = function () {
            // Set up the roster
            this.roster = new this.RosterItems();
            this.roster.localStorage = new Backbone.LocalStorage(
                hex_sha1('converse.rosteritems-'+this.bare_jid));
            this.connection.roster.registerCallback(
                $.proxy(this.roster.rosterHandler, this.roster),
                null, 'presence', null);
            this.rosterview = new this.RosterView({'model':this.roster});
        }

        this.onConnected = function () {
            if (this.debug) {
                this.connection.xmlInput = function (body) { console.log(body); };
                this.connection.xmlOutput = function (body) { console.log(body); };
                Strophe.log = function (level, msg) { console.log(level+' '+msg); };
                Strophe.error = function (msg) { console.log('ERROR: '+msg); };
            }
            this.bare_jid = Strophe.getBareJidFromJid(this.connection.jid);
            this.domain = Strophe.getDomainFromJid(this.connection.jid);
            this.features = new this.Features();
            this.initStatus($.proxy(function () {
                this.initRoster();
                this.chatboxes.onConnected();
                this.connection.addHandler(
                    $.proxy(this.roster.subscribeToSuggestedItems, this.roster),
                    'http://jabber.org/protocol/rosterx', 'message', null);

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

                this.connection.roster.get(function () {});

                $(window).on("blur focus", $.proxy(function(e) {
                    if ((this.windowState != e.type) && (e.type == 'focus')) {
                        converse.clearMsgCounter();
                    }
                    this.windowState = e.type;
                },this));
                this.giveFeedback(__('Online Contacts'));
                if (this.testing) {
                    this.callback(this);
                } else  {
                    this.callback();
                }
            }, this));
        };

        // This is the end of the initialize method.
        this.chatboxes = new this.ChatBoxes();
        this.chatboxesview = new this.ChatBoxesView({model: this.chatboxes});
        $('.toggle-online-users').bind(
            'click',
            $.proxy(function (e) {
                e.preventDefault(); this.toggleControlBox();
            }, this)
        );
        if ((this.prebind) && (!this.connection)) {
            if ((!this.jid) || (!this.sid) || (!this.rid) || (!this.bosh_service_url)) {
                this.log('If you set prebind=true, you MUST supply JID, RID and SID values');
                return;
            }
            this.connection = new Strophe.Connection(this.bosh_service_url);
            this.connection.attach(this.jid, this.sid, this.rid, this.onConnect);
        } else if (this.connection) {
            this.onConnected();
        }
        if (this.show_controlbox_by_default) { this.showControlBox(); }
    };
    return {
        'initialize': function (settings, callback) {
            converse.initialize(settings, callback);
        }
    };
}));
