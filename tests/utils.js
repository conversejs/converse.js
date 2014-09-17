(function (root, factory) {
    define("test_utils", [
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
            converse.chatboxviews.get(chatbox.get('id')).close();
        }
        return this;
    };

    utils.removeAllChatBoxes = function () {
        var i, chatbox, num_chatboxes = converse.chatboxes.models.length;
        for (i=num_chatboxes-1; i>-1; i--) {
            chatbox = converse.chatboxes.models[i];
            converse.chatboxviews.get(chatbox.get('id')).close();
            converse.chatboxviews.get(chatbox.get('id')).$el.remove();
        }
        converse.chatboxviews.get('controlbox').close();
        converse.chatboxviews.get('controlbox').$el.remove();
        return this;
    };

    utils.initConverse = function () {
        converse._tearDown();
        converse._initialize();
    };

    utils.initRoster = function () {
        converse.roster.browserStorage._clear();
        converse.initRoster();
    };

    utils.openControlBox = function () {
        var toggle = $(".toggle-controlbox");
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
            jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
            views[i] = converse.roster.get(jid).trigger("open");
        }
        return views;
    };

    utils.openChatBoxFor = function (jid) {
        return converse.roster.get(jid).trigger("open");
    };

    utils.openChatRoom = function (room, server, nick) {
        // Open a new chatroom
        this.openControlBox();
        this.openRoomsPanel();
        var roomspanel = converse.chatboxviews.get('controlbox').roomspanel;
        roomspanel.$el.find('input.new-chatroom-name').val(room);
        roomspanel.$el.find('input.new-chatroom-nick').val(nick);
        roomspanel.$el.find('input.new-chatroom-server').val(server);
        roomspanel.$el.find('form').submit();
        this.closeControlBox();
    };

    utils.removeRosterContacts = function () {
        var model;
        while (converse.rosterview.model.length) {
            model = converse.rosterview.model.pop();
            converse.rosterview.model.remove(model);
        }
    };

    utils.clearBrowserStorage = function () {
        window.localStorage.clear();
        window.sessionStorage.clear();
        return this;
    };

    utils.clearChatBoxMessages = function (jid) {
        var view = converse.chatboxviews.get(jid);
        view.$el.find('.chat-content').empty();
        view.model.messages.reset();
        view.model.messages.browserStorage._clear();
    };

    utils.createContacts = function (type, length) {
        /* Create current (as opposed to requesting or pending) contacts
         * for the user's roster.
         *
         * These contacts are not grouped. See below.
         */
        var names;
        if (type === 'requesting') {
            names = mock.req_names;
            subscription = 'none';
            requesting = true;
            ask = null;
        } else if (type === 'pending') {
            names = mock.pend_names;
            subscription = 'none';
            requesting = false;
            ask = 'subscribe';
        } else if (type === 'current') {
            names = mock.cur_names;
            subscription = 'both';
            requesting = false;
            ask = null;
        } else if (type === 'all') {
            this.createContacts('current').createContacts('requesting').createContacts('pending');
            return this;
        } else {
            throw "Need to specify the type of contact to create";
        }

        if (typeof length === 'undefined') {
            length = names.length;
        }
        for (i=0; i<length; i++) {
            converse.roster.create({
                ask: ask,
                fullname: names[i],
                jid: names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                requesting: requesting,
                subscription: subscription
            });
        }
        return this;
    };

    utils.createGroupedContacts = function () {
        /* Create grouped contacts
         */
        var i=0, j=0;
        _.each(_.keys(mock.groups), $.proxy(function (name) {
            j = i;
            for (i=j; i<j+mock.groups[name]; i++) {
                converse.roster.create({
                    jid: mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost',
                    subscription: 'both',
                    ask: null,
                    groups: name === 'ungrouped'? [] : [name],
                    fullname: mock.cur_names[i]
                });
            }
        }, converse));
    };

    utils.sendMessage = function (chatboxview, message) {
        chatboxview.$el.find('.chat-textarea').val(message);
        chatboxview.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
    };
    return utils;
}));
