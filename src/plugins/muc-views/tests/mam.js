/*global mock, converse */

const { Strophe, $msg, $pres } = converse.env;
const u = converse.env.utils;

describe("A MAM archived message", function () {

    it("will appear in the correct order",
            mock.initConverse([], {}, async function (_converse) {

        const nick = 'romeo';
        const muc_jid = 'room@muc.example.com';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, nick);

        const messages = [
            u.toStanza(`
                <message to="${_converse.connection.jid}" from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="c03f0f53-8501-4ed9-9261-2eddd055486c" id="9fe1a9d9-c979-488c-93a4-8a3c4dcbc63e">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2021-10-13T17:51:20Z"/>
                            <message xmlns="jabber:client" xml:lang="en" from="${muc_jid}/dadmin" type="groupchat" id="bc4caee0-380a-4f08-b20b-9015177a95bb">
                                <body>first message</body>
                                <active xmlns="http://jabber.org/protocol/chatstates"/>
                                <origin-id xmlns="urn:xmpp:sid:0" id="bc4caee0-380a-4f08-b20b-9015177a95bb"/>
                            </message>
                        </forwarded>
                    </result>
                </message>`),

            u.toStanza(`
                <message to="${_converse.connection.jid}" from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="c03f0f53-8501-4ed9-9261-2eddd055486c" id="64f68d52-76e6-4fa6-93ef-9fbf96bb237b">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2021-10-13T17:51:25Z"/>
                            <message xmlns="jabber:client" xml:lang="en" from="${muc_jid}/dadmin" type="groupchat" id="7aae4842-6a8b-4a10-a9c4-47cc408650ef">
                                <body>2nd message</body>
                                <active xmlns="http://jabber.org/protocol/chatstates"/>
                                <origin-id xmlns="urn:xmpp:sid:0" id="7aae4842-6a8b-4a10-a9c4-47cc408650ef"/>
                            </message>
                        </forwarded>
                    </result>
                </message>`),

            u.toStanza(`
                <message to="${_converse.connection.jid}" from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="c03f0f53-8501-4ed9-9261-2eddd055486c" id="c2c07703-b285-4529-a4b4-12594f749c58">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2021-10-13T17:52:17Z"/>
                            <message xmlns="jabber:client" from="${muc_jid}" type="groupchat" id="hDs1J0QHfimjggw2">
                                <store xmlns="urn:xmpp:hints"/>
                                <event xmlns="http://jabber.org/protocol/pubsub#event">
                                    <items node="urn:ietf:params:xml:ns:conference-info">
                                        <item id="wGkBOwEymL2l10Fj">
                                            <conference-info xmlns="urn:ietf:params:xml:ns:conference-info">
                                                <activity xmlns="http://jabber.org/protocol/activity">
                                                    <other/>
                                                    <text id="activity-text">An anonymous user has tipped romeo 1 karma</text>
                                                    <reason>Thanks for your help the other day</reason>
                                                </activity>
                                            </conference-info>
                                        </item>
                                    </items>
                                </event>
                            </message>
                        </forwarded>
                    </result>
                </message>`),

            u.toStanza(`
                <message to="${_converse.connection.jid}" from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="c03f0f53-8501-4ed9-9261-2eddd055486c" id="c2b2b039-f808-4b4c-bfbd-607173e012f9">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2021-10-13T17:52:22Z"/>
                            <message xmlns="jabber:client" xml:lang="en" from="${muc_jid}/dadmin" type="groupchat" id="ae0ab34c-4ff1-45c0-ab56-5231cc220424">
                                <body>4th message</body>
                                <active xmlns="http://jabber.org/protocol/chatstates"/>
                                <origin-id xmlns="urn:xmpp:sid:0" id="ae0ab34c-4ff1-45c0-ab56-5231cc220424"/>
                            </message>
                        </forwarded>
                    </result>
                </message>`)
        ]
        spyOn(model, 'updateMessage');
        _converse.handleMAMResult(model, { messages });

        await u.waitUntil(() => model.messages.length === 4);
        expect(model.messages.at(0).get('time')).toBe('2021-10-13T17:51:20.000Z');
        expect(model.messages.at(1).get('time')).toBe('2021-10-13T17:51:25.000Z');
        expect(model.messages.at(2).get('time')).toBe('2021-10-13T17:52:17.000Z');
        expect(model.messages.at(3).get('time')).toBe('2021-10-13T17:52:22.000Z');
    }));

    it("is ignored if it has the same archive-id of an already received one",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'room@muc.example.com';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        spyOn(model, 'getDuplicateMessage').and.callThrough();
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
        await u.waitUntil(() => model.messages.length === 1);
        await u.waitUntil(() => model.getDuplicateMessage.calls.count() === 1);
        let result = await model.getDuplicateMessage.calls.all()[0].returnValue;
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

        spyOn(model, 'updateMessage');
        _converse.handleMAMResult(model, { 'messages': [stanza] });
        await u.waitUntil(() => model.getDuplicateMessage.calls.count() === 2);
        result = await model.getDuplicateMessage.calls.all()[1].returnValue;
        expect(result instanceof _converse.Message).toBe(true);
        expect(model.messages.length).toBe(1);
        await u.waitUntil(() => model.updateMessage.calls.count());
    }));

    it("will be discarded if it's a malicious message meant to look like a carbon copy",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        const muc_jid = 'xsf@muc.xmpp.org';
        const sender_jid = `${muc_jid}/romeo`;
        const impersonated_jid = `${muc_jid}/i_am_groot`
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
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
        await _converse.handleMAMResult(model, { 'messages': [msg] });
        await u.waitUntil(() => converse.env.log.error.calls.count());
        expect(converse.env.log.error).toHaveBeenCalledWith(
            'Invalid Stanza: MUC messages SHOULD NOT be XEP-0280 carbon copied'
        );
        expect(view.querySelectorAll('.chat-msg').length).toBe(0);
        expect(model.messages.length).toBe(0);
    }));
});
