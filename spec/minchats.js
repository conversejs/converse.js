(function (root, factory) {
    define([
        "mock",
        "test_utils"
        ], function (mock, test_utils) {
            return factory(mock, test_utils);
        }
    );
} (this, function (mock, test_utils) {
    return describe("The Minimized Chats Widget", $.proxy(function(mock, test_utils) {
        beforeEach(function () {
            runs(function () {
                test_utils.closeAllChatBoxes();
                test_utils.removeControlBox();
                converse.roster.browserStorage._clear();
                test_utils.initConverse();
                test_utils.createContacts('current');
                test_utils.openControlBox();
                test_utils.openContactsPanel();
                converse.minimized_chats.toggleview.model.browserStorage._clear();
                converse.minimized_chats.initToggle();
            });
        });

        it("shows chats that have been minimized",  $.proxy(function () {
            var contact_jid, chatview;
            contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(contact_jid);
            chatview = converse.chatboxviews.get(contact_jid);
            expect(chatview.model.get('minimized')).toBeFalsy();
            expect(this.minimized_chats.$el.is(':visible')).toBeFalsy();
            chatview.$el.find('.toggle-chatbox-button').click();
            expect(chatview.model.get('minimized')).toBeTruthy();
            expect(this.minimized_chats.$el.is(':visible')).toBeTruthy();
            expect(this.minimized_chats.keys().length).toBe(1);
            expect(this.minimized_chats.keys()[0]).toBe(contact_jid);

            contact_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(contact_jid);
            chatview = converse.chatboxviews.get(contact_jid);
            expect(chatview.model.get('minimized')).toBeFalsy();
            chatview.$el.find('.toggle-chatbox-button').click();
            expect(chatview.model.get('minimized')).toBeTruthy();
            expect(this.minimized_chats.$el.is(':visible')).toBeTruthy();
            expect(this.minimized_chats.keys().length).toBe(2);
            expect(_.contains(this.minimized_chats.keys(), contact_jid)).toBeTruthy();
        }, converse));

        it("can be toggled to hide or show minimized chats",  $.proxy(function () {
            var contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(contact_jid);
            var chatview = converse.chatboxviews.get(contact_jid);
            expect(this.minimized_chats.$el.is(':visible')).toBeFalsy();
            chatview.model.set({'minimized': true});
            expect(this.minimized_chats.$el.is(':visible')).toBeTruthy();
            expect(this.minimized_chats.keys().length).toBe(1);
            expect(this.minimized_chats.keys()[0]).toBe(contact_jid);
            expect(this.minimized_chats.$('.minimized-chats-flyout').is(':visible')).toBeTruthy();
            expect(this.minimized_chats.toggleview.model.get('collapsed')).toBeFalsy();
            this.minimized_chats.$('#toggle-minimized-chats').click();
            expect(this.minimized_chats.$('.minimized-chats-flyout').is(':visible')).toBeFalsy();
            expect(this.minimized_chats.toggleview.model.get('collapsed')).toBeTruthy();
        }, converse));

        it("shows the number messages received to minimized chats",  $.proxy(function () {
            var i, contact_jid, chatview, msg;
            var sender_jid = mock.cur_names[4].replace(/ /g,'.').toLowerCase() + '@localhost';
            this.minimized_chats.toggleview.model.set({'collapsed': true});
            expect(this.minimized_chats.toggleview.$('.unread-message-count').is(':visible')).toBeFalsy();
            for (i=0; i<3; i++) {
                contact_jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(contact_jid);
                chatview = converse.chatboxviews.get(contact_jid);
                chatview.model.set({'minimized': true});
                msg = $msg({
                    from: contact_jid,
                    to: this.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('body').t('This message is sent to a minimized chatbox').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                this.chatboxes.onMessage(msg);
                expect(this.minimized_chats.toggleview.$('.unread-message-count').is(':visible')).toBeTruthy();
                expect(this.minimized_chats.toggleview.$('.unread-message-count').text()).toBe((i+1).toString());
            }
        }, converse));

    }, converse, mock, test_utils));
}));
