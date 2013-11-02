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
        var i, chatbox, num_chatboxes = converse.chatboxes.models.length;
        for (i=num_chatboxes-1; i>-1; i--) {
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
    return utils;
}));
