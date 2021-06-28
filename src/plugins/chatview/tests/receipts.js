/*global mock, converse, _ */

const { Promise, Strophe, $msg, sizzle } = converse.env;
const u = converse.env.utils;


describe("A delivery receipt", function () {

    it("is emitted for a received message which requests it",
        mock.initConverse(
            ['chatBoxesFetched'], {},
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const msg_id = u.getUniqueId();
        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(stanza => sent_stanzas.push(stanza));
        const msg = $msg({
                'from': sender_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                'id': msg_id,
            }).c('body').t('Message!').up()
            .c('request', {'xmlns': Strophe.NS.RECEIPTS}).tree();
        await _converse.handleMessageStanza(msg);
        const sent_messages = sent_stanzas.map(s => _.isElement(s) ? s : s.nodeTree).filter(s => s.nodeName === 'message');
        // A chat state message is also included
        expect(sent_messages.length).toBe(2);
        const receipt = sizzle(`received[xmlns="${Strophe.NS.RECEIPTS}"]`, sent_messages[1]).pop();
        expect(Strophe.serialize(receipt)).toBe(`<received id="${msg_id}" xmlns="${Strophe.NS.RECEIPTS}"/>`);
    }));

    it("is not emitted for a carbon message",
        mock.initConverse(
            ['chatBoxesFetched'], {},
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const msg_id = u.getUniqueId();
        const view = await mock.openChatBoxFor(_converse, sender_jid);
        spyOn(view.model, 'sendReceiptStanza').and.callThrough();
        const msg = $msg({
                'from': sender_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                'id': u.getUniqueId(),
            }).c('received', {'xmlns': 'urn:xmpp:carbons:2'})
            .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
            .c('message', {
                    'xmlns': 'jabber:client',
                    'from': sender_jid,
                    'to': _converse.bare_jid+'/another-resource',
                    'type': 'chat',
                    'id': msg_id
            }).c('body').t('Message!').up()
            .c('request', {'xmlns': Strophe.NS.RECEIPTS}).tree();
        await _converse.handleMessageStanza(msg);
        expect(view.model.sendReceiptStanza).not.toHaveBeenCalled();
    }));

    it("is not emitted for an archived message",
        mock.initConverse(
            ['chatBoxesFetched'], {},
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const view = await mock.openChatBoxFor(_converse, sender_jid);
        spyOn(view.model, 'sendReceiptStanza').and.callThrough();

        const stanza = u.toStanza(
            `<message xmlns="jabber:client" to="${_converse.jid}">
                <result xmlns="urn:xmpp:mam:2" id="9ZWxmXMR8SVor-tC" queryid="f543c5f9-55e7-400e-860a-56baac121e6a">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <delay xmlns="urn:xmpp:delay" stamp="2020-01-10T22:19:30Z"/>
                        <message xmlns="jabber:client" type="chat" to="${_converse.jid}" from="${sender_jid}" id="id8b6426b4-40fe-4151-941e-4c64e380acb9">
                            <body>Please confirm receipt</body>
                            <request xmlns="urn:xmpp:receipts"/>
                            <origin-id xmlns="urn:xmpp:sid:0" id="id8b6426b4-40fe-4151-941e-4c64e380acb9"/>
                        </message>
                    </forwarded>
                </result>
            </message>`);

        spyOn(view.model, 'getDuplicateMessage').and.callThrough();
        _converse.handleMAMResult(view.model, { 'messages': [stanza] });
        let message_attrs;
        _converse.api.listen.on('MAMResult', async data => {
            message_attrs = await data.messages[0];
        });
        await u.waitUntil(() => view.model.getDuplicateMessage.calls.count());
        expect(message_attrs.is_archived).toBe(true);
        expect(message_attrs.is_valid_receipt_request).toBe(false);
        expect(view.model.sendReceiptStanza).not.toHaveBeenCalled();
    }));

    it("can be received for a sent message",
        mock.initConverse(
            ['chatBoxesFetched'], {},
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        const textarea = view.querySelector('textarea.chat-textarea');
        textarea.value = 'But soft, what light through yonder airlock breaks?';
        const message_form = view.querySelector('converse-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        const chatbox = _converse.chatboxes.get(contact_jid);
        expect(chatbox).toBeDefined();
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        let msg_obj = chatbox.messages.models[0];
        let msg_id = msg_obj.get('msgid');
        let msg = $msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'id': u.getUniqueId(),
            }).c('received', {'id': msg_id, xmlns: Strophe.NS.RECEIPTS}).up().tree();
        _converse.connection._dataRecv(mock.createRequest(msg));
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__receipt').length === 1);

        // Also handle receipts with type 'chat'. See #1353
        spyOn(_converse, 'handleMessageStanza').and.callThrough();
        textarea.value = 'Another message';
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await new Promise(resolve => view.model.messages.once('rendered', resolve));

        msg_obj = chatbox.messages.models[1];
        msg_id = msg_obj.get('msgid');
        msg = $msg({
                'from': contact_jid,
                'type': 'chat',
                'to': _converse.connection.jid,
                'id': u.getUniqueId(),
            }).c('received', {'id': msg_id, xmlns: Strophe.NS.RECEIPTS}).up().tree();
        _converse.connection._dataRecv(mock.createRequest(msg));
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__receipt').length === 2);
        expect(_converse.handleMessageStanza.calls.count()).toBe(1);
    }));
});
