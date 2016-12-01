(function (root, factory) {
    define(["mock", "converse-api", "test_utils"], factory);
} (this, function (mock, converse_api, test_utils) {
    var _ = converse_api.env._;
    var $msg = converse_api.env.$msg;

    describe("The Minimized Chats Widget", function () {
        afterEach(function () {
            converse_api.user.logout();
            converse_api.listen.not();
            test_utils.clearBrowserStorage();
        });


        it("shows chats that have been minimized",  mock.initConverse(function (converse) {
            test_utils.createContacts(converse, 'current');
            test_utils.openControlBox();
            test_utils.openContactsPanel(converse);
            converse.minimized_chats.toggleview.model.browserStorage._clear();
            converse.minimized_chats.initToggle();

            var contact_jid, chatview;
            contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(converse, contact_jid);
            chatview = converse.chatboxviews.get(contact_jid);
            expect(chatview.model.get('minimized')).toBeFalsy();
            expect(converse.minimized_chats.$el.is(':visible')).toBeFalsy();
            chatview.$el.find('.toggle-chatbox-button').click();
            expect(chatview.model.get('minimized')).toBeTruthy();
            expect(converse.minimized_chats.$el.is(':visible')).toBeTruthy();
            expect(converse.minimized_chats.keys().length).toBe(1);
            expect(converse.minimized_chats.keys()[0]).toBe(contact_jid);

            contact_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(converse, contact_jid);
            chatview = converse.chatboxviews.get(contact_jid);
            expect(chatview.model.get('minimized')).toBeFalsy();
            chatview.$el.find('.toggle-chatbox-button').click();
            expect(chatview.model.get('minimized')).toBeTruthy();
            expect(converse.minimized_chats.$el.is(':visible')).toBeTruthy();
            expect(converse.minimized_chats.keys().length).toBe(2);
            expect(_.contains(converse.minimized_chats.keys(), contact_jid)).toBeTruthy();
        }));

        it("can be toggled to hide or show minimized chats", mock.initConverse(function (converse) {
            test_utils.createContacts(converse, 'current');
            test_utils.openControlBox();
            test_utils.openContactsPanel(converse);
            converse.minimized_chats.toggleview.model.browserStorage._clear();
            converse.minimized_chats.initToggle();

            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(converse, contact_jid);
            var chatview = converse.chatboxviews.get(contact_jid);
            expect(converse.minimized_chats.$el.is(':visible')).toBeFalsy();
            chatview.model.set({'minimized': true});
            expect(converse.minimized_chats.$el.is(':visible')).toBeTruthy();
            expect(converse.minimized_chats.keys().length).toBe(1);
            expect(converse.minimized_chats.keys()[0]).toBe(contact_jid);
            expect(converse.minimized_chats.$('.minimized-chats-flyout').is(':visible')).toBeTruthy();
            expect(converse.minimized_chats.toggleview.model.get('collapsed')).toBeFalsy();
            converse.minimized_chats.$('#toggle-minimized-chats').click();
            expect(converse.minimized_chats.$('.minimized-chats-flyout').is(':visible')).toBeFalsy();
            expect(converse.minimized_chats.toggleview.model.get('collapsed')).toBeTruthy();
        }));

        it("shows the number messages received to minimized chats", mock.initConverse(function (converse) {
            test_utils.createContacts(converse, 'current');
            test_utils.openControlBox();
            test_utils.openContactsPanel(converse);
            converse.minimized_chats.toggleview.model.browserStorage._clear();
            converse.minimized_chats.initToggle();

            var i, contact_jid, chatview, msg;
            converse.minimized_chats.toggleview.model.set({'collapsed': true});
            expect(converse.minimized_chats.toggleview.$('.unread-message-count').is(':visible')).toBeFalsy();
            for (i=0; i<3; i++) {
                contact_jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(converse, contact_jid);
                chatview = converse.chatboxviews.get(contact_jid);
                chatview.model.set({'minimized': true});
                msg = $msg({
                    from: contact_jid,
                    to: converse.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('body').t('This message is sent to a minimized chatbox').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                converse.chatboxes.onMessage(msg);
                expect(converse.minimized_chats.toggleview.$('.unread-message-count').is(':visible')).toBeTruthy();
                expect(converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i+1).toString());
            }
            // Chat state notifications don't increment the unread messages counter
            // <composing> state
            converse.chatboxes.onMessage($msg({
                from: contact_jid,
                to: converse.connection.jid,
                type: 'chat',
                id: (new Date()).getTime()
            }).c('composing', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i).toString());

            // <paused> state
            converse.chatboxes.onMessage($msg({
                from: contact_jid,
                to: converse.connection.jid,
                type: 'chat',
                id: (new Date()).getTime()
            }).c('paused', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i).toString());

            // <gone> state
            converse.chatboxes.onMessage($msg({
                from: contact_jid,
                to: converse.connection.jid,
                type: 'chat',
                id: (new Date()).getTime()
            }).c('gone', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i).toString());

            // <inactive> state
            converse.chatboxes.onMessage($msg({
                from: contact_jid,
                to: converse.connection.jid,
                type: 'chat',
                id: (new Date()).getTime()
            }).c('inactive', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            expect(converse.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i).toString());
        }));
    });
}));
