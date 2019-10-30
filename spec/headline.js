(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const $msg = converse.env.$msg,
          _ = converse.env._,
          u = converse.env.utils;

    describe("A headlines box", function () {

        it("will not open nor display non-headline messages",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {}, async function (done, _converse) {

            /* XMPP spam message:
             *
             *  <message xmlns="jabber:client"
             *          to="romeo@montague.lit"
             *          type="chat"
             *          from="gapowa20102106@rds-rostov.ru/Adium">
             *      <nick xmlns="http://jabber.org/protocol/nick">-wwdmz</nick>
             *      <body>SORRY FOR THIS ADVERT</body
             *  </message
             */
            sinon.spy(u, 'isHeadlineMessage');
            const stanza = $msg({
                    'xmlns': 'jabber:client',
                    'to': 'romeo@montague.lit',
                    'type': 'chat',
                    'from': 'gapowa20102106@rds-rostov.ru/Adium',
                })
                .c('nick', {'xmlns': "http://jabber.org/protocol/nick"}).t("-wwdmz").up()
                .c('body').t('SORRY FOR THIS ADVERT');
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.api.chats.get().length);
            expect(u.isHeadlineMessage.called).toBeTruthy();
            expect(u.isHeadlineMessage.returned(false)).toBeTruthy();
            u.isHeadlineMessage.restore();
            done();
        }));

        it("will open and display headline messages", mock.initConverse(
            ['rosterGroupsFetched'], {}, function (done, _converse) {

            /* <message from='notify.example.com'
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
            sinon.spy(u, 'isHeadlineMessage');
            const stanza = $msg({
                    'type': 'headline',
                    'from': 'notify.example.com',
                    'to': 'romeo@montague.lit',
                    'xml:lang': 'en'
                })
                .c('subject').t('SIEVE').up()
                .c('body').t('&lt;juliet@example.com&gt; You got mail.').up()
                .c('x', {'xmlns': 'jabber:x:oob'})
                    .c('url').t('imap://romeo@example.com/INBOX;UIDVALIDITY=385759043/;UID=18');

            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(
                _.includes(
                    _converse.chatboxviews.keys(),
                    'notify.example.com')
                ).toBeTruthy();
            expect(u.isHeadlineMessage.called).toBeTruthy();
            expect(u.isHeadlineMessage.returned(true)).toBeTruthy();
            u.isHeadlineMessage.restore(); // unwraps
            // Headlines boxes don't show an avatar
            const view = _converse.chatboxviews.get('notify.example.com');
            expect(view.model.get('show_avatar')).toBeFalsy();
            expect(view.el.querySelector('img.avatar')).toBe(null);
            done();
        }));

        it("will not show a headline messages from a full JID if allow_non_roster_messaging is false",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {}, function (done, _converse) {

            _converse.allow_non_roster_messaging = false;
            sinon.spy(u, 'isHeadlineMessage');
            const stanza = $msg({
                    'type': 'headline',
                    'from': 'andre5114@jabber.snc.ru/Spark',
                    'to': 'romeo@montague.lit',
                    'xml:lang': 'en'
                })
                .c('nick').t('gpocy').up()
                .c('body').t('Здравствуйте друзья');
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(_.without('controlbox', _converse.chatboxviews.keys()).length).toBe(0);
            expect(u.isHeadlineMessage.called).toBeTruthy();
            expect(u.isHeadlineMessage.returned(true)).toBeTruthy();
            u.isHeadlineMessage.restore(); // unwraps
            done();
        }));
    });
}));
