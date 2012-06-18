var xmppchat = (function ($, console) {
    var obj = {};
    obj.chats = [];
    obj.chat_focus  = [];

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

    obj.getMinimizedChats =  function () {
        var cookie = $.cookie('chats_minimized_'+xmppchat.username);
        if (cookie) {
            return cookie.split(/\|/);
        }
        return [];
    };

    obj.positionNewChat =  function (chatbox) {
        var open_chats = 0;
        for (var i=0; i<xmppchat.chats.length; i++) {
            if ($("#"+xmppchat.hash(xmppchat.chats[i])).css('display') != 'none') {
                open_chats++;
            }
        }
        if (open_chats === 0) {
            chatbox.css('right', '20px');
        } 
        else {
            width = (open_chats)*(225+7)+20;
            chatbox.css('right', width+'px');
        }
    };

    obj.handleChatEvents =  function (chat_id) {
        var chat_area = $("#"+xmppchat.hash(chat_id)+" .chat-textarea"),
            chat_type = chat_id.split('_')[0],
            that = this;

        that.chat_focus[chat_id] = false;
        chat_area.blur(function(){
            that.chat_focus[chat_id] = false;
            chat_area.removeClass('chat-textarea-'+chat_type+'-selected');
        }).focus(function(){
            that.chat_focus[chat_id] = true;
            chat_area.addClass('chat-textarea-'+chat_type+'-selected');
        });
        var chatbox = $("#"+xmppchat.hash(chat_id));
        chatbox.click(function() {
            if (chatbox.find('.chat-content').css('display') != 'none') {
                chatbox.find('.chat-textarea').focus();
            }
        });
    };

    obj.createChatBox =  function (chat_id, jid) {
        var path = xmppchat.sanitizePath('/@@render_chat_box');
        $.ajax({
            url: path,
            cache: false,
            async: false,
            data: {
                chat_id: chat_id,
                box_id: xmppchat.hash(chat_id),
                jid: jid,
                tzoffset: -(new Date().getTimezoneOffset())
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                console.log(textStatus);
                console.log(errorThrown);
                return;
            },
            success: function(data) {
                $('body').append(data).find('.chat-message .time').each(function (){
                    var jthis = $(this);
                    var time = jthis.text().split(':');
                    var hour = time[0];
                    var minutes = time[1];
                    var date = new Date();
                    date.setHours(hour - date.getTimezoneOffset() / 60);
                    date.setMinutes(minutes);
                    jthis.replaceWith(date.toLocaleTimeString().substring(0,5));
                });
                var last_msg_date = $('div#'+chat_id).attr('last_msg_date');
                if ((last_msg_date !== undefined)&&(last_msg_date > global_received_date)) {
                    global_received_date = last_msg_date;
                    sent_since_date = [];
                }
            }
        });
        return $('#'+xmppchat.hash(chat_id));
    };

    obj.createChat =  function (chat_id, minimize, jid) {
        var cookie = $.cookie('chats-open-'+this.username),
            chat_content, chatbox;

        this.addChatToCookie(chat_id);

        chatbox = $("#"+this.hash(chat_id));
        if (chatbox.length > 0) {
            // The chatbox exists, merely hidden
            if (chatbox.css('display') == 'none') {
                chatbox.css('display','block');
                this.reorderChats();
            }
            chatbox.find(".chat-textarea").focus();
            chat_content = chatbox.find('.chat-content');
            chat_content.scrollTop(chat_content[0].scrollHeight);
            return;
        }
        chatbox = this.createChatBox(chat_id, jid);
        if (chatbox.length === 0) {
            console.log('Could not create chatbox with id: ' + chat_id);
            return;
        }
        this.positionNewChat(chatbox);
        this.chats.push(chat_id);
        if (minimize == 1) {
            // Minimize the chat if it's in the minimized_chats cookie
            var minimized_chats = this.getMinimizedChats();
            if (chat_id in this.oc(minimized_chats)) {
                chatbox.find('.chat-content').css('display','none');
                chatbox.find('.chat-input').css('display','none');
            }
        }
        this.handleChatEvents(chat_id);
        chatbox.show();
        chat_content = chatbox.find('.chat-content');
        if (chat_content.length) {
            chat_content.scrollTop(chat_content[0].scrollHeight);
        }
        return chatbox;
    };

    obj.startChat =  function (chat_id, jid) {
        this.createChat(chat_id, 0, jid);
        $("#"+this.hash(chat_id)+" .chat-textarea").focus();
    };

    obj.reorderChats =  function () {
        var index = 0;
        for (var i=0; i < this.chats.length; i++) {
            var chatbox =  $("#"+this.hash(this.chats[i]));
            if (chatbox.css('display') != 'none') {
                if (index === 0) {
                    chatbox.css('right', '20px');
                } 
                else {
                    width = (index)*(225+7)+20;
                    chatbox.css('right', width+'px');
                }
                index++;
            }
        }
    };

    obj.addChatToCookie = function (chat_id) {
        var cookie = jQuery.cookie('chats-open-'+xmppchat.username),
            new_cookie,
            open_chats = [];

        if (cookie) {
            open_chats = cookie.split('|');
        }
        if (!(chat_id in this.oc(open_chats))) {
            // Update the cookie if this new chat is not yet in it.
            open_chats.push(chat_id);
            new_cookie = open_chats.join('|');
            jQuery.cookie('chats-open-'+xmppchat.username, new_cookie, {path: '/'});
            console.log('updated cookie = ' + new_cookie + '\n');
        }
        this.chats.push(chat_id);
    };

    obj.receiveMessage =  function (event) {
        var user_id = Strophe.getNodeFromJid(event.from),
            jid = Strophe.getBareJidFromJid(event.from),
            text = event.body.replace(/<br \/>/g, ""),
            that = this;

        jarnxmpp.Presence.getUserInfo(user_id, function (data) {
            var chat_id = 'chatbox_'+user_id;
            var chat = $('#'+that.hash(chat_id));
            if (chat.length <= 0) {
                chat = that.createChat(chat_id, 0, jid);
            }
            if (chat.css('display') == 'none') {
                chat.css('display','block');
                that.reorderChats();
            }
            var chat_content = chat.find(".chat-content");
            if (user_id == that.username) {
                message_html = '<div class="chat-message">' + 
                                    '<span class="chat-message-me">me:&nbsp;&nbsp;</span>' + 
                                    '<span class="chat-message-content">'+text+'</span>' + 
                                '</div>';
            } 
            else {
                message_html = '<div class="chat-message">' + 
                                    '<span class="chat-message-them">'+data.fullname+':&nbsp;&nbsp;</span>' + 
                                    '<span class="chat-message-content">'+text+'</span>' + 
                                '</div>';
            }
            chat_content.append(message_html);

            if (chat_content.css('display') == 'none') {
                // The chatbox is minimized, so we change it's header color to alert
                // the user.
                chat.find('.chat-head').addClass('chat-head-minimized-with-messages');
            }
            chat_content.scrollTop(chat_content[0].scrollHeight);

            jarnxmpp.UI.msg_counter += 1;
            jarnxmpp.UI.updateMsgCounter();
        });
    };

 
    obj.closeChat = function (chat_id, audience) {
        jQuery('#'+xmppchat.hash(chat_id)).css('display','none');
        xmppchat.reorderChats();
        var cookie = jQuery.cookie('chats-open-'+xmppchat.username),
            open_chats = [],
            new_chats = [];
        if (cookie) {
            open_chats = cookie.split('|');
        }
        for (var i=0; i < open_chats.length; i++) {
            if (open_chats[i] != chat_id) {
                new_chats.push(open_chats[i]);
            }
        }
        if (new_chats.length) {
            jQuery.cookie('chats-open-'+xmppchat.username, new_chats.join('|'), {path: '/'});
        }
        else {
            jQuery.cookie('chats-open-'+xmppchat.username, null, {path: '/'});
        }
        this.chats.pop(chat_id);
    };

    obj.toggleChat = function (chat_id) {
        var minimized_chats = xmppchat.getMinimizedChats();
        var hashed_id = xmppchat.hash(chat_id); 
        var new_cookie;
        if (jQuery('#'+hashed_id+' .chat-content').css('display') == 'none') {  
            // Chat will be maximized
            new_cookie = [];
            for (var i=0; i < minimized_chats.length; i++) {
                if (minimized_chats[i] != chat_id) {
                    new_cookie.push(minimized_chats[i]);
                }
            }
            jQuery.cookie('chats_minimized_'+xmppchat.username, new_cookie.join('|'));
            var chat_content = jQuery('#'+hashed_id+' .chat-content');
            chat_content.css('display','block');
            chat_content.scrollTop(chat_content[0].scrollHeight);
            jQuery('#'+hashed_id+' .chat-head').removeClass('chat-head-minimized-with-messages');
            jQuery('#'+hashed_id+' .chat-input').css('display','block');
        } 
        else {
            // Chat will be minimized
            if (!(chat_id in xmppchat.oc(minimized_chats))) {
                new_cookie = chat_id;
                new_cookie += '|'+minimized_chats.join('|');
                jQuery.cookie('chats_minimized_'+xmppchat.username, new_cookie);
            }
            jQuery('#'+hashed_id+' .chat-content').css('display','none');
            jQuery('#'+hashed_id+' .chat-input').css('display','none');
        }
    };

    obj.keyPressed = function (event, textarea, audience, hashed_id, chat_type) {
        if(event.keyCode == 13 && !event.shiftKey) {
            var textbox = jQuery(textarea);
            var message = textbox.val();
            var form = textbox.parent();
            form.submit();
            message = message.replace(/^\s+|\s+jQuery/g,"");
            textbox.val('').focus().css('height','44px');
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
                var chat_content = jQuery('#'+hashed_id+' .chat-content');
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

$(document).ready(function () {
    var chatdata = jQuery('span#babble-client-chatdata');
    var cookie = jQuery.cookie('chats-open-'+chatdata.attr('username'));
    var open_chats = [], chat_id;
    
    xmppchat.username = chatdata.attr('username');
    xmppchat.base_url = chatdata.attr('base_url');

    $.hook(['show', 'hide']);
    chat_id = 'online-users-container';
    $("div#"+chat_id)
        .bind('onaftershow', function (e) { 
            xmppchat.addChatToCookie(chat_id);
            xmppchat.chats.push(chat_id);
        });
    $('a.user-details-toggle').live('click', function (e) {
        var userid = $(this).parent().attr('data-userid'),
            $field = $('[name="message"]:input', $(this).parent()[0]),
            recipient = $field.attr('data-recipient');
        xmppchat.startChat('chatbox_'+userid, recipient);
        e.preventDefault();
    });

    /* 
    jQuery.cookie('chats-open-'+username, null, {path: '/'});
    if (cookie) {
        open_chats = cookie.split('|');
        for (var i=0; i<open_chats.length; i++) {
            chat_id = open_chats[i];
            if (chat_id) { 
                createChat(chat_id, 1);
            }
        }
    }
    */
});

