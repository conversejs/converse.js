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
            converse.chatboxviews.get(chatbox.get('id')).closeChat();
        }
        return this;
    };

    utils.removeAllChatBoxes = function () {
        var i, chatbox, num_chatboxes = converse.chatboxes.models.length;
        for (i=num_chatboxes-1; i>-1; i--) {
            chatbox = converse.chatboxes.models[i];
            converse.chatboxviews.get(chatbox.get('id')).closeChat();
            converse.chatboxviews.get(chatbox.get('id')).$el.remove();
        }
        converse.chatboxviews.get('controlbox').closeChat();
        converse.chatboxviews.get('controlbox').$el.remove();
        return this;
    };

    utils.initConverse = function () {
        converse.chatboxes = new converse.ChatBoxes();
        converse.chatboxviews = new converse.ChatBoxViews({model: converse.chatboxes});
        converse.onConnected();
    };

    utils.initRoster = function () {
        converse.roster.localStorage._clear();
        converse.initRoster();
    };

    utils.openControlBox = function () {
        var toggle = $(".toggle-online-users");
        if (!$("#controlbox").is(':visible')) {
            if (!toggle.is(':visible')) {
                toggle.show(toggle.click);
            } else {
                toggle.click();
            }
        }
        return this;
    };

    utils.closeControlBox = function () {
        if ($("#controlbox").is(':visible')) {
            $("#controlbox").find(".close-chatbox-button").click();
        }
        return this;
    };

    utils.removeControlBox = function () {
        converse.controlboxtoggle.show();
        $('#controlbox').remove();
    };

    utils.openContactsPanel = function () {
        var cbview = converse.chatboxviews.get('controlbox');
        var $tabs = cbview.$el.find('#controlbox-tabs');
        $tabs.find('li').first().find('a').click();
    };

    utils.openRoomsPanel = function () {
        var cbview = converse.chatboxviews.get('controlbox');
        var $tabs = cbview.$el.find('#controlbox-tabs');
        $tabs.find('li').last().find('a').click();
    };

    utils.openChatBoxes = function (amount) {
        var i = 0, jid, views = [];
        for (i; i<amount; i++) {
            jid = mock.cur_names[i].replace(' ','.').toLowerCase() + '@localhost';
            views[i] = converse.rosterview.get(jid).openChat(mock.event);
        }
        return views;
    };

    utils.openChatBoxFor = function (jid) {
        return converse.rosterview.get(jid).openChat(mock.event);
    };

    utils.clearChatBoxMessages = function (jid) {
        var view = converse.chatboxviews.get(jid);
        view.$el.find('.chat-content').empty();
        view.model.messages.reset();
        view.model.messages.localStorage._clear();
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
