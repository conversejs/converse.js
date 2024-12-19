/* global mock, converse */
const { Strophe, sizzle, stx, u } = converse.env;


describe("A chat room", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("can be bookmarked", mock.initConverse(['chatBoxesFetched'], {}, async (_converse) => {
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            [
                'http://jabber.org/protocol/pubsub#publish-options',
                'urn:xmpp:bookmarks:1#compat'
            ]
        );

        const nick = 'JC';
        const muc_jid = 'theplay@conference.shakespeare.lit';
        await mock.openChatRoom(_converse, 'theplay', 'conference.shakespeare.lit', 'JC');
        await mock.getRoomFeatures(_converse, muc_jid, []);
        await mock.waitForReservedNick(_converse, muc_jid, nick);
        await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);
        await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
        await mock.returnMemberLists(_converse, muc_jid, [], ['member', 'admin', 'owner']);

        await u.waitUntil(() => view.querySelector('.toggle-bookmark') !== null);

        const toggle = view.querySelector('.toggle-bookmark');
        expect(toggle.title).toBe('Bookmark this groupchat');
        toggle.click();

        const modal = _converse.api.modal.get('converse-bookmark-form-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        expect(view.model.get('bookmarked')).toBeFalsy();
        const form = await u.waitUntil(() => modal.querySelector('.chatroom-form'));
        form.querySelector('input[name="name"]').value = "Play's the Thing";
        form.querySelector('input[name="autojoin"]').checked = 'checked';
        form.querySelector('input[name="nick"]').value = 'JC';
        form.querySelector('input[name="password"]').value = 'secret';

        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        modal.querySelector('converse-muc-bookmark-form .btn-primary').click();

        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('iq publish[node="urn:xmpp:bookmarks:1"]', s).length).pop());
        expect(sent_stanza).toEqualStanza(
            stx`<iq from="romeo@montague.lit" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="urn:xmpp:bookmarks:1">
                        <item id="${view.model.get('jid')}">
                            <conference xmlns="urn:xmpp:bookmarks:1" autojoin="true" name="Play's the Thing">
                                <nick>JC</nick>
                                <password>secret</password>
                            </conference>
                        </item>
                    </publish>
                    <publish-options>
                        <x type="submit" xmlns="jabber:x:data">
                            <field type="hidden" var="FORM_TYPE">
                                <value>http://jabber.org/protocol/pubsub#publish-options</value>
                            </field>
                            <field var='pubsub#persist_items'>
                                <value>true</value>
                            </field>
                            <field var='pubsub#max_items'>
                                <value>max</value>
                            </field>
                            <field var='pubsub#send_last_published_item'>
                                <value>never</value>
                            </field>
                            <field var='pubsub#access_model'>
                                <value>whitelist</value>
                            </field>
                        </x>
                    </publish-options>
                </pubsub>
            </iq>`
        );
        /* Server acknowledges successful storage
         * <iq to='juliet@capulet.lit/balcony' type='result' id='pip1'/>
         */
        const stanza = stx`<iq
            xmlns="jabber:client"
            to="${_converse.api.connection.get().jid}"
            type="result"
            id="${sent_stanza.getAttribute('id')}"/>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.model.get('bookmarked'));
        expect(view.model.get('bookmarked')).toBeTruthy();
        expect(u.hasClass('on-button', view.querySelector('.toggle-bookmark')), true);
        // We ignore this IQ stanza... (unless it's an error stanza), so
        // nothing to test for here.
    }));


    it("will be automatically opened if 'autojoin' is set on the bookmark", mock.initConverse(
            ['chatBoxesFetched'], {}, async function (_converse) {

        const { u } = converse.env;
        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );
        await u.waitUntil(() => _converse.state.bookmarks);
        const { bookmarks } = _converse.state;
        let jid = 'lounge@montague.lit';
        bookmarks.create({
            'jid': jid,
            'autojoin': false,
            'name':  'The Lounge',
            'nick': ' Othello'
        });
        expect(_converse.chatboxviews.get(jid) === undefined).toBeTruthy();

        jid = 'theplay@conference.shakespeare.lit';
        bookmarks.create({
            'jid': jid,
            'autojoin': true,
            'name':  'The Play',
            'nick': ' Othello'
        });
        await new Promise(resolve => _converse.api.listen.once('chatRoomViewInitialized', resolve));
        expect(!!_converse.chatboxviews.get(jid)).toBe(true);

        // Check that we don't auto-join if muc_respect_autojoin is false
        api.settings.set('muc_respect_autojoin', false);
        jid = 'balcony@conference.shakespeare.lit';
        bookmarks.create({
            'jid': jid,
            'autojoin': true,
            'name':  'Balcony',
            'nick': ' Othello'
        });
        expect(_converse.chatboxviews.get(jid) === undefined).toBe(true);
    }));


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

        it("can be unbookmarked", mock.initConverse([], {}, async function (_converse) {
            const { u } = converse.env;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const nick = 'romeo';
            const muc_jid = 'theplay@conference.shakespeare.lit';
            await _converse.api.rooms.open(muc_jid);
            await mock.getRoomFeatures(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, nick);

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('.toggle-bookmark'));

            const { bookmarks } = _converse.state;

            spyOn(view, 'showBookmarkModal').and.callThrough();
            spyOn(bookmarks, 'sendBookmarkStanza').and.callThrough();

            bookmarks.create({
                'jid': view.model.get('jid'),
                'autojoin': false,
                'name':  'The Play',
                'nick': 'Othello'
            });

            expect(bookmarks.length).toBe(1);
            await u.waitUntil(() => _converse.chatboxes.length >= 1);
            expect(view.model.get('bookmarked')).toBeTruthy();
            await u.waitUntil(() => view.querySelector('.chatbox-title__text .fa-bookmark') !== null);
            spyOn(_converse.api.connection.get(), 'getUniqueId').and.callThrough();
            const bookmark_icon = view.querySelector('.toggle-bookmark');
            bookmark_icon.click();
            expect(view.showBookmarkModal).toHaveBeenCalled();

            const modal = _converse.api.modal.get('converse-bookmark-form-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);
            const form = await u.waitUntil(() => modal.querySelector('.chatroom-form'));

            expect(form.querySelector('input[name="name"]').value).toBe('The Play');
            expect(form.querySelector('input[name="autojoin"]').checked).toBeFalsy();
            expect(form.querySelector('input[name="nick"]').value).toBe('Othello');

            // Remove the bookmark
            modal.querySelector('.button-remove').click();

            await u.waitUntil(() => view.querySelector('.chatbox-title__text .fa-bookmark') === null);
            expect(bookmarks.length).toBe(0);

            // Check that an IQ stanza is sent out, containing no
            // conferences to bookmark (since we removed the one and
            // only bookmark).
            const sent_stanza = _converse.api.connection.get().IQ_stanzas.pop();
            expect(sent_stanza).toEqualStanza(
                stx`<iq from="romeo@montague.lit" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                    <pubsub xmlns="http://jabber.org/protocol/pubsub">
                        <publish node="urn:xmpp:bookmarks:1"/>
                        <publish-options>
                            <x type="submit" xmlns="jabber:x:data">
                                <field type="hidden" var="FORM_TYPE">
                                    <value>http://jabber.org/protocol/pubsub#publish-options</value>
                                </field>
                                <field var='pubsub#persist_items'>
                                    <value>true</value>
                                </field>
                                <field var='pubsub#max_items'>
                                    <value>max</value>
                                </field>
                                <field var='pubsub#send_last_published_item'>
                                    <value>never</value>
                                </field>
                                <field var='pubsub#access_model'>
                                    <value>whitelist</value>
                                </field>
                            </x>
                        </publish-options>
                    </pubsub>
                </iq>`
            );
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
