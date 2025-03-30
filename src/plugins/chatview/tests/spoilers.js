/* global mock, converse */

const { Strophe, sizzle, $msg, u, stx } = converse.env;
const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

const settings = {
    'visible_toolbar_buttons': {
        'emoji': true,
        'spoiler': true
    }
}

describe("A spoiler message", function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));
    beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000));
    afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

    it("can be received with a hint",
        mock.initConverse(['chatBoxesFetched'], settings, async (_converse) => {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current');
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const spoiler_hint = "Love story end"
        const spoiler = "And at the end of the story, both of them die! It is so tragic!";
        const msg = stx`
            <message xmlns="jabber:client" to="${_converse.bare_jid}" from="${sender_jid}" type="chat">
                <body>${spoiler}</body>
                <spoiler xmlns="urn:xmpp:spoiler:0">${spoiler_hint}</spoiler>
            </message>`;
        api.connection.get()._dataRecv(mock.createRequest(msg));
        await new Promise(resolve => _converse.api.listen.once('chatBoxViewInitialized', resolve));
        const view = _converse.chatboxviews.get(sender_jid);
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        await u.waitUntil(() => view.model.vcard.get('fullname') === 'Mercutio')
        expect(view.querySelector('.chat-msg__author').textContent.trim()).toBe('Mercutio');
        const message_content = view.querySelector('.chat-msg__text');
        await u.waitUntil(() => message_content.textContent === spoiler);
        const spoiler_hint_el = view.querySelector('.spoiler-hint');
        expect(spoiler_hint_el.textContent).toBe(spoiler_hint);
    }));

    it("can be received without a hint",
            mock.initConverse(['chatBoxesFetched'], settings, async (_converse) => {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current');
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const spoiler = "And at the end of the story, both of them die! It is so tragic!";
        const msg = stx`
            <message xmlns="jabber:client" to="${_converse.bare_jid}" from="${sender_jid}" type="chat">
                <body>${spoiler}</body>
                <spoiler xmlns="urn:xmpp:spoiler:0"></spoiler>
            </message>`;
        api.connection.get()._dataRecv(mock.createRequest(msg));
        await new Promise(resolve => _converse.api.listen.once('chatBoxViewInitialized', resolve));
        const view = _converse.chatboxviews.get(sender_jid);
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        await u.waitUntil(() => u.isVisible(view));
        await u.waitUntil(() => view.model.vcard.get('fullname') === 'Mercutio')
        await u.waitUntil(() => u.isVisible(view.querySelector('.chat-msg__author')));
        expect(view.querySelector('.chat-msg__author').textContent.includes('Mercutio')).toBeTruthy();
        const message_content = view.querySelector('.chat-msg__text');
        await u.waitUntil(() => message_content.textContent === spoiler);
        const spoiler_hint_el = view.querySelector('.spoiler-hint');
        expect(spoiler_hint_el.textContent).toBe('');
    }));

    it("can be sent without a hint",
            mock.initConverse(['chatBoxesFetched'], settings, async (_converse) => {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 1);
        mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        // XXX: We need to send a presence from the contact, so that we
        // have a resource, that resource is then queried to see
        // whether Strophe.NS.SPOILER is supported, in which case
        // the spoiler button will appear.
        const presence = stx`<presence xmlns="jabber:client" from="${contact_jid}/phone" to="romeo@montague.lit"/>`;
        api.connection.get()._dataRecv(mock.createRequest(presence));
        await mock.openChatBoxFor(_converse, contact_jid);
        await mock.waitUntilDiscoConfirmed(_converse, contact_jid+'/phone', [], [Strophe.NS.SPOILER]);
        const view = _converse.chatboxviews.get(contact_jid);
        spyOn(api.connection.get(), 'send');

        await u.waitUntil(() => view.querySelector('.toggle-compose-spoiler'));
        let spoiler_toggle = view.querySelector('.toggle-compose-spoiler');
        spoiler_toggle.click();

        const textarea = view.querySelector('.chat-textarea');
        textarea.value = 'This is the spoiler';
        const message_form = view.querySelector('converse-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            key: "Enter",
        });
        await new Promise(resolve => api.listen.on('sendMessage', resolve));

        const stanza = api.connection.get().send.calls.argsFor(0)[0];
        const spoiler_el = sizzle('spoiler[xmlns="urn:xmpp:spoiler:0"]', stanza).pop();
        expect(spoiler_el.textContent).toBe('')

        const spoiler = 'This is the spoiler';
        const body_el = stanza.querySelector('body');
        expect(body_el.textContent).toBe(spoiler);

        /* Test the HTML spoiler message */
        expect(view.querySelector('.chat-msg__author').textContent.trim()).toBe('Romeo Montague');

        const message_content = view.querySelector('.chat-msg__text');
        await u.waitUntil(() => message_content.textContent === spoiler);

        const spoiler_msg_el = view.querySelector('.chat-msg__text.spoiler');
        expect(Array.from(spoiler_msg_el.classList).includes('hidden')).toBeTruthy();

        spoiler_toggle = view.querySelector('.spoiler-toggle');
        expect(spoiler_toggle.textContent.trim()).toBe('Show more');
        spoiler_toggle.click();
        await u.waitUntil(() => !Array.from(spoiler_msg_el.classList).includes('hidden'));
        expect(spoiler_toggle.textContent.trim()).toBe('Show less');
        spoiler_toggle.click();
        await u.waitUntil(() => Array.from(spoiler_msg_el.classList).includes('hidden'));
    }));

    it("can be sent with a hint",
            mock.initConverse(['chatBoxesFetched'], settings, async (_converse) => {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 1);
        mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        // XXX: We need to send a presence from the contact, so that we
        // have a resource, that resource is then queried to see
        // whether Strophe.NS.SPOILER is supported, in which case
        // the spoiler button will appear.
        const presence = stx`<presence xmlns="jabber:client" from="${contact_jid}/phone" to="romeo@montague.lit"/>`;
        api.connection.get()._dataRecv(mock.createRequest(presence));
        await mock.openChatBoxFor(_converse, contact_jid);
        await mock.waitUntilDiscoConfirmed(_converse, contact_jid+'/phone', [], [Strophe.NS.SPOILER]);
        const view = _converse.chatboxviews.get(contact_jid);

        await u.waitUntil(() => view.querySelector('.toggle-compose-spoiler'));
        let spoiler_toggle = view.querySelector('.toggle-compose-spoiler');
        spoiler_toggle.click();

        spyOn(api.connection.get(), 'send');

        const textarea = view.querySelector('.chat-textarea');
        textarea.value = 'This is the spoiler';
        const hint_input = view.querySelector('.spoiler-hint');
        hint_input.value = 'This is the hint';

        const message_form = view.querySelector('converse-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            key: "Enter",
        });
        await new Promise(resolve => api.listen.on('sendMessage', resolve));

        const stanza = api.connection.get().send.calls.argsFor(0)[0];
        expect(stanza).toEqualStanza(
            stx`<message from="romeo@montague.lit/orchard"
                    id="${stanza.getAttribute('id')}"
                    to="mercutio@montague.lit"
                    type="chat"
                    xmlns="jabber:client">
                <body>This is the spoiler</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <request xmlns="urn:xmpp:receipts"/>
                <spoiler xmlns="urn:xmpp:spoiler:0">This is the hint</spoiler>
                <origin-id id="${stanza.querySelector('origin-id').getAttribute('id')}" xmlns="urn:xmpp:sid:0"/>
            </message>`
        );

        const spoiler_el = sizzle('spoiler[xmlns="urn:xmpp:spoiler:0"]', stanza).pop();
        expect(spoiler_el?.textContent).toBe('This is the hint');

        const spoiler = 'This is the spoiler'
        const body_el = stanza.querySelector('body');
        expect(body_el.textContent).toBe(spoiler);

        expect(view.querySelector('.chat-msg__author').textContent.trim()).toBe('Romeo Montague');

        const message_content = view.querySelector('.chat-msg__text');
        await u.waitUntil(() => message_content.textContent === spoiler);

        const spoiler_msg_el = view.querySelector('.chat-msg__text.spoiler');
        expect(Array.from(spoiler_msg_el.classList).includes('hidden')).toBeTruthy();

        spoiler_toggle = view.querySelector('.spoiler-toggle');
        expect(spoiler_toggle.textContent.trim()).toBe('Show more');
        spoiler_toggle.click();
        await u.waitUntil(() => !Array.from(spoiler_msg_el.classList).includes('hidden'));
        expect(spoiler_toggle.textContent.trim()).toBe('Show less');
        spoiler_toggle.click();
        await u.waitUntil(() => Array.from(spoiler_msg_el.classList).includes('hidden'));
    }));

    it("can be saved as an unsent draft",
            mock.initConverse(['chatBoxesFetched'], { ...settings, view_mode: 'fullscreen' }, async (_converse) => {

        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 2);
        mock.openControlBox(_converse);
        const contact1_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const contact2_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        // XXX: We need to send a presence from the contact, so that we
        // have a resource, that resource is then queried to see
        // whether Strophe.NS.SPOILER is supported, in which case
        // the spoiler button will appear.
        const presence = stx`<presence xmlns="jabber:client" from="${contact1_jid}/phone" to="romeo@montague.lit"/>`;
        api.connection.get()._dataRecv(mock.createRequest(presence));

        await mock.openChatBoxFor(_converse, contact1_jid);
        await mock.waitUntilDiscoConfirmed(_converse, contact1_jid+'/phone', [], [Strophe.NS.SPOILER]);
        const view = _converse.chatboxviews.get(contact1_jid);
        spyOn(api.connection.get(), 'send');

        await u.waitUntil(() => view.querySelector('.toggle-compose-spoiler'));
        let spoiler_toggle = view.querySelector('.toggle-compose-spoiler');
        spoiler_toggle.click();

        let hint_input = view.querySelector('.spoiler-hint');
        hint_input.value = 'This is the hint';

        let textarea = view.querySelector('.chat-textarea');
        textarea.value = 'This is the spoiler';

        await mock.openChatBoxFor(_converse, contact2_jid);
        await mock.openChatBoxFor(_converse, contact1_jid);

        hint_input = view.querySelector('.spoiler-hint');
        expect(hint_input.value).toBe('This is the hint');

        textarea = view.querySelector('.chat-textarea');
        expect(textarea.value).toBe('This is the spoiler');
    }));
});
