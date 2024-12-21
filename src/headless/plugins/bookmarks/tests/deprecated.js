const { sizzle, stx, u } = converse.env;

describe("A bookmark", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

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

        bookmarks.createBookmark({
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
        bookmarks.createBookmark({
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
