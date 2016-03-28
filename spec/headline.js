/*global converse */
(function (root, factory) {
    define([
        "jquery",
        "utils",
        "mock",
        "test_utils"
        ], factory);
} (this, function ($, utils, mock, test_utils) {
    "use strict";
    var $msg = converse_api.env.$msg,
        _ = converse_api.env._;

    describe("When a headline message is received", function () {

        it("a chat box will open and display it", function () {
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
        });
    });
}));
