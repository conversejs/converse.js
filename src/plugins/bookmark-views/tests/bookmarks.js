/* global mock, converse */
const { Strophe, sizzle, stx, u } = converse.env;

describe("A chat room", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe("when bookmarked", function () {

        it("will use the nickname from the bookmark", mock.initConverse([], {}, async function (_converse) {
            const { u } = converse.env;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'coven@chat.shakespeare.lit';
            const { bookmarks } = _converse.state;
            bookmarks.create({
                'jid': muc_jid,
                'autojoin': false,
                'name':  'The Play',
                'nick': 'Othello'
            });
            spyOn(_converse.ChatRoom.prototype, 'getAndPersistNickname').and.callThrough();
            const room_creation_promise = _converse.api.rooms.open(muc_jid);
            await mock.getRoomFeatures(_converse, muc_jid);
            const room = await room_creation_promise;
            await u.waitUntil(() => room.getAndPersistNickname.calls.count());
            expect(room.get('nick')).toBe('Othello');
        }));

        it("displays that it's bookmarked through its bookmark icon",
                mock.initConverse([], {}, async function (_converse) {

            const { u } = converse.env;
            await mock.waitForRoster(_converse, 'current', 0);
            mock.waitUntilDiscoConfirmed(
                _converse, _converse.bare_jid,
                [{'category': 'pubsub', 'type': 'pep'}],
                [
                    'http://jabber.org/protocol/pubsub#publish-options',
                    'urn:xmpp:bookmarks:1#compat'
                ]
            );

            const nick = 'romeo';
            const muc_jid = 'lounge@montague.lit';
            await _converse.api.rooms.open(muc_jid);
            await mock.getRoomFeatures(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, nick);

            const view = _converse.chatboxviews.get('lounge@montague.lit');
            expect(view.querySelector('.chatbox-title__text .fa-bookmark')).toBe(null);

            const { bookmarks } = _converse.state;
            bookmarks.create({
                'jid': view.model.get('jid'),
                'autojoin': false,
                'name':  'The lounge',
                'nick': ' some1'
            });
            view.model.set('bookmarked', true);
            await u.waitUntil(() => view.querySelector('.chatbox-title__text .fa-bookmark') !== null);
            view.model.set('bookmarked', false);
            await u.waitUntil(() => view.querySelector('.chatbox-title__text .fa-bookmark') === null);
        }));
    });
});

describe("Bookmarks", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("can be pushed from the XMPP server", mock.initConverse(
            ['connected', 'chatBoxesFetched'], {}, async function (_converse) {

        const { u } = converse.env;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(_converse);

        // The stored data is automatically pushed to all of the user's connected resources.
        // Publisher receives event notification
        let stanza = stx`<message from="romeo@montague.lit"
                            to="${_converse.jid}"
                            type="headline"
                            id="${u.getUniqueId()}"
                            xmlns="jabber:client">
            <event xmlns='http://jabber.org/protocol/pubsub#event'>
                <items node='urn:xmpp:bookmarks:1'>
                    <item id="theplay@conference.shakespeare.lit">
                        <conference xmlns="urn:xmpp:bookmarks:1"
                                name="The Play's the Thing"
                                autojoin="true" >
                            <nick>JC</nick>
                        </conference>
                    </item>
                    <item id="another@conference.shakespeare.lit">
                        <conference xmlns="urn:xmpp:bookmarks:1"
                                name="Another bookmark"
                                autojoin="false">
                            <nick>JC</nick>
                        </conference>
                    </item>
                </items>
            </event>
        </message>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        const { bookmarks } = _converse.state;
        await u.waitUntil(() => bookmarks.length);
        expect(bookmarks.length).toBe(2);
        expect(bookmarks.map(b => b.get('name'))).toEqual(['Another bookmark', "The Play's the Thing"]);
        expect(_converse.chatboxviews.get('theplay@conference.shakespeare.lit')).not.toBeUndefined();

        stanza = stx`<message from="romeo@montague.lit"
                        to="${_converse.jid}"
                        type="headline"
                        id="${u.getUniqueId()}"
                        xmlns="jabber:client">
            <event xmlns="http://jabber.org/protocol/pubsub#event">
                <items node="urn:xmpp:bookmarks:1">
                    <item id="theplay@conference.shakespeare.lit">
                        <conference xmlns="urn:xmpp:bookmarks:1" name="The Play's the Thing" autojoin="true">
                            <nick>JC</nick>
                        </conference>
                    </item>
                    <item id="another@conference.shakespeare.lit">
                        <conference xmlns="urn:xmpp:bookmarks:1" name="Second bookmark" autojoin="false">
                            <nick>JC</nick>
                        </conference>
                    </item>
                    <item id="yab@conference.shakespeare.lit">
                        <conference xmlns="urn:xmpp:bookmarks:1" name="Yet another bookmark" autojoin="false">
                            <nick>JC</nick>
                        </conference>
                    </item>
                </items>
            </event>
        </message>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => bookmarks.length === 3);
        expect(bookmarks.map(b => b.get('name'))).toEqual(
            ['Second bookmark', "The Play's the Thing", 'Yet another bookmark']
        );
        expect(_converse.chatboxviews.get('theplay@conference.shakespeare.lit')).not.toBeUndefined();
        expect(Object.keys(_converse.chatboxviews.getAll()).length).toBe(2);

        // Check that MUC is left when autojoin is set to false
        stanza = stx`<message from="romeo@montague.lit"
                        to="${_converse.jid}"
                        type="headline"
                        id="${u.getUniqueId()}"
                        xmlns="jabber:client">
            <event xmlns="http://jabber.org/protocol/pubsub#event">
                <items node="urn:xmpp:bookmarks:1">
                    <item id="theplay@conference.shakespeare.lit">
                        <conference xmlns="urn:xmpp:bookmarks:1" name="The Play's the Thing" autojoin="false">
                            <nick>JC</nick>
                        </conference>
                    </item>
                    <item id="another@conference.shakespeare.lit">
                        <conference xmlns="urn:xmpp:bookmarks:1" name="Second bookmark" autojoin="false">
                            <nick>JC</nick>
                        </conference>
                    </item>
                    <item id="yab@conference.shakespeare.lit">
                        <conference xmlns="urn:xmpp:bookmarks:1" name="Yet another bookmark" autojoin="false">
                            <nick>JC</nick>
                        </conference>
                    </item>
                </items>
            </event>
        </message>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => bookmarks.filter((b) => !b.get('autojoin')).length === 3);
        expect(bookmarks.map(b => b.get('name'))).toEqual(
            ['Second bookmark', "The Play's the Thing", 'Yet another bookmark']
        );
        expect(_converse.chatboxviews.get('theplay@conference.shakespeare.lit')).toBeUndefined();
        expect(Object.keys(_converse.chatboxviews.getAll()).length).toBe(1);
    }));

    it("can be retrieved from the XMPP server", mock.initConverse(
            ['chatBoxesFetched'], {},
            async function (_converse) {

        const { sizzle, u } = converse.env;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            [
                'http://jabber.org/protocol/pubsub#publish-options',
                'urn:xmpp:bookmarks:1#compat'
            ]
        );

        // Client requests all items
        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('items[node="urn:xmpp:bookmarks:1"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(
            stx`<iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}" type="get" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <items node="urn:xmpp:bookmarks:1"/>
                </pubsub>
            </iq>`
        );

        expect(_converse.bookmarks.models.length).toBe(0);
        spyOn(_converse.bookmarks, 'onBookmarksReceived').and.callThrough();

        // Server returns all items
        // Purposefully exclude the <nick> element to test #1043
        const stanza = stx`
            <iq xmlns="jabber:server"
                type="result"
                to="${_converse.jid}"
                id="${sent_stanza.getAttribute('id')}">
            <pubsub xmlns="http://jabber.org/protocol/pubsub">
                <items node="urn:xmpp:bookmarks:1">
                <item id="theplay@conference.shakespeare.lit">
                    <conference xmlns="urn:xmpp:bookmarks:1"
                                name="The Play's the Thing"
                                autojoin="true">
                    <nick>JC</nick>
                    </conference>
                </item>
                <item id="orchard@conference.shakespeare.lit">
                    <conference xmlns="urn:xmpp:bookmarks:1"
                                name="The Orchard"
                                autojoin="1">
                        <extensions>
                            <state xmlns="http://myclient.example/bookmark/state" minimized="true"/>
                        </extensions>
                    </conference>
                </item>
                </items>
            </pubsub>
            </iq>`;

        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.bookmarks.onBookmarksReceived.calls.count());
        await _converse.api.waitUntil('bookmarksInitialized');
        const { bookmarks } = _converse.state;
        expect(bookmarks.models.length).toBe(2);

        const theplay = bookmarks.get('theplay@conference.shakespeare.lit');
        expect(theplay.get('autojoin')).toBe(true);

        const orchard = bookmarks.get('orchard@conference.shakespeare.lit');
        expect(orchard.get('autojoin')).toBe(true);
        expect(orchard.get('extensions').length).toBe(1);
        expect(orchard.get('extensions')[0]).toBe('<state xmlns="http://myclient.example/bookmark/state" minimized="true"/>');
    }));

    it("can have a password which will be used to enter", mock.initConverse(
            ['chatBoxesFetched'], {},
            async function (_converse) {

        const autojoin_muc = "theplay@conference.shakespeare.lit";
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(_converse, [
            {
                jid: autojoin_muc,
                name: "The Play's the Thing",
                autojoin: true,
                nick: 'JC',
                password: 'secret',
            }, {
                jid: "orchard@conference.shakespeare.lit",
                name: "The Orchard",
            }
        ]);

        await _converse.api.waitUntil('bookmarksInitialized');
        const { bookmarks } = _converse.state;
        expect(bookmarks.models.length).toBe(2);

        const theplay = bookmarks.get(autojoin_muc);
        expect(theplay.get('autojoin')).toBe(true);
        expect(theplay.get('name')).toBe("The Play's the Thing");
        expect(theplay.get('nick')).toBe('JC');
        expect(theplay.get('password')).toBe('secret');

        expect(bookmarks.get('orchard@conference.shakespeare.lit').get('autojoin')).toBe(false);

        await u.waitUntil(() => _converse.state.chatboxes.get(autojoin_muc));
        const features = [
            'http://jabber.org/protocol/muc',
            'jabber:iq:register',
            'muc_passwordprotected',
        ];
        await mock.getRoomFeatures(_converse, autojoin_muc, features);

        const { sent_stanzas } = _converse.api.connection.get();
        const sent_stanza = await u.waitUntil(
            () => sent_stanzas.filter(s => s.getAttribute('to') === `${autojoin_muc}/JC`).pop());

        expect(sent_stanza).toEqualStanza(stx`
            <presence
                xmlns="jabber:client"
                from="${_converse.jid}"
                id="${sent_stanza.getAttribute('id')}"
                to="${autojoin_muc}/JC">
            <x xmlns="http://jabber.org/protocol/muc">
                <history/>
                <password>secret</password>
            </x>
            <c xmlns="http://jabber.org/protocol/caps"
               hash="sha-1"
               node="https://conversejs.org"
               ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ="/>
            </presence>`);
    }));
});
