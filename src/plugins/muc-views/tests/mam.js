/*global mock, converse */

const { Strophe, $msg, $pres } = converse.env;
const u = converse.env.utils;

describe("A MAM archived groupchat message", function () {

    it("is ignored if it has the same archive-id of an already received one",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'room@muc.example.com';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        spyOn(view.model, 'getDuplicateMessage').and.callThrough();
        let stanza = u.toStanza(`
            <message xmlns="jabber:client"
                     from="room@muc.example.com/some1"
                     to="${_converse.connection.jid}"
                     type="groupchat">
                <body>Typical body text</body>
                <stanza-id xmlns="urn:xmpp:sid:0"
                           id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                           by="room@muc.example.com"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.model.messages.length === 1);
        await u.waitUntil(() => view.model.getDuplicateMessage.calls.count() === 1);
        let result = await view.model.getDuplicateMessage.calls.all()[0].returnValue;
        expect(result).toBe(undefined);

        stanza = u.toStanza(`
            <message xmlns="jabber:client"
                    to="${_converse.connection.jid}"
                    from="room@muc.example.com">
                <result xmlns="urn:xmpp:mam:2" queryid="82d9db27-6cf8-4787-8c2c-5a560263d823" id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:17:23Z"/>
                        <message from="room@muc.example.com/some1" type="groupchat">
                            <body>Typical body text</body>
                        </message>
                    </forwarded>
                </result>
            </message>`);

        spyOn(view.model, 'updateMessage');
        _converse.handleMAMResult(view.model, { 'messages': [stanza] });
        await u.waitUntil(() => view.model.getDuplicateMessage.calls.count() === 2);
        result = await view.model.getDuplicateMessage.calls.all()[1].returnValue;
        expect(result instanceof _converse.Message).toBe(true);
        expect(view.model.messages.length).toBe(1);
        await u.waitUntil(() => view.model.updateMessage.calls.count());
    }));

    it("will be discarded if it's a malicious message meant to look like a carbon copy",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        const muc_jid = 'xsf@muc.xmpp.org';
        const sender_jid = `${muc_jid}/romeo`;
        const impersonated_jid = `${muc_jid}/i_am_groot`
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const stanza = $pres({
                to: 'romeo@montague.lit/_converse.js-29092160',
                from: sender_jid
            })
            .c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {
                'affiliation': 'owner',
                'jid': 'newguy@montague.lit/_converse.js-290929789',
                'role': 'participant'
            }).tree();
        _converse.connection._dataRecv(mock.createRequest(stanza));
        /*
         * <message to="romeo@montague.im/poezio" id="718d40df-3948-4798-a99b-35cc9f03cc4f-641" type="groupchat" from="xsf@muc.xmpp.org/romeo">
         *     <received xmlns="urn:xmpp:carbons:2">
         *         <forwarded xmlns="urn:xmpp:forward:0">
         *         <message xmlns="jabber:client" to="xsf@muc.xmpp.org" type="groupchat" from="xsf@muc.xmpp.org/i_am_groot">
         *             <body>I am groot.</body>
         *         </message>
         *         </forwarded>
         *     </received>
         * </message>
         */
        const msg = $msg({
                'from': sender_jid,
                'id': _converse.connection.getUniqueId(),
                'to': _converse.connection.jid,
                'type': 'groupchat',
                'xmlns': 'jabber:client'
            }).c('received', {'xmlns': 'urn:xmpp:carbons:2'})
              .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
              .c('message', {
                    'xmlns': 'jabber:client',
                    'from': impersonated_jid,
                    'to': muc_jid,
                    'type': 'groupchat'
            }).c('body').t('I am groot').tree();
        const view = _converse.chatboxviews.get(muc_jid);
        spyOn(converse.env.log, 'error');
        await _converse.handleMAMResult(view.model, { 'messages': [msg] });
        await u.waitUntil(() => converse.env.log.error.calls.count());
        expect(converse.env.log.error).toHaveBeenCalledWith(
            'Invalid Stanza: MUC messages SHOULD NOT be XEP-0280 carbon copied'
        );
        expect(view.querySelectorAll('.chat-msg').length).toBe(0);
        expect(view.model.messages.length).toBe(0);
    }));
});
