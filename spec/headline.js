(function (root, factory) {
    define([
        "jquery",
        "converse-api",
        "utils",
        "mock",
        "test_utils"
        ], factory);
} (this, function ($, converse_api, utils, mock, test_utils) {
    "use strict";
    var $msg = converse_api.env.$msg,
        _ = converse_api.env._;

    describe("A headlines box", function () {

        afterEach(function () {
            converse_api.user.logout();
            test_utils.clearBrowserStorage();
        });

        it("will not open nor display non-headline messages", mock.initConverse(function (converse) {
            /* XMPP spam message:
             *
             *  <message xmlns="jabber:client"
             *          to="dummy@localhost"
             *          type="chat"
             *          from="gapowa20102106@rds-rostov.ru/Adium">
             *      <nick xmlns="http://jabber.org/protocol/nick">-wwdmz</nick>
             *      <body>SORRY FOR THIS ADVERT</body
             *  </message
             */
            test_utils.openControlBox();
            test_utils.openContactsPanel(converse);
            sinon.spy(utils, 'isHeadlineMessage');
            runs(function () {
                var stanza = $msg({
                        'xmlns': 'jabber:client',
                        'to': 'dummy@localhost',
                        'type': 'chat',
                        'from': 'gapowa20102106@rds-rostov.ru/Adium',
                    })
                    .c('nick', {'xmlns': "http://jabber.org/protocol/nick"}).t("-wwdmz").up()
                    .c('body').t('SORRY FOR THIS ADVERT');
                converse.connection._dataRecv(test_utils.createRequest(stanza));
            });
            waits(250);
            runs(function () {
                expect(utils.isHeadlineMessage.called).toBeTruthy();
                expect(utils.isHeadlineMessage.returned(false)).toBeTruthy();
                utils.isHeadlineMessage.restore();
            });
        }));


        it("will open and display headline messages", mock.initConverse(function (converse) {
            /*
             *  <message from='notify.example.com'
             *          to='romeo@im.example.com'
             *          type='headline'
             *          xml:lang='en'>
             *  <subject>SIEVE</subject>
             *  <body>&lt;juliet@example.com&gt; You got mail.</body>
             *  <x xmlns='jabber:x:oob'>
             *      <url>
             *      imap://romeo@example.com/INBOX;UIDVALIDITY=385759043/;UID=18
             *      </url>
             *  </x>
             *  </message>
             */
            test_utils.openControlBox();
            test_utils.openContactsPanel(converse);
            sinon.spy(utils, 'isHeadlineMessage');
            runs(function () {
                var stanza = $msg({
                        'type': 'headline',
                        'from': 'notify.example.com',
                        'to': 'dummy@localhost',
                        'xml:lang': 'en'
                    })
                    .c('subject').t('SIEVE').up()
                    .c('body').t('&lt;juliet@example.com&gt; You got mail.').up()
                    .c('x', {'xmlns': 'jabber:x:oob'})
                    .c('url').t('imap://romeo@example.com/INBOX;UIDVALIDITY=385759043/;UID=18');
                converse.connection._dataRecv(test_utils.createRequest(stanza));
            });
            waits(250);
            runs(function () {
                expect(
                    _.contains(
                        converse.chatboxviews.keys(),
                        'notify.example.com')
                    ).toBeTruthy();
                expect(utils.isHeadlineMessage.called).toBeTruthy();
                expect(utils.isHeadlineMessage.returned(true)).toBeTruthy();
                utils.isHeadlineMessage.restore(); // unwraps
            });
        }));
    });
}));
