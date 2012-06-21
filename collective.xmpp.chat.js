var xmppchat = (function ($, console) {
    var obj = {};
    obj.chats = [];
    obj.chat_focus  = [];
    obj.chatbox_width = 205;

    obj.sanitizePath = function (call) { 
        return xmppchat.base_url + call; 
    };

    obj.hash =function (str) {
        // FIXME
        if (str == 'online-users-container') {
            return str;
        }
        var shaobj = new jsSHA(str);
        return shaobj.getHash("HEX");
    };

    obj.oc =  function (a) {
        // Thanks to Jonathan Snook: http://snook.ca
        var o = {};
        for(var i=0; i<a.length; i++) {
            o[a[i]]='';
        }
        return o;
    };

    obj.positionNewChat =  function ($chat) {
        var open_chats = 0,
            offset;
        for (var i=0; i<xmppchat.chats.length; i++) {
            if ($("#"+xmppchat.hash(xmppchat.chats[i])).is(':visible')) {
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

    obj.handleChatEvents =  function (chat_id) {
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

    obj.handleError = function (response) {
        console.log(response);
    };

    obj.handleCollectionRetrieval = function (response) {
        // Get the last collection.
        return false; 
    };

    obj.retrieveCollections = function () {
        /*
        * FIXME: XEP-0136 specifies 'urn:xmpp:archive' but the mod_archive_odbc 
        * add-on for ejabberd wants the URL below. This might break for other
        * Jabber servers.
        */
        var uri = 'http://www.xmpp.org/extensions/xep-0136.html#ns';
        var iq = $iq({'type':'get'})
                    .c('list', {'start': '1469-07-21T02:00:00Z',
                                'xmlns': uri
                                })
                    .c('set', {'xmlns': 'http://jabber.org/protocol/rsm'})
                    .c('max')
                    .t('30');
        jarnxmpp.connection.sendIQ(iq, this.handleCollectionRetrieval, this.handleError);
    };

    obj.createChatbox = function (jid, callback) {
        var path = xmppchat.sanitizePath('/@@render_chat_box'),
            chat_id = this.hash(jid),
            that = this;

        $.ajax({
            url: path,
            cache: false,
            async: false,
            data: {
                chat_id: 'chatbox_'+jid,
                box_id: chat_id,
                jid: jid,
                tzoffset: -(new Date().getTimezoneOffset())
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                console.log(textStatus);
                console.log(errorThrown);
                return;
            },
            success: function(data) {
                var chat_id = $(data).attr('id');
                var $chat = $('body').append(data).find('#'+chat_id);
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
                callback($chat);
            }
        });
    };

    obj.prepNewChat = function (chat, jid) {
        // Some operations that need to be applied on a chatbox
        // after it has been created.
        var chat_content,
            value;
        if (jid === 'online-users-container') {
            value = jarnxmpp.Storage.get(xmppchat.username+'-xmpp-status') || 'online';
            $(chat).find('#select-xmpp-status').val(value);
        } else {
            chat_content = $(chat).find('.chat-content');
            $(chat).find(".chat-textarea").focus();
            if (chat_content.length > 0) {
                chat_content.scrollTop(chat_content[0].scrollHeight);
            }
        }

        if (!(jid in this.oc(this.chats))) {
            this.chats.push(jid);
        }
        this.addChatToCookie(jid);
    };

    obj.getChatbox =  function (jid, callback) {
        // Get a chatbox. Either it exists, then just ensure 
        // that it's visible and return it. Otherwise, create it.
        //
        // This method can be deferred.
        // http://www.erichynds.com/jquery/using-deferreds-in-jquery/
        var chat_content, 
            chat_id = this.hash(jid),
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
                    that.prepNewChat(this, jid);
                    that.reorderChats();
                    callback(this);
                    dfd.resolve();
                });
            }
        } else {
             this.createChatbox(jid, function ($chat) {
                // that.retrieveCollections();
                that.positionNewChat($chat);
                $chat.show('fast', function () {
                    that.prepNewChat(this, jid);
                    that.handleChatEvents(chat_id);
                    callback(this);
                    dfd.resolve();
                });
            });
        }
        return dfd.promise();
    };

    obj.reorderChats =  function () {
        var index = 0,
            chat_id,
            offset,
            $chat;

        if ('online-users-container' in this.oc(this.chats)) {
            index = 1;
            $chat = $("#"+this.hash(this.oc(this.chats)['online-users-container']));
            if ($chat.is(':visible')) {
                $chat.animate({'right': '15px'});
            }
        }

        for (var i=0; i < this.chats.length; i++) {
            chat_id = this.chats[i];
            if (chat_id === 'online-users-container') {
                continue;
            }
            $chat = $("#"+this.hash(this.chats[i]));
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

    obj.addChatToCookie = function (jid) {
        var cookie = jQuery.cookie('chats-open-'+xmppchat.username),
            new_cookie,
            open_chats = [];

        if (cookie) {
            open_chats = cookie.split('|');
        }
        if (!(jid in this.oc(open_chats))) {
            // Update the cookie if this new chat is not yet in it.
            open_chats.push(jid);
            new_cookie = open_chats.join('|');
            jQuery.cookie('chats-open-'+xmppchat.username, new_cookie, {path: '/'});
            console.log('updated cookie = ' + new_cookie + '\n');
        }
    };

    obj.removeChatFromCookie = function (jid) {
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

    obj.receiveMessage =  function (event) {
        /* XXX: event.mtype should be 'xhtml' for XHTML-IM messages, 
            but I only seem to get 'text'. 

            XXX: Some messages might be delayed, we must get the time from the event.
        */
        var user_id = Strophe.getNodeFromJid(event.from),
            jid = Strophe.getBareJidFromJid(event.from),
            text = event.body.replace(/<br \/>/g, ""),
            that = this;

        jarnxmpp.Presence.getUserInfo(user_id, function (data) {
            that.getChatbox(jid, function ($chat) {
                var chat_content = $chat.find(".chat-content"),
                    now = new Date(),
                    time = now.toLocaleTimeString().substring(0,5);

                if (user_id == that.username) {
                    message_html = '<div class="chat-message">' + 
                                        '<span class="chat-message-me">'+time+' me:&nbsp;&nbsp;</span>' + 
                                        '<span class="chat-message-content">'+text+'</span>' + 
                                    '</div>';
                } else {
                    message_html = '<div class="chat-message">' + 
                                        '<span class="chat-message-them">'+time+' '+data.fullname+':&nbsp;&nbsp;</span>' + 
                                        '<span class="chat-message-content">'+text+'</span>' + 
                                    '</div>';
                }
                chat_content.append(message_html);
                chat_content.scrollTop(chat_content[0].scrollHeight);
                jarnxmpp.UI.msg_counter += 1;
                jarnxmpp.UI.updateMsgCounter();
            });
        });
    };

    obj.closeChat = function (jid) {
        var chat_id = this.hash(jid),
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

    obj.keyPressed = function (event, textarea, audience, chat_id, chat_type) {
        if(event.keyCode == 13 && !event.shiftKey) {
            var textbox = jQuery(textarea);
            var message = textbox.val();
            var form = textbox.parent();
            form.submit();
            message = message.replace(/^\s+|\s+jQuery/g,"");
            textbox.val('').focus();
            if (message !== '') {
                message = message.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
                list = message.match(/\b(http:\/\/www\.\S+\.\w+|www\.\S+\.\w+|http:\/\/(?=[^w]){3}\S+[\.:]\S+)[^ ]+\b/g);
                if (list) {
                    for (i = 0; i < list.length; i++) {
                        message = message.replace( list[i], "<a target='_blank' href='" + escape( list[i] ) + "'>"+ list[i] + "</a>" );
                    }
                }
                var now = new Date();
                var minutes = now.getMinutes().toString();
                if (minutes.length==1) {minutes = '0'+minutes;}
                var time = now.toLocaleTimeString().substring(0,5);
                var chat_content = jQuery('#'+chat_id+' .chat-content');
                chat_content.append(
                    '<div class="chat-message">' + 
                        '<span class="chat-message-me">'+time+' me:&nbsp;&nbsp;</span>' + 
                        '<span class="chat-message-content">'+message+'</span>' + 
                    '</div>');
                chat_content.scrollTop(chat_content[0].scrollHeight);
            }
        }
        var adjustedHeight = textarea.clientHeight;
        var maxHeight = 94;
        if (maxHeight > adjustedHeight) {
            adjustedHeight = Math.max(textarea.scrollHeight, adjustedHeight);
            if (maxHeight) {
                adjustedHeight = Math.min(maxHeight, adjustedHeight);
            }
            if (adjustedHeight > textarea.clientHeight) {
                jQuery(textarea).css('height',adjustedHeight+8 +'px');
            }
        } 
        else {
            jQuery(textarea).css('overflow','auto');
        }
    };
    return obj;
})(jQuery, console || {log: function(){}} );

$(document).unbind('jarnxmpp.message');
$(document).bind('jarnxmpp.message',  function (event) {
    xmppchat.receiveMessage(event);
});

$(document).bind('xmppchat.send_presence', function (event, jid, type) {
    jarnxmpp.connection.send($pres({'type':type}));
});

xmppchat.taskbuffer = (function ($) {
    obj = {};
    obj.tasks = [];
    obj.deferred = $.when();
    obj.handleTasks = function () {
        var task;
        // If the current deferred task is resolved and there are more tasks
        if (obj.deferred.isResolved() && obj.tasks.length > 0) {
            // Get the next task in the queue and set the new deferred.
            task = obj.tasks.shift();

            obj.deferred = $.when(task.method.apply(xmppchat, task.parameters));

            if (obj.tasks.length > 0) {
                obj.deferred.done(obj.handleTasks);
            }
        }
    };
    return obj;
})(jQuery);

$(document).bind('jarnxmpp.connected', function() {
    var chatdata = jQuery('span#babble-client-chatdata'),
        cookie = jQuery.cookie('chats-open-'+chatdata.attr('username')),
        open_chats = [], chat_id;

    // Perhaps this should be moved to $(document).ready ?
    xmppchat.username = chatdata.attr('username');
    xmppchat.base_url = chatdata.attr('base_url');

    jQuery.cookie('chats-open-'+xmppchat.username, null, {path: '/'});
    if (cookie) {
        // We need to wait for chatbox creation to finish before we create the
        // next, so we use a task buffer to make sure the next task is only
        // executed after the previous is done.
        // FIXME: Change this so that the online contacts box is always created first.
        open_chats = cookie.split('|');
        for (var i=0; i<open_chats.length; i++) {
            xmppchat.taskbuffer.tasks.push({'method':xmppchat.getChatbox, 'parameters':[open_chats[i]]});
        }
        xmppchat.taskbuffer.handleTasks();
    }
});

$(document).ready(function () {
    var $toggle = $('a#toggle-online-users');
    $toggle.unbind('click');
    $toggle.bind('click', function (e) {
        e.preventDefault();
        if ($("div#online-users-container").is(':visible')) {
            xmppchat.closeChat('online-users-container');
        } else {
            xmppchat.getChatbox('online-users-container');
        }
    });

    $('a.user-details-toggle').live('click', function (e) {
        var $field = $('[name="message"]:input', $(this).parent()[0]),
            jid = $field.attr('data-recipient');
        e.preventDefault();
        xmppchat.getChatbox(jid);
    });

    $('ul.tabs').tabs('div.panes > div');
    $('select#select-xmpp-status').bind('change', function (event) {
        var jid = jarnxmpp.connection.jid,
            value = event.target.value;

        $(document).trigger('xmppchat.send_presence', [jid, value]);
        jarnxmpp.Storage.set(xmppchat.username+'-xmpp-status', value);
    });
});
