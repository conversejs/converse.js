xmppchat.UI = (function (xmppUI, $, console) {
    var ob = xmppUI;
    ob.chats = [];
    ob.chat_focus  = [];
    ob.chatbox_width = 205;

    ob.sanitizePath = function (call) { 
        return xmppchat.base_url + call; 
    };

    ob.addUserToRosterUI = function (user_id, bare_jid, fullname, userstatus) {
        if ($('#online-users-' + user_id).length > 0) { return; }
        var li = $('<li></li>').addClass(userstatus).attr('id', 'online-users-'+user_id).attr('data-recipient', bare_jid);
        li.append($('<a title="Click to chat with this contact"></a>').addClass('user-details-toggle').text(fullname));
        li.append($('<a title="Click to remove this contact" href="#"></a>').addClass('remove-xmpp-contact'));
        $('#xmpp-contacts').append(li);
    };

    ob.updateOnPresence = function (jid, status, presence) {
        var user_id = Strophe.getNodeFromJid(jid),
            bare_jid = Strophe.getBareJidFromJid(jid),
            resource, 
            online_count,
            $chat = $("#"+helpers.hash(bare_jid)),
            $chat_content,
            existing_user_element = $('#online-users-' + user_id);

        if (xmppchat.isOwnUser(jid)) { return; }

        if ($chat.length > 0) {
            $chat_content = $chat.find(".chat-content");
            $chat_content.find('div.chat-event').remove();
            if (status === 'offline') {
                xmppchat.Presence.getUserInfo(user_id, function (data) {
                    $chat_content.append($('<div></div>').addClass('chat-event').text(data.fullname + ' has gone offline.'));
                    $chat_content.scrollTop($content[0].scrollHeight);
                });
            } else if (status === 'unsubscribe') {
                xmppchat.Presence.getUserInfo(user_id, function (data) {
                    $chat_content.append($('<div></div>').addClass('chat-event').text(data.fullname + ' has removed you as a contact.'));
                    $chat_content.scrollTop($content[0].scrollHeight);
                });
                if (existing_user_element.length > 0) {
                    existing_user_element.remove();
                }
                $('#online-count').text(xmppchat.Presence.onlineCount());
                return;
            }
        }

        if (existing_user_element.length > 0) {
            existing_user_element.attr('class', status);
        } else if ((status !== 'offline') && (status !== 'unavailable')) {
            xmppchat.Presence.getUserInfo(user_id, function (data) {
                xmppchat.UI.addUserToRosterUI(user_id, bare_jid, data.fullname, status);
            });
        } else { // status is offline and the user isn't shown as online
            return;
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

        if (_.indexOf(this.chats, jid) == -1) {
            this.chats.push(jid);
        }
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
    };

    ob.addMessageToChatbox =  function (event) {
        /* XXX: event.mtype should be 'xhtml' for XHTML-IM messages, 
            but I only seem to get 'text'. 

            XXX: Some messages might be delayed, we must get the time from the event.
        */
        var user_id = Strophe.getNodeFromJid(event.from),
            jid = Strophe.getBareJidFromJid(event.from),
            that = this;

        xmppchat.Presence.getUserInfo(user_id, function (data) {
            that.getChatbox(jid, function (chat) {
                var chat_content = $(chat).find(".chat-content"),
                    now = new Date(),
                    time = now.toLocaleTimeString().substring(0,5),
                    div = $('<div></div>'),
                    composing = $(event.message).find('composing'),
                    text;

                if (event.body) {
                    text = event.body.replace(/<br \/>/g, "");
                    div.addClass('chat-message');

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
                    chat_content.find('div.chat-event').remove();
                    chat_content.append(message_html);
                    xmppchat.UI.msg_counter += 1;
                    xmppchat.UI.updateMsgCounter();

                } else if (composing.length > 0) {
                    message_html = div.addClass('chat-event').text(data.fullname + ' is typing...');
                    chat_content.find('div.chat-event').remove().end().append(message_html);
                }
                chat_content.scrollTop(chat_content[0].scrollHeight);
            });
        });
    };

    ob.keyPressed = function (ev, textarea) {
        var $textarea = jQuery(textarea),
            jid = $textarea.attr('data-recipient'), // FIXME: bare jid
            $chat = $textarea.parent().parent(),
            message,
            notify,
            composing;

        if(ev.keyCode == 13) {
            message = $textarea.val();
            message = message.replace(/^\s+|\s+jQuery/g,"");
            $textarea.val('').focus();
            if (message !== '') {
                xmppchat.Messages.sendMessage(jid, message, function () {
                    var time, 
                        minutes,
                        now,
                        $chat_content;

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
                    $chat_content = $chat.find('.chat-content');
                    $chat_content.append(
                        '<div class="chat-message">' + 
                            '<span class="chat-message-me">'+time+' me:&nbsp;&nbsp;</span>' + 
                            '<span class="chat-message-content">'+message+'</span>' + 
                        '</div>');
                    $chat_content.scrollTop($chat_content[0].scrollHeight);
                    $chat.data('composing', false);
                });
            }
        } else {
            composing = $chat.data('composing');
            if (!composing) {
                notify = $msg({'to':jid, 'type': 'chat'})
                                .c('composing', {'xmlns':'http://jabber.org/protocol/chatstates'});
                xmppchat.connection.send(notify);
                $chat.data('composing', true);
            }
        }
    };

    ob.setOwnStatus = function (el) {
        var jid = xmppchat.connection.jid,
            value = $(el).find('span').text();

        $(".dropdown dt a").html('I am ' + value);
        $(".dropdown dt a").attr('class', value);
        $(".dropdown dd ul").hide();
        $("#source").val($(el).find("span.value").html());

        xmppchat.Presence.sendPresence(value);
        xmppchat.Storage.set(xmppchat.username+'-xmpp-status', value);
    };

    ob.createStatusSelectWidget = function () {
        var select = $('select#select-xmpp-status'),
            selected = select.find('option[selected]'),
            chat_status = selected.val() || xmppchat.Presence.getOwnStatus() || 'online';
            options = $('option', select);

            // create <dl> and <dt> with selected value inside it
            select.parent().append('<dl id="target" class="dropdown"></dl>');

            $("#target").append('<dt id="fancy-xmpp-status-select"><a href="#" title="Click to change your chat status" class="' +
                chat_status+'">I am ' + chat_status + 
                '<span class="value">' + chat_status + '</span></a></dt>');

            $("#target").append('<dd><ul></ul></dd>');
            // iterate through all the <option> elements and create UL
            options.each(function(){
                $("#target dd ul").append('<li><a href="#" class="'+$(this).val()+'">' + 
                    $(this).text() + '<span class="value">' + 
                    $(this).val() + '</span></a></li>').hide();
            });
            select.remove();
    };

    return ob;
})(xmppchat.UI || {}, jQuery, console || {log: function(){}} );


// Event handlers
// --------------
$(document).ready(function () {
    xmppchat.UI.createStatusSelectWidget();

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

    $('textarea.chat-textarea').live('keypress', function (ev) {
        xmppchat.UI.keyPressed(ev, this);
    });

    $('ul.tabs').tabs('div.panes > div');

    $('#fancy-xmpp-status-select').click(function (ev) {
        ev.preventDefault();
        $(this).siblings('dd').find('ul').toggle('fast');
    });

    $('div.add-xmpp-contact').click(function (ev) {
        ev.preventDefault();
        $(this).parent().find('form.search-xmpp-contact').toggle().find('input.username').focus();
    });

    $('a.remove-xmpp-contact').live('click', function (ev) {
        var that = this;
        ev.preventDefault();
        $("<span></span>").dialog({
            title: 'Are you sure you want to remove this contact?',
            dialogClass: 'remove-xmpp-contact-dialog',
            resizable: false,
            width: 200,
            position: {
                my: 'center',
                at: 'center',
                of: '#online-users-container'
                },
            modal: true,
            buttons: {
                "Remove": function() {
                    $( this ).dialog( "close" );
                    var jid = $(that).parent().attr('data-recipient');
                    xmppchat.Roster.unsubscribe(jid);
                },
                "Cancel": function() {
                    $( this ).dialog( "close" );
                }
            }
        });
    });

    $('form.search-xmpp-contact').submit(function (ev) {
        ev.preventDefault();
        $.getJSON(portal_url + "/search-users?q=" + $(this).find('input.username').val(), function (data) {
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
                                    .attr('data-recipient', obj.id+'@'+xmppchat.connection.domain)
                                    .text(obj.fullname)
                            )
                    );
            });
        });
    });

    $("a.subscribe-to-user").live('click', function (ev) {
        ev.preventDefault();
        xmppchat.Roster.subscribe($(this).attr('data-recipient'));
        $(this).remove();
        $('form.search-xmpp-contact').hide();
    });

    $(".dropdown dd ul li a").click(function(ev) {
        ev.preventDefault();
        xmppchat.UI.setOwnStatus(this);
    });

    $('select#select-xmpp-status').bind('change', function (ev) {
        var jid = xmppchat.connection.jid,
            value = ev.target.value;
        xmppchat.Presence.sendPresence(value);
        xmppchat.Storage.set(xmppchat.username+'-xmpp-status', value);
    });
});
