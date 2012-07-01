xmppchat.UI = (function (xmppUI, $, console) {
    var ob = xmppUI;
    ob.chats = [];
    ob.chat_focus  = [];
    ob.chatbox_width = 205;

    ob.sanitizePath = function (call) { 
        return xmppchat.base_url + call; 
    };

    ob.updateOnPresence = function (jid, status, presence) {
        var user_id = Strophe.getNodeFromJid(jid),
            bare_jid = Strophe.getBareJidFromJid(jid),
            resource, existing_user_element, online_count;

        if (xmppchat.isOwnUser(jid)) { return; }

        existing_user_element = $('#online-users-' + user_id);
        if ((status === 'offline') || (status === 'unavailable')) {
            // Remove the resource.
            bare_jid = Strophe.getBareJidFromJid(jid);
            resource = Strophe.getResourceFromJid(jid);
            if (xmppchat.ChatPartners.remove(bare_jid, resource) === 0) {
                // Only set the status offline if there aren't any other resources for that user
                if (existing_user_element.length > 0) {
                    existing_user_element.attr('class', status);
                }
                return;
            }
        } else {
            if (existing_user_element.length > 0) {
                existing_user_element.attr('class', status);
            } else {
                xmppchat.Presence.getUserInfo(user_id, function (data) {
                    if ($('#online-users-' + user_id).length > 0) { return; }
                    var li = $('<li></li>').attr('id', 'online-users-'+user_id).attr('data-recipient', bare_jid);
                    li.append($('<a></a>').addClass('user-details-toggle').text(data.fullname));
                    $('#online-users').append(li);
                });
            }
        }
        $('#online-count').text(xmppchat.Presence.onlineCount());
    };

    ob.positionNewChat =  function ($chat) {
        var open_chats = 0,
            offset;
        for (var i=0; i<this.chats.length; i++) {
            if ($("#"+helpers.hash(this.chats[i])).is(':visible')) {
                open_chats++;
            }
        }
        if (open_chats === 0) {
            $chat.animate({'right':'15px'});
        } 
        else {
            offset = (open_chats)*(this.chatbox_width+7)+15;
            $chat.animate({'right': (offset+'px')});
        }
    };

    ob.handleChatEvents =  function (chat_id) {
        var chat_area = $("#"+chat_id+" .chat-textarea"),
            chat_type = chat_id.split('_')[0],
            that = this;

        that.chat_focus[chat_id] = false;
        chat_area.blur(function () {
            that.chat_focus[chat_id] = false;
            chat_area.removeClass('chat-textarea-'+chat_type+'-selected');
        }).focus(function (){
            that.chat_focus[chat_id] = true;
            chat_area.addClass('chat-textarea-'+chat_type+'-selected');
        });
        var chatbox = $("#"+chat_id);
        chatbox.click(function () {
            if (chatbox.find('.chat-content').is(':visible')) {
                chatbox.find('.chat-textarea').focus();
            }
        });
    };

    ob.renderChatbox = function (bare_jid, callback) {
    };

    ob.insertCollectionMessages = function ($chat, bare_jid, recipient_name) {
        xmppchat.Collections.getLastMessages(bare_jid, function (result) {
            $('body').append($chat);
            $(result).find('chat').children().each(function (idx, el) {
                if (el.tagName !== 'set') {
                    // TODO: Calculate the time. We have the start time and the offset for each message...
                    var text = $(el).find('body').text(),
                        now = new Date(),
                        time = now.toLocaleTimeString().substring(0,5),
                        $content = $chat.find('.chat-content');
                        div = $('<div class="chat-message delayed"></div>');

                    if (el.tagName == 'to') {
                        message_html = div.append( 
                                            '<span class="chat-message-me">'+time+' me:&nbsp;&nbsp;</span>' + 
                                            '<span class="chat-message-content">'+text+'</span>'
                                            );
                    } else {
                        message_html = div.append( 
                                            '<span class="chat-message-them">'+time+' '+recipient_name+':&nbsp;&nbsp;</span>' + 
                                            '<span class="chat-message-content">'+text+'</span>'
                                            );
                    }
                    $content.append(message_html);
                    $content.scrollTop($content[0].scrollHeight);
                }
            });
            callback($chat);
        });
    };

    ob.insertClientStoredMessages = function ($chat, bare_jid, recipient_name) {
        xmppchat.Messages.getMessages(bare_jid, function (msgs) {
            $(msgs).each(function (idx, msg) {
                var msg_array = msg.split(' ', 2),
                    date = msg_array[0],
                    time = new Date(Date.parse(date)).toLocaleTimeString().substring(0,5),
                    direction = msg_array[1],
                    text = String(msg).replace(/(.*?\s.*?\s)/, '');
                    $content = $chat.find('.chat-content');
                    div = $('<div class="chat-message delayed"></div>');

                if (direction == 'to') {
                    message_html = div.append( 
                                        '<span class="chat-message-me">'+time+' me:&nbsp;&nbsp;</span>' + 
                                        '<span class="chat-message-content">'+text+'</span>'
                                        );
                } else {
                    message_html = div.append( 
                                        '<span class="chat-message-them">'+time+' '+recipient_name+':&nbsp;&nbsp;</span>' + 
                                        '<span class="chat-message-content">'+text+'</span>'
                                        );
                }
                $content.append(message_html);
                $content.scrollTop($content[0].scrollHeight);
            });
        });
    };

    ob.createChatbox = function (bare_jid, callback) {
        var user_id = Strophe.getNodeFromJid(bare_jid),
            that = this;
        xmppchat.Presence.getUserInfo(user_id, function (data) {
            var chat_id = helpers.hash(bare_jid);
            var $chat = $('<div class="chatbox"></div>').attr('id', chat_id).hide();
            var $head = $('<div class="chat-head chat-head-chatbox"></div>')
                    .append($('<div class="chat-title"></div>').text(data.fullname))
                    .append($('<a href="javascript:void(0)" class="chatbox-button close-chatbox-button">X</a>')
                        .attr('data-recipient', bare_jid))
                    .append('<br clear="all"/>'); 
            var $content = $('<div class="chat-content"></div>');
            var $form = $('<form class="sendXMPPMessage" action="" method="post">')
                        .append(
                            $('<textarea type="text" ' +
                                'name="message" '+
                                'class="chat-textarea" ' +
                                'placeholder="Personal message"/>').attr('data-recipient', bare_jid));
            $chat.append($head).append($content).append($form);
            $('body').append($chat);
            callback($chat);
        });
    };
    /*
    $chat.find('.chat-message .time').each(function () {
        var jthis = $(this);
        var time = jthis.text().split(':');
        var hour = time[0];
        var minutes = time[1];
        var date = new Date();
        date.setHours(hour - date.getTimezoneOffset() / 60);
        date.setMinutes(minutes);
        jthis.replaceWith(date.toLocaleTimeString().substring(0,5));
    });
    */

    ob.prepNewChat = function (chat, jid) {
        // Some operations that need to be applied on a chatbox
        // after it has been created.
        var chat_content,
            value;
        if (jid === 'online-users-container') {
            // Make sure the xmpp status is correctly set on the control box
            value = xmppchat.Storage.get(xmppchat.username+'-xmpp-status') || 'online';
            $(chat).find('#select-xmpp-status').val(value);
        } else {
            chat_content = $(chat).find('.chat-content');
            $(chat).find(".chat-textarea").focus();
            if (chat_content.length > 0) {
                chat_content.scrollTop(chat_content[0].scrollHeight);
            }
        }

        if (!(jid in helpers.oc(this.chats))) {
            this.chats.push(jid);
        }
        this.addChatToCookie(jid);
    };

    ob.getChatbox =  function (jid, callback) {
        // Get a chatbox. Either it exists, then just ensure 
        // that it's visible and return it. Otherwise, create it.
        //
        // This method can be deferred.
        // http://www.erichynds.com/jquery/using-deferreds-in-jquery/
        var bare_jid = Strophe.getBareJidFromJid(jid),
            chat_content, 
            chat_id = helpers.hash(bare_jid),
            $chat = $("#"+chat_id),
            that = this,
            dfd = $.Deferred();

        if (callback === undefined) {
            callback = function () {};
        }
        if ($chat.length > 0) {
            if ($chat.is(':visible')) {
                callback($chat);
                dfd.resolve();
            } else {
                // The chatbox exists, merely hidden
                $chat.show('fast', function () {
                    that.prepNewChat(this, bare_jid);
                    that.reorderChats();
                    callback(this);
                    dfd.resolve();
                });
            }
        } else {
             this.createChatbox(bare_jid, function ($chat) {
                // that.retrieveCollections();
                that.positionNewChat($chat);
                $chat.show('fast', function () {
                    that.prepNewChat(this, bare_jid);
                    that.handleChatEvents(chat_id);
                    callback(this);
                    dfd.resolve();
                    // FIXME: We need to check here whether local or remote storage
                    // must be used. For now we just use local storage.
                    // ob.insertCollectionMessages
                    that.insertClientStoredMessages($chat, bare_jid, $chat.find('.chat-title').text());
                });
            });
        }
        return dfd.promise();
    };

    ob.reorderChats =  function () {
        var index = 0,
            chat_id,
            offset,
            $chat;

        if ('online-users-container' in helpers.oc(this.chats)) {
            index = 1;
            $chat = $("#"+helpers.hash(helpers.oc(this.chats)['online-users-container']));
            if ($chat.is(':visible')) {
                $chat.animate({'right': '15px'});
            }
        }

        for (var i=0; i < this.chats.length; i++) {
            chat_id = this.chats[i];
            if (chat_id === 'online-users-container') {
                continue;
            }
            $chat = $("#"+helpers.hash(this.chats[i]));
            if ($chat.is(':visible')) {
                if (index === 0) {
                    $chat.animate({'right': '15px'});
                } 
                else {
                    offset = (index)*(this.chatbox_width+7)+15;
                    $chat.animate({'right': offset +'px'});
                }
                index++;
            }
        }
    };

    ob.addChatToCookie = function (jid) {
        var cookie = jQuery.cookie('chats-open-'+xmppchat.username),
            new_cookie,
            open_chats = [];

        if (cookie) {
            open_chats = cookie.split('|');
        }
        if (!(jid in helpers.oc(open_chats))) {
            // Update the cookie if this new chat is not yet in it.
            open_chats.push(jid);
            new_cookie = open_chats.join('|');
            jQuery.cookie('chats-open-'+xmppchat.username, new_cookie, {path: '/'});
            console.log('updated cookie = ' + new_cookie + '\n');
        }
    };

    ob.removeChatFromCookie = function (jid) {
        var cookie = jQuery.cookie('chats-open-'+xmppchat.username),
            open_chats = [],
            new_chats = [];

        if (cookie) {
            open_chats = cookie.split('|');
        }
        for (var i=0; i < open_chats.length; i++) {
            if (open_chats[i] != jid) {
                new_chats.push(open_chats[i]);
            }
        }
        if (new_chats.length) {
            jQuery.cookie('chats-open-'+xmppchat.username, new_chats.join('|'), {path: '/'});
        }
        else {
            jQuery.cookie('chats-open-'+xmppchat.username, null, {path: '/'});
        }
    };

    ob.addMessageToChatbox =  function (event) {
        /* XXX: event.mtype should be 'xhtml' for XHTML-IM messages, 
            but I only seem to get 'text'. 

            XXX: Some messages might be delayed, we must get the time from the event.
        */
        var user_id = Strophe.getNodeFromJid(event.from),
            jid = Strophe.getBareJidFromJid(event.from),
            text = event.body.replace(/<br \/>/g, ""),
            that = this;

        xmppchat.Presence.getUserInfo(user_id, function (data) {
            that.getChatbox(jid, function (chat) {
                var chat_content = $(chat).find(".chat-content"),
                    now = new Date(),
                    time = now.toLocaleTimeString().substring(0,5),
                    div = $('<div class="chat-message"></div>');

                if (event.delayed) {
                    div.addClass('delayed');
                }
                if (user_id == that.username) {
                    message_html = div.append( 
                                        '<span class="chat-message-me">'+time+' me:&nbsp;&nbsp;</span>' + 
                                        '<span class="chat-message-content">'+text+'</span>'
                                        );
                } else {
                    message_html = div.append( 
                                        '<span class="chat-message-them">'+time+' '+data.fullname+':&nbsp;&nbsp;</span>' + 
                                        '<span class="chat-message-content">'+text+'</span>'
                                        );
                }
                chat_content.append(message_html);
                chat_content.scrollTop(chat_content[0].scrollHeight);
                xmppchat.UI.msg_counter += 1;
                xmppchat.UI.updateMsgCounter();
            });
        });
    };

    ob.closeChat = function (jid) {
        var chat_id = helpers.hash(jid),
            that = this;
        jQuery('#'+chat_id).hide('fast', function () {
            var idx = that.chats.indexOf(jid);
            if (idx !== undefined) {
                that.chats.splice(idx, 1);
            }
            that.removeChatFromCookie(jid);
            that.reorderChats();
        });
    };

    ob.restoreOpenChats = function () {
        /* Check the open-chats cookie and re-open all the chatboxes it mentions.
         * We need to wait for current chatbox creation to finish before we create the
         * next, so we use a task buffer to make sure the next task is only
         * executed after the previous is done.
        */
        var cookie = jQuery.cookie('chats-open-'+xmppchat.username),
            open_chats = [];

        jQuery.cookie('chats-open-'+xmppchat.username, null, {path: '/'});
        if (cookie) {
            open_chats = cookie.split('|');
            // FIXME: Change this so that the online contacts box is always created first.
            for (var i=0; i<open_chats.length; i++) {
                xmppchat.Taskbuffer.tasks.push({'that': this, 'method':this.getChatbox, 'parameters':[open_chats[i]]});
            }
            xmppchat.Taskbuffer.handleTasks();
        }
    };

    ob.keyPressed = function (ev, textarea) {
        if(ev.keyCode == 13 && !ev.shiftKey) {
            var $textarea = jQuery(textarea),
                message = $textarea.val(),
                jid = $textarea.attr('data-recipient'),
                form = $textarea.parent(),
                now, 
                minutes, 
                time, 
                chat_content;

            message = message.replace(/^\s+|\s+jQuery/g,"");
            $textarea.val('').focus();
            if (message !== '') {
                xmppchat.Messages.sendMessage(jid, message, function () {

                    message = message.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
                    list = message.match(/\b(http:\/\/www\.\S+\.\w+|www\.\S+\.\w+|http:\/\/(?=[^w]){3}\S+[\.:]\S+)[^ ]+\b/g);
                    if (list) {
                        for (i = 0; i < list.length; i++) {
                            message = message.replace( list[i], "<a target='_blank' href='" + escape( list[i] ) + "'>"+ list[i] + "</a>" );
                        }
                    }
                    now = new Date();
                    minutes = now.getMinutes().toString();
                    if (minutes.length==1) {minutes = '0'+minutes;}
                    time = now.toLocaleTimeString().substring(0,5);
                    chat_content = jQuery('#'+helpers.hash(jid)+' .chat-content');
                    chat_content.append(
                        '<div class="chat-message">' + 
                            '<span class="chat-message-me">'+time+' me:&nbsp;&nbsp;</span>' + 
                            '<span class="chat-message-content">'+message+'</span>' + 
                        '</div>');
                    chat_content.scrollTop(chat_content[0].scrollHeight);
                });
            }
        }
    };
    return ob;
})(xmppchat.UI || {}, jQuery, console || {log: function(){}} );


// Event handlers
// --------------
$(document).ready(function () {
    var chatdata = jQuery('span#babble-client-chatdata'),
        $toggle = $('a#toggle-online-users');

    xmppchat.username = chatdata.attr('username');
    xmppchat.base_url = chatdata.attr('base_url');

    $toggle.unbind('click');
    $toggle.bind('click', function (e) {
        e.preventDefault();
        if ($("div#online-users-container").is(':visible')) {
            xmppchat.UI.closeChat('online-users-container');
        } else {
            xmppchat.UI.getChatbox('online-users-container');
        }
    });

    $(document).unbind('jarnxmpp.message');
    $(document).bind('jarnxmpp.message',  function (event) {
        xmppchat.UI.addMessageToChatbox(event);
    });

    $(document).bind('xmppchat.send_presence', function (event, jid, type) {
        xmppchat.connection.send($pres({'type':type}));
    });

    $(document).unbind('jarnxmpp.presence');
    $(document).bind('jarnxmpp.presence', function (event, jid, status, presence) {
        xmppchat.UI.updateOnPresence(jid, status, presence);
    });


    $(document).unbind('jarnxmpp.connected');
    $(document).bind('jarnxmpp.connected', function () {
        // Logging
        xmppchat.connection.rawInput = xmppchat.rawInput;
        xmppchat.connection.rawOutput = xmppchat.rawOutput;
        // Messages
        xmppchat.connection.addHandler(xmppchat.Messages.messageReceived, null, 'message', 'chat');
        //Roster
        xmppchat.connection.addHandler(xmppchat.Roster.rosterResult, Strophe.NS.ROSTER, 'iq', 'result');
        xmppchat.connection.addHandler(xmppchat.Roster.rosterSuggestedItem, 'http://jabber.org/protocol/rosterx', 'message', null);
        // Presence
        xmppchat.connection.addHandler(xmppchat.Presence.presenceReceived, null, 'presence', null);

        xmppchat.UI.restoreOpenChats();
        xmppchat.Presence.sendPresence();
    });

    $('a.user-details-toggle').live('click', function (e) {
        e.preventDefault();
        xmppchat.UI.getChatbox($(this).parent().attr('data-recipient'));
    });

    $('textarea.chat-textarea').live('keypress', function (ev) {
        xmppchat.UI.keyPressed(ev, this);
    });

    $('a.close-chatbox-button').live('click', function (ev) {
        var jid = $(ev.target).attr('data-recipient');
        xmppchat.UI.closeChat(jid);
    }); 

    $('ul.tabs').tabs('div.panes > div');
    $('select#select-xmpp-status').bind('change', function (ev) {
        var jid = xmppchat.connection.jid,
            value = ev.target.value;

        xmppchat.Presence.sendPresence(value);
        xmppchat.Storage.set(xmppchat.username+'-xmpp-status', value);
    });
});
