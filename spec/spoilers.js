(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    const _ = converse.env._;
    const Strophe = converse.env.Strophe;
    const $msg = converse.env.$msg;
    const $pres = converse.env.$pres;
    const u = converse.env.utils;

    describe("A spoiler message", function () {

        it("can be received with a hint",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async (done, _converse) => {

            await test_utils.waitForRoster(_converse, 'current');
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

            /* <message to='romeo@montague.net/orchard' from='juliet@capulet.net/balcony' id='spoiler2'>
             *      <body>And at the end of the story, both of them die! It is so tragic!</body>
             *      <spoiler xmlns='urn:xmpp:spoiler:0'>Love story end</spoiler>
             *  </message>
             */
            const spoiler_hint = "Love story end"
            const spoiler = "And at the end of the story, both of them die! It is so tragic!";
            const msg = $msg({
                    'xmlns': 'jabber:client',
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'
                }).c('body').t(spoiler).up()
                  .c('spoiler', {
                      'xmlns': 'urn:xmpp:spoiler:0',
                    }).t(spoiler_hint)
                .tree();
            _converse.connection._dataRecv(test_utils.createRequest(msg));
            await new Promise(resolve => _converse.api.listen.once('chatBoxViewInitialized', resolve));
            const view = _converse.chatboxviews.get(sender_jid);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.model.vcard.get('fullname') === 'Mercutio')
            expect(view.el.querySelector('.chat-msg__author').textContent.trim()).toBe('Mercutio');
            const message_content = view.el.querySelector('.chat-msg__text');
            expect(message_content.textContent).toBe(spoiler);
            const spoiler_hint_el = view.el.querySelector('.spoiler-hint');
            expect(spoiler_hint_el.textContent).toBe(spoiler_hint);
            done();
        }));

        it("can be received without a hint",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async (done, _converse) => {

            await test_utils.waitForRoster(_converse, 'current');
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            /* <message to='romeo@montague.net/orchard' from='juliet@capulet.net/balcony' id='spoiler2'>
             *      <body>And at the end of the story, both of them die! It is so tragic!</body>
             *      <spoiler xmlns='urn:xmpp:spoiler:0'>Love story end</spoiler>
             *  </message>
             */
            const spoiler = "And at the end of the story, both of them die! It is so tragic!";
            const msg = $msg({
                    'xmlns': 'jabber:client',
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'
                }).c('body').t(spoiler).up()
                  .c('spoiler', {
                      'xmlns': 'urn:xmpp:spoiler:0',
                    }).tree();
            _converse.connection._dataRecv(test_utils.createRequest(msg));

            await new Promise(resolve => _converse.api.listen.once('chatBoxViewInitialized', resolve));
            const view = _converse.chatboxviews.get(sender_jid);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.el.querySelector('.chat-msg__author').textContent.includes('Mercutio')).toBeTruthy();
            const message_content = view.el.querySelector('.chat-msg__text');
            expect(message_content.textContent).toBe(spoiler);
            const spoiler_hint_el = view.el.querySelector('.spoiler-hint');
            expect(spoiler_hint_el.textContent).toBe('');
            done();
        }));

        it("can be sent without a hint",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async (done, _converse) => {

            await test_utils.waitForRoster(_converse, 'current', 1);
            test_utils.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

            // XXX: We need to send a presence from the contact, so that we
            // have a resource, that resource is then queried to see
            // whether Strophe.NS.SPOILER is supported, in which case
            // the spoiler button will appear.
            const presence = $pres({
                'from': contact_jid+'/phone',
                'to': 'romeo@montague.lit'
            });
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            await test_utils.openChatBoxFor(_converse, contact_jid);
            await test_utils.waitUntilDiscoConfirmed(_converse, contact_jid+'/phone', [], [Strophe.NS.SPOILER]);
            const view = _converse.api.chatviews.get(contact_jid);
            spyOn(_converse.connection, 'send');

            await u.waitUntil(() => view.el.querySelector('.toggle-compose-spoiler'));
            let spoiler_toggle = view.el.querySelector('.toggle-compose-spoiler');
            spoiler_toggle.click();

            const textarea = view.el.querySelector('.chat-textarea');
            textarea.value = 'This is the spoiler';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            /* Test the XML stanza
             *
             * <message from="romeo@montague.lit/orchard"
             *          to="max.frankfurter@montague.lit"
             *          type="chat"
             *          id="4547c38b-d98b-45a5-8f44-b4004dbc335e"
             *          xmlns="jabber:client">
             *    <body>This is the spoiler</body>
             *    <active xmlns="http://jabber.org/protocol/chatstates"/>
             *    <spoiler xmlns="urn:xmpp:spoiler:0"/>
             * </message>"
             */
            const stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
            const spoiler_el = stanza.querySelector('spoiler[xmlns="urn:xmpp:spoiler:0"]');
            expect(spoiler_el === null).toBeFalsy();
            expect(spoiler_el.textContent).toBe('');

            const body_el = stanza.querySelector('body');
            expect(body_el.textContent).toBe('This is the spoiler');

            /* Test the HTML spoiler message */
            expect(view.el.querySelector('.chat-msg__author').textContent.trim()).toBe('Romeo Montague');

            const spoiler_msg_el = view.el.querySelector('.chat-msg__text.spoiler');
            expect(spoiler_msg_el.textContent).toBe('This is the spoiler');
            expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeTruthy();

            spoiler_toggle = view.el.querySelector('.spoiler-toggle');
            expect(spoiler_toggle.textContent).toBe('Show more');
            spoiler_toggle.click();
            expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeFalsy();
            expect(spoiler_toggle.textContent).toBe('Show less');
            spoiler_toggle.click();
            expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeTruthy();
            done();
        }));

        it("can be sent with a hint",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async (done, _converse) => {

            await test_utils.waitForRoster(_converse, 'current', 1);
            test_utils.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

            // XXX: We need to send a presence from the contact, so that we
            // have a resource, that resource is then queried to see
            // whether Strophe.NS.SPOILER is supported, in which case
            // the spoiler button will appear.
            const presence = $pres({
                'from': contact_jid+'/phone',
                'to': 'romeo@montague.lit'
            });
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            await test_utils.openChatBoxFor(_converse, contact_jid);
            await test_utils.waitUntilDiscoConfirmed(_converse, contact_jid+'/phone', [], [Strophe.NS.SPOILER]);
            const view = _converse.api.chatviews.get(contact_jid);

            await u.waitUntil(() => view.el.querySelector('.toggle-compose-spoiler'));
            let spoiler_toggle = view.el.querySelector('.toggle-compose-spoiler');
            spoiler_toggle.click();

            spyOn(_converse.connection, 'send');

            const textarea = view.el.querySelector('.chat-textarea');
            textarea.value = 'This is the spoiler';
            const hint_input = view.el.querySelector('.spoiler-hint');
            hint_input.value = 'This is the hint';

            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            /* Test the XML stanza
             *
             * <message from="romeo@montague.lit/orchard"
             *          to="max.frankfurter@montague.lit"
             *          type="chat"
             *          id="4547c38b-d98b-45a5-8f44-b4004dbc335e"
             *          xmlns="jabber:client">
             *    <body>This is the spoiler</body>
             *    <active xmlns="http://jabber.org/protocol/chatstates"/>
             *    <spoiler xmlns="urn:xmpp:spoiler:0">This is the hint</spoiler>
             * </message>"
             */
            const stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
            const spoiler_el = stanza.querySelector('spoiler[xmlns="urn:xmpp:spoiler:0"]');

            expect(spoiler_el === null).toBeFalsy();
            expect(spoiler_el.textContent).toBe('This is the hint');

            const body_el = stanza.querySelector('body');
            expect(body_el.textContent).toBe('This is the spoiler');

            /* Test the HTML spoiler message */
            expect(view.el.querySelector('.chat-msg__author').textContent.trim()).toBe('Romeo Montague');

            const spoiler_msg_el = view.el.querySelector('.chat-msg__text.spoiler');
            expect(spoiler_msg_el.textContent).toBe('This is the spoiler');
            expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeTruthy();

            spoiler_toggle = view.el.querySelector('.spoiler-toggle');
            expect(spoiler_toggle.textContent).toBe('Show more');
            spoiler_toggle.click();
            expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeFalsy();
            expect(spoiler_toggle.textContent).toBe('Show less');
            spoiler_toggle.click();
            expect(_.includes(spoiler_msg_el.classList, 'collapsed')).toBeTruthy();
            done();
        }));
    });
}));
