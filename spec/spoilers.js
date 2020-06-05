/* global mock */

const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

describe("A spoiler message", function () {

    beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000));
    afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

    it("can be received with a hint",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async (done, _converse) => {

        await mock.waitForRoster(_converse, 'current');
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        /* <message to='romeo@montague.net/orchard' from='juliet@capulet.net/balcony' id='spoiler2'>
            *      <body>And at the end of the story, both of them die! It is so tragic!</body>
            *      <spoiler xmlns='urn:xmpp:spoiler:0'>Love story end</spoiler>
            *  </message>
            */
        const spoiler_hint = "Love story end"
        const spoiler = "And at the end of the story, both of them die! It is so tragic!";
        const $msg = converse.env.$msg;
        const u = converse.env.utils;
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
        _converse.connection._dataRecv(mock.createRequest(msg));
        await new Promise(resolve => _converse.api.listen.once('chatBoxViewInitialized', resolve));
        const view = _converse.chatboxviews.get(sender_jid);
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        await u.waitUntil(() => view.model.vcard.get('fullname') === 'Mercutio')
        expect(view.el.querySelector('.chat-msg__author').textContent.trim()).toBe('Mercutio');
        const message_content = view.el.querySelector('.chat-msg__text');
        await u.waitUntil(() => message_content.textContent === spoiler);
        const spoiler_hint_el = view.el.querySelector('.spoiler-hint');
        expect(spoiler_hint_el.textContent).toBe(spoiler_hint);
        done();
    }));

    it("can be received without a hint",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async (done, _converse) => {

        await mock.waitForRoster(_converse, 'current');
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        /* <message to='romeo@montague.net/orchard' from='juliet@capulet.net/balcony' id='spoiler2'>
         *      <body>And at the end of the story, both of them die! It is so tragic!</body>
         *      <spoiler xmlns='urn:xmpp:spoiler:0'>Love story end</spoiler>
         *  </message>
         */
        const $msg = converse.env.$msg;
        const u = converse.env.utils;
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
        _converse.connection._dataRecv(mock.createRequest(msg));
        await new Promise(resolve => _converse.api.listen.once('chatBoxViewInitialized', resolve));
        const view = _converse.chatboxviews.get(sender_jid);
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        await u.waitUntil(() => u.isVisible(view.el));
        await u.waitUntil(() => view.model.vcard.get('fullname') === 'Mercutio')
        await u.waitUntil(() => u.isVisible(view.el.querySelector('.chat-msg__author')));
        expect(view.el.querySelector('.chat-msg__author').textContent.includes('Mercutio')).toBeTruthy();
        const message_content = view.el.querySelector('.chat-msg__text');
        await u.waitUntil(() => message_content.textContent === spoiler);
        const spoiler_hint_el = view.el.querySelector('.spoiler-hint');
        expect(spoiler_hint_el.textContent).toBe('');
        done();
    }));

    it("can be sent without a hint",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async (done, _converse) => {

        await mock.waitForRoster(_converse, 'current', 1);
        mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        const { $pres, Strophe} = converse.env;
        const u = converse.env.utils;

        // XXX: We need to send a presence from the contact, so that we
        // have a resource, that resource is then queried to see
        // whether Strophe.NS.SPOILER is supported, in which case
        // the spoiler button will appear.
        const presence = $pres({
            'from': contact_jid+'/phone',
            'to': 'romeo@montague.lit'
        });
        _converse.connection._dataRecv(mock.createRequest(presence));
        await mock.openChatBoxFor(_converse, contact_jid);
        await mock.waitUntilDiscoConfirmed(_converse, contact_jid+'/phone', [], [Strophe.NS.SPOILER]);
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

        const spoiler = 'This is the spoiler';
        const body_el = stanza.querySelector('body');
        expect(body_el.textContent).toBe(spoiler);

        /* Test the HTML spoiler message */
        expect(view.el.querySelector('.chat-msg__author').textContent.trim()).toBe('Romeo Montague');

        const message_content = view.el.querySelector('.chat-msg__text');
        await u.waitUntil(() => message_content.textContent === spoiler);

        const spoiler_msg_el = view.el.querySelector('.chat-msg__text.spoiler');
        expect(Array.from(spoiler_msg_el.classList).includes('collapsed')).toBeTruthy();

        spoiler_toggle = view.el.querySelector('.spoiler-toggle');
        expect(spoiler_toggle.textContent.trim()).toBe('Show more');
        spoiler_toggle.click();
        await u.waitUntil(() => !Array.from(spoiler_msg_el.classList).includes('collapsed'));
        expect(spoiler_toggle.textContent.trim()).toBe('Show less');
        spoiler_toggle.click();
        await u.waitUntil(() => Array.from(spoiler_msg_el.classList).includes('collapsed'));
        done();
    }));

    it("can be sent with a hint",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async (done, _converse) => {

        await mock.waitForRoster(_converse, 'current', 1);
        mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        const { $pres, Strophe} = converse.env;
        const u = converse.env.utils;

        // XXX: We need to send a presence from the contact, so that we
        // have a resource, that resource is then queried to see
        // whether Strophe.NS.SPOILER is supported, in which case
        // the spoiler button will appear.
        const presence = $pres({
            'from': contact_jid+'/phone',
            'to': 'romeo@montague.lit'
        });
        _converse.connection._dataRecv(mock.createRequest(presence));
        await mock.openChatBoxFor(_converse, contact_jid);
        await mock.waitUntilDiscoConfirmed(_converse, contact_jid+'/phone', [], [Strophe.NS.SPOILER]);
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

        const spoiler = 'This is the spoiler'
        const body_el = stanza.querySelector('body');
        expect(body_el.textContent).toBe(spoiler);

        /* Test the HTML spoiler message */
        expect(view.el.querySelector('.chat-msg__author').textContent.trim()).toBe('Romeo Montague');

        const message_content = view.el.querySelector('.chat-msg__text');
        await u.waitUntil(() => message_content.textContent === spoiler);

        const spoiler_msg_el = view.el.querySelector('.chat-msg__text.spoiler');
        expect(Array.from(spoiler_msg_el.classList).includes('collapsed')).toBeTruthy();

        spoiler_toggle = view.el.querySelector('.spoiler-toggle');
        expect(spoiler_toggle.textContent.trim()).toBe('Show more');
        spoiler_toggle.click();
        await u.waitUntil(() => !Array.from(spoiler_msg_el.classList).includes('collapsed'));
        expect(spoiler_toggle.textContent.trim()).toBe('Show less');
        spoiler_toggle.click();
        await u.waitUntil(() => Array.from(spoiler_msg_el.classList).includes('collapsed'));
        done();
    }));
});
