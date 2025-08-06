/* global converse */
import mock from "../../../tests/mock.js";
const { sizzle, stx, u } = converse.env;

describe("A bookmark", function () {

    beforeEach(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("is automatically created when a MUC is entered", mock.initConverse(['chatBoxesFetched'], {}, async (_converse) => {
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(_converse);

        const nick = 'JC';
        const muc_jid = 'theplay@conference.shakespeare.lit';
        const settings = { name: "Play's the thing", password: 'secret' };
        const muc = await mock.openAndEnterMUC(_converse, muc_jid, nick, [], [], true, settings);

        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('iq publish[node="urn:xmpp:bookmarks:1"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(
            stx`<iq from="${_converse.bare_jid}"
                    to="${_converse.bare_jid}"
                    id="${sent_stanza.getAttribute('id')}"
                    type="set"
                    xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="urn:xmpp:bookmarks:1">
                        <item id="${muc.get('jid')}">
                            <conference xmlns="urn:xmpp:bookmarks:1" autojoin="true" name="${settings.name}">
                                <nick>${nick}</nick>
                                <password>${settings.password}</password>
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

        const stanza = stx`<iq
            xmlns="jabber:client"
            to="${_converse.api.connection.get().jid}"
            type="result"
            id="${sent_stanza.getAttribute('id')}"/>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        expect(muc.get('bookmarked')).toBeTruthy();
    }));

    it("will be updated when a user changes their nickname in a MUC", mock.initConverse(
        [], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(_converse);

        const nick = 'JC';
        const muc_jid = 'theplay@conference.shakespeare.lit';
        const settings = { name: "Play's the thing", password: 'secret' };
        const muc = await mock.openAndEnterMUC(_converse, muc_jid, nick, [], [], true, settings);

        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        let sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('iq publish[node="urn:xmpp:bookmarks:1"]', s).length).pop());

        const stanza = stx`<iq
            xmlns="jabber:client"
            to="${_converse.api.connection.get().jid}"
            type="result"
            id="${sent_stanza.getAttribute('id')}"/>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        const newnick = 'BAP';
        muc.setNickname(newnick);

        const sent_IQs = _converse.api.connection.get().IQ_stanzas;
        while (sent_IQs.length) { sent_IQs.pop(); }

        _converse.api.connection.get()._dataRecv(mock.createRequest(
            stx`<presence
                    xmlns="jabber:server"
                    from='${muc_jid}/${nick}'
                    id='DC352437-C019-40EC-B590-AF29E879AF98'
                    to='${_converse.jid}'
                    type='unavailable'>
                <x xmlns='http://jabber.org/protocol/muc#user'>
                    <item affiliation='member'
                        jid='${_converse.jid}'
                        nick='${newnick}'
                        role='participant'/>
                    <status code='303'/>
                    <status code='110'/>
                </x>
            </presence>`
        ));

        await u.waitUntil(() => muc.get('nick') === newnick);

        _converse.api.connection.get()._dataRecv(mock.createRequest(
            stx`<presence
                    xmlns="jabber:server"
                    from='${muc_jid}/${newnick}'
                    id='5B4F27A4-25ED-43F7-A699-382C6B4AFC67'
                    to='${_converse.jid}'>
                <x xmlns='http://jabber.org/protocol/muc#user'>
                    <item affiliation='member'
                        jid='${_converse.jid}'
                        role='participant'/>
                    <status code='110'/>
                </x>
            </presence>`
        ));

        sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('iq publish[node="urn:xmpp:bookmarks:1"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(
            stx`<iq from="${_converse.bare_jid}"
                    to="${_converse.bare_jid}"
                    id="${sent_stanza.getAttribute('id')}"
                    type="set"
                    xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="urn:xmpp:bookmarks:1">
                        <item id="${muc_jid}">
                            <conference xmlns="urn:xmpp:bookmarks:1" name="${settings.name}" autojoin="true">
                                <nick>${newnick}</nick>
                                <password>${settings.password}</password>
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
    }));

    describe("when autojoin is set", function () {

        it("will cause a MUC to be opened and joined automatically upon login", mock.initConverse(
                [], {}, async function (_converse) {

            const { api, state } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            spyOn(_converse.api.rooms, 'create').and.callThrough();

            const { bookmarks } = _converse.state;

            let jid = 'theplay@conference.shakespeare.lit';
            const model = bookmarks.create({
                jid,
                autojoin: false,
                name:  'The Play',
                nick: ''
            });
            expect(_converse.api.rooms.create).not.toHaveBeenCalled();

            // Check that we don't auto-join if muc_respect_autojoin is false
            api.settings.set('muc_respect_autojoin', false);
            bookmarks.create({
                jid,
                autojoin: true,
                name:  'The Play',
                nick: ''
            });
            expect(_converse.api.rooms.create).not.toHaveBeenCalled();

            api.settings.set('muc_respect_autojoin', true);
            bookmarks.remove(model);

            bookmarks.create({
                jid,
                autojoin: true,
                name:  'Hamlet',
                nick: ''
            });
            expect(_converse.api.rooms.create).toHaveBeenCalled();

            await mock.waitForMUCDiscoInfo(_converse, jid);
            await mock.waitForReservedNick(_converse, jid, '');
            await u.waitUntil(() => state.chatboxes.length === 1);

            bookmarks.remove(model);
            await u.waitUntil(() => state.chatboxes.length === 0);
        }));

        it("has autojoin set to false upon leaving", mock.initConverse([], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const nick = 'romeo';
            const muc_jid = 'theplay@conference.shakespeare.lit';
            const settings = { name:  'The Play' };
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, nick, [], [], true, settings);

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
                        <publish node="urn:xmpp:bookmarks:1">
                            <item id="${muc_jid}">
                                <conference xmlns="urn:xmpp:bookmarks:1" name="${settings.name}" autojoin="false">
                                    <nick>${nick}</nick>
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
        }));
    });

    it("can be created and sends out a stanza", mock.initConverse(
            ['connected', 'chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(_converse);

        const bare_jid = _converse.session.get('bare_jid');
        const muc1_jid = 'theplay@conference.shakespeare.lit';
        const { api } = _converse;

        await api.bookmarks.set({
            jid: muc1_jid,
            autojoin: true,
            name:  'Hamlet',
            nick: ''
        });

        const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
        let sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('publish[node="urn:xmpp:bookmarks:1"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(stx`
            <iq from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
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
        await api.bookmarks.set({
            jid: muc2_jid,
            autojoin: true,
            name:  'Balcony',
            nick: 'romeo'
        });

        sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('publish[node="urn:xmpp:bookmarks:1"] conference[name="Balcony"]', s).length).pop());

        expect(sent_stanza).toEqualStanza(stx`
            <iq from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="urn:xmpp:bookmarks:1">
                        <item id="${muc2_jid}">
                            <conference xmlns="urn:xmpp:bookmarks:1" autojoin="true" name="Balcony">
                                <nick>romeo</nick>
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
            </iq>`);

        const muc3_jid = 'garden@conference.shakespeare.lit';
        await api.bookmarks.set({
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
            <iq xmlns="jabber:client" type="set" from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="urn:xmpp:bookmarks:1">
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

    it("handles missing bookmarks gracefully when server responds with item-not-found", mock.initConverse(
        ['chatBoxesFetched'], {}, async (_converse) => {

            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilDiscoConfirmed(
                _converse, _converse.bare_jid,
                [{'category': 'pubsub', 'type': 'pep'}],
                ['http://jabber.org/protocol/pubsub#publish-options', 'urn:xmpp:bookmarks:1#compat']
            );

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const sent_stanza = await u.waitUntil(
                () => IQ_stanzas.filter(s => sizzle(`items[node="urn:xmpp:bookmarks:1"]`, s).length).pop());

            // Simulate server response with item-not-found error
            const error_stanza = stx`
                <iq xmlns="jabber:client" type="error"
                        id="${sent_stanza.getAttribute('id')}"
                        from="${sent_stanza.getAttribute('to')}"
                        to="${sent_stanza.getAttribute('from')}">
                    <pubsub xmlns="http://jabber.org/protocol/pubsub">
                        <items node="urn:xmpp:bookmarks:1"/>
                    </pubsub>
                    <error code="404" type="cancel">
                        <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(error_stanza));

            const cache_key = `converse.room-bookmarksromeo@montague.litfetched`;
            const result = await u.waitUntil(() => window.sessionStorage.getItem(cache_key));
            expect(result).toBe('true');
        })
    );
});
