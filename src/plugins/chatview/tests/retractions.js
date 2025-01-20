/*global mock, converse */

const { Strophe, u, stx } = converse.env;

describe("A sent chat message", function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("can be retracted", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const view = await mock.openChatBoxFor(_converse, contact_jid);

        view.model.sendMessage({ body : 'hello world'});
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

        const message = view.model.messages.at(0);
        expect(view.model.messages.length).toBe(1);
        expect(message.get('retracted')).toBeFalsy();
        expect(message.get('editable')).toBeTruthy();

        const retract_button = await u.waitUntil(() => view.querySelector('.chat-msg__content .chat-msg__action-retract'));
        retract_button.click();
        await u.waitUntil(() => u.isVisible(document.querySelector('#converse-modals .modal')));
        const submit_button = document.querySelector('#converse-modals .modal button[type="submit"]');
        submit_button.click();

        const sent_stanzas = _converse.api.connection.get().sent_stanzas;
        await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);

        const msg_obj = view.model.messages.at(0);
        const retraction_stanza = await u.waitUntil(() => sent_stanzas.filter(s => s.querySelector('message apply-to[xmlns="urn:xmpp:fasten:0"]')).pop());
        expect(retraction_stanza).toEqualStanza(
            stx`<message id="${retraction_stanza.getAttribute('id')}" to="${contact_jid}" type="chat" xmlns="jabber:client">
                <store xmlns="urn:xmpp:hints"/>
                <apply-to id="${msg_obj.get('origin_id')}" xmlns="urn:xmpp:fasten:0">
                    <retract xmlns="urn:xmpp:message-retract:0"/>
                </apply-to>
            </message>`);

        expect(view.model.messages.length).toBe(1);
        expect(message.get('retracted')).toBeTruthy();
        expect(message.get('editable')).toBeFalsy();
        expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
        const el = view.querySelector('.chat-msg--retracted .chat-msg__message');
        expect(el.textContent.trim()).toBe('You have removed this message');
    }));
});

describe("A received chat message", function () {

    it("can be followed up with a retraction", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const view = await mock.openChatBoxFor(_converse, contact_jid);

        const received_stanza = stx`
            <message xmlns="jabber:client"
                    to="${_converse.bare_jid}"
                    type="chat"
                    id="29132ea0-0121-2897-b121-36638c259554"
                    from="${contact_jid}">
                <body>😊</body>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="29132ea0-0121-2897-b121-36638c259554"/>
                <stanza-id xmlns="urn:xmpp:sid:0" id="kxViLhgbnNMcWv10" by="${_converse.bare_jid}"/>
            </message>`;

        _converse.api.connection.get()._dataRecv(mock.createRequest(received_stanza));
        await u.waitUntil(() => view.model.messages.length === 1);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

        const retraction_stanza = stx`
            <message id="${u.getUniqueId()}"
                     to="${_converse.bare_jid}"
                     from="${contact_jid}"
                     type="chat"
                     xmlns="jabber:client">
                <apply-to id="29132ea0-0121-2897-b121-36638c259554" xmlns="urn:xmpp:fasten:0">
                    <retract xmlns="urn:xmpp:message-retract:0"/>
                </apply-to>
            </message>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));
        await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);

        expect(view.model.messages.length).toBe(1);

        const message = view.model.messages.at(0);
        expect(message.get('retracted')).toBeTruthy();
        expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
        const msg_el = view.querySelector('.chat-msg--retracted .chat-msg__message');
        expect(msg_el.textContent.trim()).toBe('Mercutio has removed this message');
    }));
});
