import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, sizzle, u, stx } = converse.env;

describe('A MUC message', function () {
    it(
        "saves the user's real JID as looked up via the XEP-0421 occupant id",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, nick, features);
            const occupant_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const presence = stx`
            <presence from="${muc_jid}/thirdwitch"
                    id="${u.getUniqueId()}"
                    to="${_converse.bare_jid}"
                    xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item jid="${occupant_jid}" />
                </x>
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="dd72603deec90a38ba552f7c68cbcc61bca202cd" />
            </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));

            const occupant = await u.waitUntil(() => model.getOccupantByNickname('thirdwitch'));
            expect(occupant.get('occupant_id')).toBe('dd72603deec90a38ba552f7c68cbcc61bca202cd');

            const stanza = stx`
            <message from='${muc_jid}/thirdwitch'
                    id='hysf1v37'
                    to='${_converse.bare_jid}'
                    type='groupchat'
                    xmlns="jabber:client">
                <body>Harpier cries: 'tis time, 'tis time.</body>
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="dd72603deec90a38ba552f7c68cbcc61bca202cd" />
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            await u.waitUntil(() => model.messages.length);
            expect(model.messages.at(0).get('occupant_id')).toBe('dd72603deec90a38ba552f7c68cbcc61bca202cd');
            expect(model.messages.at(0).get('from_real_jid')).toBe(occupant_jid);
        }),
    );

    it(
        'keeps track whether you are the sender or not',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const msg = stx`
                <message from="lounge@montague.lit/romeo"
                         id="${u.getUniqueId()}"
                         to="romeo@montague.lit"
                         type="groupchat"
                         xmlns="jabber:client">
                    <body>I wrote this message!</body>
                </message>`;
            await model.handleMessageStanza(msg);
            await u.waitUntil(() => model.messages.last()?.get('received'));
            expect(model.messages.last().get('sender')).toBe('me');
        }),
    );

    it(
        'gets updated with its stanza-id upon MUC reflection',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const muc_jid = 'room@muc.example.com';
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');

            model.sendMessage({ 'body': 'hello world' });
            await u.waitUntil(() => model.messages.length === 1);
            const msg = model.messages.at(0);
            expect(msg.get('stanza_id')).toBeUndefined();
            expect(msg.get('origin_id')).toBe(msg.get('origin_id'));

            const stanza = u.toStanza(`
            <message xmlns="jabber:client"
                     id="${msg.get('origin_id')}"
                     from="room@muc.example.com/romeo"
                     to="${_converse.api.connection.get().jid}"
                     type="groupchat">
                <body>Hello world</body>
                <stanza-id xmlns="urn:xmpp:sid:0"
                           id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                           by="room@muc.example.com"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="${msg.get('origin_id')}"/>
            </message>`);
            spyOn(model, 'updateMessage').and.callThrough();
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
            await u.waitUntil(() => model.updateMessage.calls.count() === 1);
            expect(model.messages.length).toBe(1);
            expect(model.messages.at(0).get('stanza_id room@muc.example.com')).toBe(
                '5f3dbc5e-e1d3-4077-a492-693f3769c7ad',
            );
            expect(model.messages.at(0).get('origin_id')).toBe(msg.get('origin_id'));
        }),
    );

    it(
        "is rejected if it's an unencapsulated forwarded message",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const impersonated_jid = `${muc_jid}/alice`;
            const received_stanza = stx`
            <message to='${_converse.jid}'
                    xmlns="jabber:client"
                    from='${muc_jid}/mallory'
                    type='groupchat'
                    id='${_converse.api.connection.get().getUniqueId()}'>
                <forwarded xmlns='urn:xmpp:forward:0'>
                    <delay xmlns='urn:xmpp:delay' stamp='2019-07-10T23:08:25Z'/>
                    <message from='${impersonated_jid}'
                            id='0202197'
                            to='${_converse.bare_jid}'
                            type='groupchat'
                            xmlns='jabber:client'>
                        <body>Yet I should kill thee with much cherishing.</body>
                    </message>
                </forwarded>
            </message>`;
            spyOn(converse.env.log, 'error').and.callThrough();
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, received_stanza));
            await u.waitUntil(() => converse.env.log.error.calls.count() === 1);
            expect(converse.env.log.error.calls.argsFor(0)[0]?.message).toBe(
                `Ignoring unencapsulated forwarded message from ${muc_jid}/mallory`,
            );
            const model = _converse.chatboxes.get(muc_jid);
            expect(model.messages.length).toBe(0);
        }),
    );

    it(
        'parses the correct body element',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const received_stanza = stx`
            <message xmlns="jabber:client" to='${_converse.jid}' from='${muc_jid}/mallory' type='groupchat' id='${_converse.api.connection.get().getUniqueId()}' >
                <reply xmlns='urn:xmpp:reply:0' id='${_converse.api.connection.get().getUniqueId()}' to='${_converse.jid}'/>
                <fallback xmlns='urn:xmpp:feature-fallback:0' for='urn:xmpp:reply:0'>
                    <body start='0' end='10'/>
                </fallback>
                <active xmlns='http://jabber.org/protocol/chatstates'/>
                <body>&gt; ping
    pong</body>
                <request xmlns='urn:xmpp:receipts'/>
            </message>
        `;
            await model.handleMessageStanza(received_stanza);
            await u.waitUntil(() => model.messages.last());
            expect(model.messages.last().get('body')).toBe('> ping\n    pong');
        }),
    );

    it(
        'does not overwrite its stanza-id when a follow-up message (e.g. reaction) arrives',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const muc_jid = 'room@muc.example.com';
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');

            // Receive an original MUC message with a server-assigned stanza-id
            await model.handleMessageStanza(stx`
                <message xmlns="jabber:client"
                         from="${muc_jid}/juliet"
                         to="${_converse.bare_jid}"
                         type="groupchat"
                         id="original-msg">
                    <body>Hello world</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="original-stanza-id"
                               by="${muc_jid}"/>
                </message>`);

            await u.waitUntil(() => model.messages.length === 1);
            const msg = model.messages.at(0);
            expect(msg.get(`stanza_id ${muc_jid}`)).toBe('original-stanza-id');

            // Receive a follow-up message (e.g. reaction) that references the original
            // and has its own stanza-id
            await model.handleMessageStanza(stx`
                <message xmlns="jabber:client"
                         from="${muc_jid}/juliet"
                         to="${_converse.bare_jid}"
                         type="groupchat"
                         id="reaction-msg">
                    <reactions xmlns="urn:xmpp:reactions:0" id="original-msg">
                        <reaction>👍</reaction>
                    </reactions>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="reaction-stanza-id"
                               by="${muc_jid}"/>
                </message>`);

            // The original message's stanza_id should NOT be overwritten
            expect(msg.get(`stanza_id ${muc_jid}`)).toBe('original-stanza-id');
            // The reaction should be applied
            expect(msg.get('reactions')).toBeTruthy();
        }),
    );

    it(
        'only gets the real JID of its sender from the presence of the occupant who currently has its nick',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features.filter((f) => f !== 'muc_anonymous'), 'muc_nonanonymous'];
            const members = [{ jid: 'juliet@capulet.lit', nick: 'juliet', affiliation: 'member' }];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features, members);
            await u.waitUntil(() => model.occupants.length === 2);
            const juliet = model.occupants.findWhere({ nick: 'juliet' });
            expect(juliet.get('jid')).toBe('juliet@capulet.lit');
            expect(juliet.get('presence')).toBe('offline');

            const conn = _converse.api.connection.get();
            const sendLiveMessage = (body) => {
                conn._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`<message from="${muc_jid}/juliet" type="groupchat" id="${u.getUniqueId()}" to="${_converse.bare_jid}" xmlns="jabber:client">
                            <body>${body}</body>
                        </message>`
                    )
                );
                return u.waitUntil(() => model.messages.findWhere({ body }));
            };

            // The nick of an offline member might be used by someone else
            let message = await sendLiveMessage('Who am I?');
            expect(message.get('from_real_jid')).toBeUndefined();

            conn._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<presence from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.bare_jid}" xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="member" role="participant" jid="juliet@capulet.lit/balcony"/>
                        </x>
                    </presence>`
                )
            );
            await u.waitUntil(() => juliet.get('presence') === 'online');
            message = await sendLiveMessage('It is I');
            expect(message.get('from_real_jid')).toBe('juliet@capulet.lit');

            // The nick of an archived message might since have been taken by someone else
            const iq = await u.waitUntil(() =>
                conn.IQ_stanzas.filter((iq) => sizzle('query[xmlns="urn:xmpp:mam:2"]', iq).length).pop()
            );
            const query_id = iq.querySelector('query').getAttribute('queryid');
            const archived = stx`
            <message to="${_converse.bare_jid}" from="${muc_jid}" xmlns="jabber:client">
                <result xmlns="urn:xmpp:mam:2" queryid="${query_id}" id="${u.getUniqueId()}">
                    <forwarded xmlns="urn:xmpp:forward:0">
                        <delay xmlns="urn:xmpp:delay" stamp="2020-01-01T00:00:00Z"/>
                        <message from="${muc_jid}/juliet" type="groupchat" id="${u.getUniqueId()}" xmlns="jabber:client">
                            <body>Years ago</body>
                        </message>
                    </forwarded>
                </result>
            </message>`;
            conn._dataRecv(mock.createRequest(_converse, archived));
            conn._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<iq type="result" id="${iq.getAttribute('id')}" xmlns="jabber:client"><fin xmlns="urn:xmpp:mam:2"/></iq>`
                )
            );
            message = await u.waitUntil(() => model.messages.findWhere({ body: 'Years ago' }));
            expect(message.get('from_real_jid')).toBeUndefined();

            // Likewise for a message from the room's history, replayed on joining
            conn._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<message from="${muc_jid}/juliet" type="groupchat" id="${u.getUniqueId()}" to="${_converse.bare_jid}" xmlns="jabber:client">
                        <body>Before you joined</body>
                        <delay xmlns="urn:xmpp:delay" from="${muc_jid}" stamp="2020-01-02T00:00:00Z"/>
                    </message>`
                )
            );
            message = await u.waitUntil(() => model.messages.findWhere({ body: 'Before you joined' }));
            expect(message.get('from_real_jid')).toBeUndefined();
        }),
    );

    it(
        "doesn't get the real JID of its sender from their nick in a semi-anonymous room",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const members = [{ jid: 'juliet@capulet.lit', nick: 'juliet', affiliation: 'member' }];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', [], members, true, {}, 'member', 'participant');
            await u.waitUntil(() => model.occupants.length === 2);
            const juliet = model.occupants.findWhere({ nick: 'juliet' });

            const conn = _converse.api.connection.get();
            conn._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<presence from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.bare_jid}" xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="member" role="participant"/>
                        </x>
                    </presence>`
                )
            );
            await u.waitUntil(() => juliet.get('presence') === 'online');
            // The JID from the member list is kept, but the presence didn't confirm it
            expect(juliet.get('jid')).toBe('juliet@capulet.lit');

            conn._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<message from="${muc_jid}/juliet" type="groupchat" id="${u.getUniqueId()}" to="${_converse.bare_jid}" xmlns="jabber:client">
                        <body>Hello</body>
                    </message>`
                )
            );
            const message = await u.waitUntil(() => model.messages.at(0));
            expect(message.getOccupant()).toBe(juliet);
            expect(message.get('from_real_jid')).toBeUndefined();
        }),
    );

    it(
        'gets the real JID of its sender from their nick in a semi-anonymous room in which the user is a moderator',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'lounge@montague.lit';
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', [], [], true, {}, 'admin', 'moderator');

            const conn = _converse.api.connection.get();
            conn._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<presence from="${muc_jid}/juliet" id="${u.getUniqueId()}" to="${_converse.bare_jid}" xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="none" role="participant" jid="juliet@capulet.lit/balcony"/>
                        </x>
                    </presence>`
                )
            );
            await u.waitUntil(() => model.occupants.findWhere({ nick: 'juliet' })?.get('presence') === 'online');

            conn._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<message from="${muc_jid}/juliet" type="groupchat" id="${u.getUniqueId()}" to="${_converse.bare_jid}" xmlns="jabber:client">
                        <body>Hello</body>
                    </message>`
                )
            );
            const message = await u.waitUntil(() => model.messages.at(0));
            expect(message.get('from_real_jid')).toBe('juliet@capulet.lit');
        }),
    );
});
