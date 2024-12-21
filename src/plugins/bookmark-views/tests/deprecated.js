/* global mock, converse */
const { Strophe, sizzle, stx, u } = converse.env;

describe("A chat room", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("can be bookmarked", mock.initConverse(['chatBoxesFetched'], {}, async (_converse) => {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options'],
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

        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        modal.querySelector('converse-muc-bookmark-form .btn-primary').click();

        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('iq publish[node="storage:bookmarks"]', s).length).pop());
        expect(sent_stanza).toEqualStanza(
            stx`<iq to="romeo@montague.lit"
                    from="romeo@montague.lit"
                    id="${sent_stanza.getAttribute('id')}"
                    type="set"
                    xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="storage:bookmarks">
                        <item id="current">
                            <storage xmlns="storage:bookmarks">
                                <conference autojoin="true" jid="theplay@conference.shakespeare.lit" name="Play's the Thing">
                                    <nick>JC</nick>
                                </conference>
                            </storage>
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
        // Server acknowledges successful storage
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


    describe("when bookmarked", function () {

        it("can be unbookmarked", mock.initConverse([], {}, async function (_converse) {
            const { u } = converse.env;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(
                _converse,
                [],
                ['http://jabber.org/protocol/pubsub#publish-options'],
                'storage:bookmarks'
            );
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
                stx`<iq from="${_converse.bare_jid}"
                        to="${_converse.bare_jid}"
                        id="${sent_stanza.getAttribute('id')}"
                        type="set"
                        xmlns="jabber:client">
                    <pubsub xmlns="http://jabber.org/protocol/pubsub">
                        <publish node="storage:bookmarks">
                            <item id="current"><storage xmlns="storage:bookmarks"/></item>
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
        }));
    });
});

describe("Bookmarks", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("can be pushed from the XMPP server", mock.initConverse(
            ['connected', 'chatBoxesFetched'], {}, async function (_converse) {

        const { u } = converse.env;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(
            _converse,
            [],
            ['http://jabber.org/protocol/pubsub#publish-options'],
            'storage:bookmarks'
        );

        /* The stored data is automatically pushed to all of the user's connected resources.
         * Publisher receives event notification
         */
        let stanza = stx`<message from='romeo@montague.lit' to='${_converse.jid}' type='headline' id='${u.getUniqueId()}' xmlns="jabber:client">
            <event xmlns='http://jabber.org/protocol/pubsub#event'>
                <items node='storage:bookmarks'>
                    <item id='current'>
                        <storage xmlns='storage:bookmarks'>
                            <conference name="The Play's the Thing" autojoin="true" jid="theplay@conference.shakespeare.lit">
                                <nick>JC</nick>
                            </conference>
                            <conference name="Another bookmark" autojoin="false" jid="another@conference.shakespeare.lit">
                                <nick>JC</nick>
                            </conference>
                        </storage>
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

        stanza = stx`<message from='romeo@montague.lit' to='${_converse.jid}' type='headline' id='${u.getUniqueId()}' xmlns="jabber:client">
            <event xmlns='http://jabber.org/protocol/pubsub#event'>
                <items node='storage:bookmarks'>
                    <item id='current'>
                        <storage xmlns='storage:bookmarks'>
                            <conference name="The Play's the Thing" autojoin='true' jid='theplay@conference.shakespeare.lit'>
                                <nick>JC</nick>
                            </conference>
                            <conference name='Second bookmark' autojoin='false' jid='another@conference.shakespeare.lit'>
                                <nick>JC</nick>
                            </conference>
                            <conference name='Yet another bookmark' autojoin='false' jid='yab@conference.shakespeare.lit'>
                                <nick>JC</nick>
                            </conference>
                        </storage>
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

        const { Strophe, sizzle, u } = converse.env;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options'],
        );

        // Client requests all items
        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('items[node="storage:bookmarks"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(
            stx`<iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}" type="get" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <items node="storage:bookmarks"/>
                </pubsub>
            </iq>`
        );

        expect(_converse.bookmarks.models.length).toBe(0);
        spyOn(_converse.bookmarks, 'onBookmarksReceived').and.callThrough();

        // Server returns all items
        // Purposefully exclude the <nick> element to test #1043
        const stanza = stx`<iq to="${_converse.api.connection.get().jid}" type="result" id="${sent_stanza.getAttribute('id')}" xmlns="jabber:client">
            <pubsub xmlns="${Strophe.NS.PUBSUB}">
                <items node="storage:bookmarks">
                    <item id="current">
                        <storage xmlns="storage:bookmarks">
                            <conference name="The Play&apos;s the Thing" autojoin="true" jid="theplay@conference.shakespeare.lit">
                                <nick>JC</nick>
                            </conference>
                            <conference name="Another room" autojoin="false" jid="another@conference.shakespeare.lit"/>
                        </storage>
                    </item>
                </items>
            </pubsub>
        </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.bookmarks.onBookmarksReceived.calls.count());
        await _converse.api.waitUntil('bookmarksInitialized');
        expect(_converse.bookmarks.models.length).toBe(2);
        expect(_converse.bookmarks.get('theplay@conference.shakespeare.lit').get('autojoin')).toBe(true);
        expect(_converse.bookmarks.get('another@conference.shakespeare.lit').get('autojoin')).toBe(false);
    }));
});

describe("The bookmarks list modal", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("shows a list of bookmarks", mock.initConverse(
            ['chatBoxesFetched'], {},
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options'],
        );
        mock.openControlBox(_converse);

        const controlbox = _converse.chatboxviews.get('controlbox');
        const button = await u.waitUntil(() => controlbox.querySelector('.show-bookmark-list-modal'));
        button.click();

        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('items[node="storage:bookmarks"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(
            stx`<iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}" type="get" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <items node="storage:bookmarks"/>
                </pubsub>
            </iq>`
        );

        const stanza = stx`<iq to="${_converse.api.connection.get().jid}" type="result" id="${sent_stanza.getAttribute('id')}" xmlns="jabber:client">
            <pubsub xmlns="${Strophe.NS.PUBSUB}">
                <items node="storage:bookmarks">
                    <item id="current">
                        <storage xmlns="storage:bookmarks">
                            <conference name="The Play&apos;s the Thing" autojoin="false" jid="theplay@conference.shakespeare.lit">
                                <nick>JC</nick>
                            </conference>
                            <conference name="1st Bookmark" autojoin="false" jid="first@conference.shakespeare.lit">
                                <nick>JC</nick>
                            </conference>
                            <conference autojoin="false" jid="noname@conference.shakespeare.lit">
                                <nick>JC</nick>
                            </conference>
                            <conference name="Bookmark with a very very long name that will be shortened" autojoin="false" jid="longname@conference.shakespeare.lit">
                                <nick>JC</nick>
                            </conference>
                            <conference name="Another room" autojoin="false" jid="another@conference.shakespeare.lit">
                                <nick>JC</nick>
                            </conference>
                        </storage>
                    </item>
                </items>
            </pubsub>
        </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        const modal = _converse.api.modal.get('converse-bookmark-list-modal');
        await u.waitUntil(() => modal.querySelectorAll('.bookmarks.rooms-list .room-item').length);
        expect(modal.querySelectorAll('.bookmarks.rooms-list .room-item').length).toBe(5);
        let els = modal.querySelectorAll('.bookmarks.rooms-list .room-item a.list-item-link');
        expect(els[0].textContent).toBe("1st Bookmark");
        expect(els[1].textContent).toBe("Another room");
        expect(els[2].textContent).toBe("Bookmark with a very very long name that will be shortened");
        expect(els[3].textContent).toBe("noname@conference.shakespeare.lit");
        expect(els[4].textContent).toBe("The Play's the Thing");

        spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
        modal.querySelector('.bookmarks.rooms-list .room-item:nth-child(2) a:nth-child(2)').click();
        expect(_converse.api.confirm).toHaveBeenCalled();
        await u.waitUntil(() => modal.querySelectorAll('.bookmarks.rooms-list .room-item').length === 4)
        els = modal.querySelectorAll('.bookmarks.rooms-list .room-item a.list-item-link');
        expect(els[0].textContent).toBe("1st Bookmark");
        expect(els[1].textContent).toBe("Bookmark with a very very long name that will be shortened");
        expect(els[2].textContent).toBe("noname@conference.shakespeare.lit");
        expect(els[3].textContent).toBe("The Play's the Thing");
    }));

    it("can be used to open a MUC from a bookmark", mock.initConverse(
            ['chatBoxesFetched'], {'view_mode': 'fullscreen'},
            async function (_converse) {

        const api = _converse.api;

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options'],
        );
        mock.openControlBox(_converse);

        const controlbox = await _converse.chatboxviews.get('controlbox');
        controlbox.querySelector('.show-bookmark-list-modal').click();

        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('items[node="storage:bookmarks"]', s).length).pop());
        const stanza = stx`<iq to="${_converse.api.connection.get().jid}" type="result" id="${sent_stanza.getAttribute('id')}" xmlns="jabber:client">
            <pubsub xmlns="${Strophe.NS.PUBSUB}">
                <items node="storage:bookmarks">
                    <item id="current">
                        <storage xmlns="storage:bookmarks">
                            <conference name="The Play&apos;s the Thing" autojoin="false" jid="theplay@conference.shakespeare.lit">
                                <nick>JC</nick>
                            </conference>
                            <conference name="1st Bookmark" autojoin="false" jid="first@conference.shakespeare.lit">
                                <nick>JC</nick>
                            </conference>
                        </storage>
                    </item>
                </items>
            </pubsub>
        </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        const modal = api.modal.get('converse-bookmark-list-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        await u.waitUntil(() => modal.querySelectorAll('.bookmarks.rooms-list .room-item').length);
        expect(modal.querySelectorAll('.bookmarks.rooms-list .room-item').length).toBe(2);
        modal.querySelector('.bookmarks.rooms-list .open-room').click();
        await u.waitUntil(() => _converse.chatboxes.length === 2);
        expect((await api.rooms.get('first@conference.shakespeare.lit')).get('hidden')).toBe(false);

        await u.waitUntil(() => modal.querySelectorAll('.list-container--bookmarks .available-chatroom').length);
        modal.querySelector('.list-container--bookmarks .available-chatroom:last-child .open-room').click();
        await u.waitUntil(() => _converse.chatboxes.length === 3);

        expect((await api.rooms.get('first@conference.shakespeare.lit')).get('hidden')).toBe(true);
        expect((await api.rooms.get('theplay@conference.shakespeare.lit')).get('hidden')).toBe(false);

        controlbox.querySelector('.list-container--openrooms .open-room').click();
        await u.waitUntil(() => controlbox.querySelector('.list-item.open').getAttribute('data-room-jid') === 'first@conference.shakespeare.lit');
        expect((await api.rooms.get('first@conference.shakespeare.lit')).get('hidden')).toBe(false);
        expect((await api.rooms.get('theplay@conference.shakespeare.lit')).get('hidden')).toBe(true);
    }));
});
