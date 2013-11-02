(function (root, factory) {
    define("utils", ['jquery'],
        function($) {
            return factory($);
        });
}(this, function ($) {
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

    utils.createContactsRoster = function () {
        for (i=0; i<cur_names.length; i++) {
            this.roster.create({
                jid: cur_names[i].replace(' ','.').toLowerCase() + '@localhost',
                subscription: 'both',
                ask: null,
                fullname: cur_names[i],
                is_last: i===(cur_names.length-1)
            });
        }
        return this;
    };
    return utils;
}));
