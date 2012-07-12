xmppchat.UI = (function (xmppUI, $, console) {
    var ob = xmppUI;
    ob.chats = [];
    ob.chat_focus  = [];

    ob.addUserToRosterUI = function (user_id, bare_jid, fullname, userstatus) {};

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

    ob.positionNewChat =  function ($chat) {};

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

    ob.insertClientStoredMessages = function ($chat, bare_jid, recipient_name) {};
    ob.createChatbox = function (bare_jid, callback) {};

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
        this.addChatToCookie(jid);
    };

    ob.getChatbox =  function (jid, callback) {};
    ob.reorderChats =  function () {};
    ob.addChatToCookie = function (jid) {};

    return ob;
})(xmppchat.UI || {}, jQuery, console || {log: function(){}} );


// Event handlers
// --------------
$(document).ready(function () {
    $(document).bind('xmppchat.send_presence', function (event, jid, type) {
        xmppchat.connection.send($pres({'type':type}));
    });

    $('ul.tabs').tabs('div.panes > div');

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

    $('select#select-xmpp-status').bind('change', function (ev) {
        var jid = xmppchat.connection.jid,
            value = ev.target.value;
        xmppchat.Presence.sendPresence(value);
        xmppchat.Storage.set(xmppchat.username+'-xmpp-status', value);
    });
});
