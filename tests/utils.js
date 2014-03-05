(function (root, factory) {
    define("utils", [
        'jquery',
        'mock'
    ],
        function($, mock) {
            return factory($, mock);
        });
}(this, function ($, mock) {
    var utils = {};
    
    utils.closeAllChatBoxes = function () {
        var i, chatbox;
        for (i=converse.chatboxes.models.length-1; i>-1; i--) {
            chatbox = converse.chatboxes.models[i];
            converse.chatboxesview.views[chatbox.get('id')].closeChat();
        }
        return this;
    };

    utils.removeAllChatBoxes = function () {
        var i, chatbox, num_chatboxes = converse.chatboxes.models.length;
        for (i=num_chatboxes-1; i>-1; i--) {
            chatbox = converse.chatboxes.models[i];
            converse.chatboxesview.views[chatbox.get('id')].closeChat();
            converse.chatboxesview.views[chatbox.get('id')].$el.remove();
        }
        converse.chatboxesview.views.controlbox.closeChat();
        converse.chatboxesview.views.controlbox.$el.remove();
        return this;
    };

    utils.initConverse = function () {
        converse.chatboxes = new converse.ChatBoxes();
        converse.chatboxesview = new converse.ChatBoxesView({model: converse.chatboxes});
        converse.onConnected();
    };

    utils.initRoster = function () {
        converse.roster.localStorage._clear();
        converse.initRoster();
    };

    utils.openControlBox = function () {
        if (!$("#controlbox").is(':visible')) {
            $('.toggle-online-users').click();
        }
        return this;
    };

    utils.closeControlBox = function () {
        if ($("#controlbox").is(':visible')) {
            $('.toggle-online-users').click();
        }
        return this;
    };

    utils.removeControlBox = function () {
        $('#controlbox').remove();
    };

    utils.openContactsPanel = function () {
        var cbview = converse.chatboxesview.views.controlbox;
        var $tabs = cbview.$el.find('#controlbox-tabs');
        $tabs.find('li').first().find('a').click();
    };

    utils.openRoomsPanel = function () {
        var cbview = converse.chatboxesview.views.controlbox;
        var $tabs = cbview.$el.find('#controlbox-tabs');
        $tabs.find('li').last().find('a').click();
    };

    utils.openChatBoxes = function (amount) {
        var i = 0, jid;
        for (i; i<amount; i++) {
            jid = mock.cur_names[i].replace(' ','.').toLowerCase() + '@localhost';
            converse.rosterview.rosteritemviews[jid].openChat(mock.event);
        }
    };

    utils.openChatBoxFor = function (jid) {
        return converse.rosterview.rosteritemviews[jid].openChat(mock.event);
    };

    utils.clearChatBoxMessages = function (jid) {
        var view = converse.chatboxesview.views[jid];
        view.$el.find('.chat-content').empty();
        view.model.messages.reset().localStorage._clear();
    };

    utils.createNewChatRoom = function (room, nick) {
        var controlbox_was_visible = $("#controlbox").is(':visible');
        utils.openControlBox();
        utils.openRoomsPanel();
        var roomspanel = converse.chatboxesview.views.controlbox.roomspanel;
        var $input = roomspanel.$el.find('input.new-chatroom-name');
        var $nick = roomspanel.$el.find('input.new-chatroom-nick');
        var $server = roomspanel.$el.find('input.new-chatroom-server');
        $input.val('lounge');
        $nick.val('dummy');
        $server.val('muc.localhost');
        roomspanel.$el.find('form').submit();
        if (!controlbox_was_visible) {
            utils.closeControlBox();
        }
    };

    utils.createCurrentContacts = function () {
        // Create current (as opposed to requesting or pending) contacts
        // for the user's roster.
        for (i=0; i<mock.cur_names.length; i++) {
            converse.roster.create({
                jid: mock.cur_names[i].replace(' ','.').toLowerCase() + '@localhost',
                subscription: 'both',
                ask: null,
                fullname: mock.cur_names[i],
                is_last: i===(mock.cur_names.length-1)
            });
        }
        return this;
    };

    utils.sendMessage = function (chatboxview, message) {
        chatboxview.$el.find('.chat-textarea').val(message);
        chatboxview.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
    };
    return utils;
}));
