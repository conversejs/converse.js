/* global mock, converse */
const { Strophe, sizzle, stx, u } = converse.env;

describe("A chat room", function () {

    describe("when autojoin is set", function () {

        it("will be be opened and joined automatically upon login", mock.initConverse(
                [], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            spyOn(_converse.api.rooms, 'create').and.callThrough();
            const jid = 'theplay@conference.shakespeare.lit';
            const { bookmarks } = _converse.state;
            const model = bookmarks.create({
                'jid': jid,
                'autojoin': false,
                'name':  'The Play',
                'nick': ''
            });
            expect(_converse.api.rooms.create).not.toHaveBeenCalled();
            bookmarks.remove(model);
            bookmarks.create({
                'jid': jid,
                'autojoin': true,
                'name':  'Hamlet',
                'nick': ''
            });
            expect(_converse.api.rooms.create).toHaveBeenCalled();
        }));
    });
});


describe("A bookmark", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("can be created and sends out a stanza", mock.initConverse(
            ['connected', 'chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(_converse);

        const jid = _converse.session.get('jid');
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
            () => IQ_stanzas.filter(s => sizzle('publish[node="urn:xmpp:bookmarks:1"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(stx`
            <iq from="${jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="urn:xmpp:bookmarks:1">
                        <item id="${muc1_jid}">
                            <conference xmlns="urn:xmpp:bookmarks:1" autojoin="true" name="Hamlet"/>
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
            () => IQ_stanzas.filter(s => sizzle('publish[node="urn:xmpp:bookmarks:1"] conference[name="Balcony"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(stx`
            <iq from="${jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="urn:xmpp:bookmarks:1">
                        <item id="${muc2_jid}">
                            <conference xmlns="urn:xmpp:bookmarks:1" autojoin="true" name="Balcony">
                                <nick>romeo</nick>
                            </conference>
                        </item>
                        <item id="${muc1_jid}">
                            <conference xmlns="urn:xmpp:bookmarks:1" autojoin="true" name="Hamlet"/>
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

        const muc3_jid = 'garden@conference.shakespeare.lit';
        bookmarks.createBookmark({
            jid: muc3_jid,
            autojoin: false,
            name:  'Garden',
            nick: 'r0meo',
            password: 'secret',
            extensions: [
                '<state xmlns="http://myclient.example/bookmark/state" minimized="true"/>',
                '<levels xmlns="http://myclient.example/bookmark/levels" amount="9000"/>',
            ],
        });

        sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('publish[node="urn:xmpp:bookmarks:1"] conference[name="Garden"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(stx`
            <iq xmlns="jabber:client" type="set" from="${jid}" id="${sent_stanza.getAttribute('id')}">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="urn:xmpp:bookmarks:1">
                        <item id="${muc2_jid}">
                            <conference xmlns="urn:xmpp:bookmarks:1" autojoin="true" name="Balcony">
                                <nick>romeo</nick>
                            </conference>
                        </item>
                        <item id="${muc3_jid}">
                            <conference xmlns="urn:xmpp:bookmarks:1" autojoin="false" name="Garden">
                                <nick>r0meo</nick>
                                <password>secret</password>
                                <extensions>
                                    <state xmlns="http://myclient.example/bookmark/state" minimized="true"/>
                                    <levels xmlns="http://myclient.example/bookmark/levels" amount="9000"/>
                                </extensions>
                            </conference>
                        </item>
                        <item id="${muc1_jid}">
                            <conference xmlns="urn:xmpp:bookmarks:1" autojoin="true" name="Hamlet"/>
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
