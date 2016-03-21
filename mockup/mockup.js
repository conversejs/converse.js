/*global converse */
(function (root, factory) {
    define(["jquery", "mock", "test_utils"], factory);
} (this, function ($, mock, test_utils) {
    var $msg = converse_api.env.$msg;
    test_utils.clearBrowserStorage();

    return describe("Live Mockup", $.proxy(function(mock, test_utils) {
        describe("Click the links below to view the different elements", function () {
            beforeEach(function () {
                test_utils.initConverse();
                test_utils.createContacts('all');
            });

            it("Show a chat room", function () {
                test_utils.openChatRoom('lounge', 'localhost', 'dummy');
                var view = converse.chatboxviews.get('lounge@localhost');
                if (!view.$el.find('.chat-area').length) { view.renderChatArea(); }
                var text = 'This is a sent message';
                view.$el.find('.chat-textarea').text(text);
                view.$el.find('textarea.chat-textarea').trigger($.Event('keypress', {keyCode: 13}));
                var message = $msg({
                    from: 'lounge@localhost/dummy',
                    to: 'dummy@localhost.com',
                    type: 'groupchat',
                    id: view.model.messages.at(0).get('msgid')
                }).c('body').t(text);
                view.onChatRoomMessage(message.nodeTree);

                var nick = mock.chatroom_names[0];
                text = 'This is a received message';
                message = $msg({
                    from: 'lounge@localhost/'+nick,
                    id: '1',
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t(text);
                view.onChatRoomMessage(message.nodeTree);
            });

            it("Show the control box", function () {
                test_utils.openControlBox();
                test_utils.openContactsPanel();
            });

            it("Show a headlines box", function () {
                converse.connection._dataRecv(
                    test_utils.createRequest(
                        $msg({
                            'type': 'headline',
                            'from': 'notify.example.com',
                            'to': 'dummy@localhost',
                            'xml:lang': 'en'
                        })
                        .c('subject').t('MAIL').up()
                        .c('body').t('You got mail.').up()
                    )
                );
            });

            xit("Show a private chat box", function () {
                var contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
                var chatbox = test_utils.openChatBoxFor(contact_jid);
                var view = converse.chatboxviews.get(contact_jid);
                var message = 'This message is sent from this chatbox';
                test_utils.sendMessage(view, message);
                message = 'This is a received message';
                var msg = $msg({
                        from: contact_jid,
                        to: converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                converse.chatboxes.onMessage(msg);
            });
        });
    }, window, mock, test_utils));
}));
