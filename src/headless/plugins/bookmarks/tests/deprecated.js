const { sizzle, stx, u } = converse.env;

describe("A chat room", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("is automatically bookmarked when opened", mock.initConverse(['chatBoxesFetched'], {}, async (_converse) => {
        const { bare_jid } = _converse;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            [ 'http://jabber.org/protocol/pubsub#publish-options' ]
        );

        const nick = 'JC';
        const muc_jid = 'theplay@conference.shakespeare.lit';
        const settings = { name: "Play's the thing", password: 'secret' };
        const muc = await mock.openAndEnterChatRoom(_converse, muc_jid, nick, [], [], true, settings);

        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('iq publish[node="storage:bookmarks"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(
            stx`<iq from="${_converse.bare_jid}"
                    to="${_converse.bare_jid}"
                    id="${sent_stanza.getAttribute('id')}"
                    type="set"
                    xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="storage:bookmarks">
                        <item id="current">
                            <storage xmlns="storage:bookmarks">
                                <conference autojoin="true" jid="${muc_jid}" name="${settings.name}">
                                    <nick>${nick}</nick>
                                    <password>${settings.password}</password>
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

        /* Server acknowledges successful storage
         * <iq to='juliet@capulet.lit/balcony' type='result' id='pip1'/>
         */
        const stanza = stx`<iq
            xmlns="jabber:client"
            to="${_converse.api.connection.get().jid}"
            type="result"
            id="${sent_stanza.getAttribute('id')}"/>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        expect(muc.get('bookmarked')).toBeTruthy();
    }));
});

describe("A bookmark", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("has autojoin set to false upon leaving", mock.initConverse([], {}, async function (_converse) {
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
        const settings = { name:  'The Play' };
        const muc = await mock.openAndEnterChatRoom(_converse, muc_jid, nick, [], [], true, settings);

        const { bookmarks } = _converse.state;
        await u.waitUntil(() => bookmarks.length);
        await u.waitUntil(() => muc.get('bookmarked'));
        spyOn(bookmarks, 'sendBookmarkStanza').and.callThrough();

        const sent_IQs = _converse.api.connection.get().IQ_stanzas;
        while (sent_IQs.length) { sent_IQs.pop(); }

        await muc.close();
        await u.waitUntil(() => sent_IQs.length);

        // Check that an IQ stanza is sent out, containing no
        // conferences to bookmark (since we removed the one and
        // only bookmark).
        const sent_stanza = sent_IQs.pop();
        expect(sent_stanza).toEqualStanza(
            stx`<iq from="${_converse.bare_jid}"
                    to="${_converse.bare_jid}"
                    id="${sent_stanza.getAttribute('id')}"
                    type="set"
                    xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="storage:bookmarks">
                    <item id="current">
                        <storage xmlns="storage:bookmarks">
                            <conference jid="${muc_jid}" name="${settings.name}" autojoin="false">
                                <nick>${nick}</nick>
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
    }));

    it("can be created and sends out a stanza", mock.initConverse(
            ['connected', 'chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(
            _converse,
            [],
            ['http://jabber.org/protocol/pubsub#publish-options'],
            'storage:bookmarks'
        );

        const bare_jid = _converse.session.get('bare_jid');
        const muc1_jid = 'theplay@conference.shakespeare.lit';
        const { bookmarks } = _converse.state;

        bookmarks.setBookmark({
            jid: muc1_jid,
            autojoin: true,
            name:  'Hamlet',
            nick: ''
        });

        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        let sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('item[id="current"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(stx`
            <iq from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="storage:bookmarks">
                        <item id="current">
                            <storage xmlns="storage:bookmarks">
                                <conference autojoin="true" jid="${muc1_jid}" name="Hamlet"/>
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
            </iq>`);


        const muc2_jid = 'balcony@conference.shakespeare.lit';
        bookmarks.setBookmark({
            jid: muc2_jid,
            autojoin: true,
            name:  'Balcony',
            nick: 'romeo'
        });

        sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('item[id="current"] conference[name="Balcony"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(stx`
            <iq from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="storage:bookmarks">
                        <item id="current">
                            <storage xmlns="storage:bookmarks">
                                <conference autojoin="true" jid="${muc2_jid}" name="Balcony">
                                    <nick>romeo</nick>
                                </conference>
                                <conference autojoin="true" jid="${muc1_jid}" name="Hamlet"/>
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
            </iq>`);
    }));
});
