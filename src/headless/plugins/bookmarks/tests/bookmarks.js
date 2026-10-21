import { vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, sizzle, stx, u } = converse.env;

async function acknowledgeBookmarkPublish(_converse, operation, selector) {
    const connection = _converse.api.connection.get();
    const sent_stanza = await u.waitUntil(() =>
        connection.IQ_stanzas.filter((stanza) => sizzle(selector, stanza).length).pop(),
    );
    const result = stx`<iq xmlns="jabber:client"
        to="${connection.jid}"
        type="result"
        id="${sent_stanza.getAttribute('id')}"/>`;
    connection._dataRecv(mock.createRequest(_converse, result));
    const bookmark = await operation;
    return { bookmark, sent_stanza };
}

describe('A bookmark', function () {
    it(
        'is automatically created when a MUC is entered',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const nick = 'JC';
            const muc_jid = 'theplay@conference.shakespeare.lit';
            const settings = { name: "Play's the thing", password: 'secret' };
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, nick, [], [], true, settings);

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const sent_stanza = await u.waitUntil(() =>
                IQ_stanzas.filter((s) => sizzle(`iq publish[node="${Strophe.NS.BOOKMARKS2}"]`, s).length).pop(),
            );

            expect(sent_stanza).toEqualStanza(
                stx`<iq from="${_converse.bare_jid}"
                    to="${_converse.bare_jid}"
                    id="${sent_stanza.getAttribute('id')}"
                    type="set"
                    xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="${Strophe.NS.BOOKMARKS2}">
                        <item id="${muc.get('jid')}">
                            <conference xmlns="${Strophe.NS.BOOKMARKS2}" autojoin="true" name="${settings.name}">
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
            </iq>`,
            );

            const stanza = stx`<iq
            xmlns="jabber:client"
            to="${_converse.api.connection.get().jid}"
            type="result"
            id="${sent_stanza.getAttribute('id')}"/>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            expect(_converse.state.bookmarks.get(muc.get('jid'))).toBeTruthy();
        }),
    );

    it(
        'will be updated when a user changes their nickname in a MUC',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const nick = 'JC';
            const muc_jid = 'theplay@conference.shakespeare.lit';
            const settings = { name: "Play's the thing", password: 'secret' };
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, nick, [], [], true, settings);

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            let sent_stanza = await u.waitUntil(() =>
                IQ_stanzas.filter((s) => sizzle(`iq publish[node="${Strophe.NS.BOOKMARKS2}"]`, s).length).pop(),
            );

            const stanza = stx`<iq
            xmlns="jabber:client"
            to="${_converse.api.connection.get().jid}"
            type="result"
            id="${sent_stanza.getAttribute('id')}"/>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            const newnick = 'BAP';
            muc.setNickname(newnick);

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            while (sent_IQs.length) {
                sent_IQs.pop();
            }

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
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
            </presence>`,
                ),
            );

            await u.waitUntil(() => muc.get('nick') === newnick);

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
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
            </presence>`,
                ),
            );

            sent_stanza = await u.waitUntil(() =>
                IQ_stanzas.filter((s) => sizzle(`iq publish[node="${Strophe.NS.BOOKMARKS2}"]`, s).length).pop(),
            );

            expect(sent_stanza).toEqualStanza(
                stx`<iq from="${_converse.bare_jid}"
                    to="${_converse.bare_jid}"
                    id="${sent_stanza.getAttribute('id')}"
                    type="set"
                    xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="${Strophe.NS.BOOKMARKS2}">
                        <item id="${muc_jid}">
                            <conference xmlns="${Strophe.NS.BOOKMARKS2}" name="${settings.name}" autojoin="true">
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
            </iq>`,
            );
        }),
    );

    describe('when autojoin is set', function () {
        it(
            'will cause a MUC to be opened and joined automatically upon login',
            mock.initConverse(converse, [], {}, async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 0);
                await mock.waitUntilBookmarksReturned(_converse);
                spyOn(_converse.api.rooms, 'create').and.callThrough();

                const { bookmarks } = _converse.state;

                const jid = 'theplay@conference.shakespeare.lit';
                const model = bookmarks.create({
                    jid,
                    autojoin: false,
                    name: 'The Play',
                    nick: '',
                });
                expect(_converse.api.rooms.create).not.toHaveBeenCalled();

                // Check that we don't auto-join if muc_respect_autojoin is false
                api.settings.set('muc_respect_autojoin', false);
                bookmarks.create({
                    jid,
                    autojoin: true,
                    name: 'The Play',
                    nick: '',
                });
                expect(_converse.api.rooms.create).not.toHaveBeenCalled();

                api.settings.set('muc_respect_autojoin', true);
                bookmarks.remove(model);

                bookmarks.create({
                    jid,
                    autojoin: true,
                    name: 'Hamlet',
                    nick: '',
                });
                expect(_converse.api.rooms.create).toHaveBeenCalled();

                await mock.waitForMUCDiscoInfo(_converse, jid);
                await mock.waitForReservedNick(_converse, jid, '');
                await u.waitUntil(() => state.chatboxes.length === 1);

                bookmarks.remove(model);
                await u.waitUntil(() => state.chatboxes.length === 0);
            }),
        );

        it(
            'has autojoin set to false upon leaving',
            mock.initConverse(converse, [], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);
                await mock.waitUntilBookmarksReturned(_converse);

                const nick = 'romeo';
                const muc_jid = 'theplay@conference.shakespeare.lit';
                const settings = { name: 'The Play' };
                const muc = await mock.openAndEnterMUC(_converse, muc_jid, nick, [], [], true, settings);

                const { bookmarks } = _converse.state;
                await u.waitUntil(() => bookmarks.length);
                await u.waitUntil(() => bookmarks.get(muc_jid));
                const sent_IQs = _converse.api.connection.get().IQ_stanzas;
                await u.waitUntil(() =>
                    sent_IQs.some((s) => sizzle(`iq publish[node="${Strophe.NS.BOOKMARKS2}"]`, s).length),
                );
                spyOn(bookmarks, 'sendBookmarkStanza').and.callThrough();
                while (sent_IQs.length) {
                    sent_IQs.pop();
                }

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
                        <publish node="${Strophe.NS.BOOKMARKS2}">
                            <item id="${muc_jid}">
                                <conference xmlns="${Strophe.NS.BOOKMARKS2}" name="${settings.name}" autojoin="false">
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
                </iq>`,
                );
            }),
        );
    });

    it(
        'waits for a new bookmark to be persisted and published before resolving',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const attrs = {
                jid: 'theplay@conference.shakespeare.lit',
                autojoin: false,
                name: 'The Play',
            };
            const { bookmarks } = _converse.state;
            const bookmark = new bookmarks.model(attrs);
            const persisted = Promise.withResolvers();
            const published = Promise.withResolvers();
            const create = vi.spyOn(bookmarks, 'create').mockReturnValue(persisted.promise);
            const publish = vi.spyOn(bookmarks, 'sendBookmarkStanza').mockReturnValue(published.promise);

            const operation = bookmarks.setBookmark(attrs);
            let resolved = false;
            operation.then(() => (resolved = true));

            await Promise.resolve();
            expect(create).toHaveBeenCalledWith(attrs, { promise: true });
            expect(publish).not.toHaveBeenCalled();
            expect(resolved).toBe(false);

            persisted.resolve(bookmark);
            await u.waitUntil(() => publish.mock.calls.length);
            expect(publish).toHaveBeenCalledWith(bookmark);
            expect(resolved).toBe(false);

            published.resolve();
            expect(await operation).toBe(bookmark);
            expect(resolved).toBe(true);
        }),
    );

    it(
        'waits for an updated bookmark to be persisted and published before resolving',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const attrs = {
                jid: 'theplay@conference.shakespeare.lit',
                autojoin: false,
                name: 'The Play',
            };
            const { bookmarks } = _converse.state;
            const bookmark = bookmarks.add(attrs);
            const persisted = Promise.withResolvers();
            const published = Promise.withResolvers();
            const save = vi.spyOn(bookmark, 'save').mockReturnValue(persisted.promise);
            const publish = vi.spyOn(bookmarks, 'sendBookmarkStanza').mockReturnValue(published.promise);
            const updated_attrs = { jid: attrs.jid, name: 'Hamlet' };

            const operation = bookmarks.setBookmark(updated_attrs);
            await Promise.resolve();

            expect(save).toHaveBeenCalledWith(updated_attrs, { promise: true });
            expect(publish).not.toHaveBeenCalled();

            persisted.resolve();
            await u.waitUntil(() => publish.mock.calls.length);
            expect(publish).toHaveBeenCalledWith(bookmark);

            published.resolve();
            expect(await operation).toBe(bookmark);
        }),
    );

    it(
        'rejects when publishing a persisted bookmark fails',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const attrs = {
                jid: 'theplay@conference.shakespeare.lit',
                autojoin: false,
                name: 'The Play',
            };
            const { bookmarks } = _converse.state;
            const bookmark = bookmarks.add(attrs);
            vi.spyOn(bookmark, 'save').mockResolvedValue();
            const error = new Error('Bookmark publish failed');
            vi.spyOn(bookmarks, 'sendBookmarkStanza').mockRejectedValue(error);
            const on_error = vi.spyOn(bookmarks, 'onBookmarkError').mockImplementation(() => {});

            await expect(bookmarks.setBookmark({ jid: attrs.jid, name: 'Hamlet' })).rejects.toBe(error);
            expect(on_error).toHaveBeenCalledWith(error);
        }),
    );

    it(
        'can be created and sends out a stanza',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const bare_jid = _converse.session.get('bare_jid');
            const muc1_jid = 'theplay@conference.shakespeare.lit';
            const { api } = _converse;

            let operation = api.bookmarks.set({
                jid: muc1_jid,
                autojoin: true,
                name: 'Hamlet',
                nick: '',
            });

            let { sent_stanza } = await acknowledgeBookmarkPublish(
                _converse,
                operation,
                `publish[node="${Strophe.NS.BOOKMARKS2}"] conference[name="Hamlet"]`,
            );

            expect(sent_stanza).toEqualStanza(stx`
            <iq from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="${Strophe.NS.BOOKMARKS2}">
                        <item id="${muc1_jid}">
                            <conference xmlns="${Strophe.NS.BOOKMARKS2}" autojoin="true" name="Hamlet"/>
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
            operation = api.bookmarks.set({
                jid: muc2_jid,
                autojoin: true,
                name: 'Balcony',
                nick: 'romeo',
            });

            ({ sent_stanza } = await acknowledgeBookmarkPublish(
                _converse,
                operation,
                `publish[node="${Strophe.NS.BOOKMARKS2}"] conference[name="Balcony"]`,
            ));

            expect(sent_stanza).toEqualStanza(stx`
            <iq from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="${Strophe.NS.BOOKMARKS2}">
                        <item id="${muc2_jid}">
                            <conference xmlns="${Strophe.NS.BOOKMARKS2}" autojoin="true" name="Balcony">
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
            operation = api.bookmarks.set({
                jid: muc3_jid,
                autojoin: false,
                name: 'Garden',
                nick: 'r0meo',
                password: 'secret',
                extensions: [
                    '<state xmlns="http://myclient.example/bookmark/state" minimized="true"/>',
                    '<levels xmlns="http://myclient.example/bookmark/levels" amount="9000"/>',
                ],
            });

            ({ sent_stanza } = await acknowledgeBookmarkPublish(
                _converse,
                operation,
                `publish[node="${Strophe.NS.BOOKMARKS2}"] conference[name="Garden"]`,
            ));

            expect(sent_stanza).toEqualStanza(stx`
            <iq xmlns="jabber:client" type="set" from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <publish node="${Strophe.NS.BOOKMARKS2}">
                        <item id="${muc3_jid}">
                            <conference xmlns="${Strophe.NS.BOOKMARKS2}" autojoin="false" name="Garden">
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
        }),
    );

    it(
        'handles missing bookmarks gracefully when server responds with item-not-found',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.bare_jid,
                [{ 'category': 'pubsub', 'type': 'pep' }],
                ['http://jabber.org/protocol/pubsub#publish-options', 'urn:xmpp:bookmarks:1#compat'],
            );

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const sent_stanza = await u.waitUntil(() =>
                IQ_stanzas.filter((s) => sizzle(`items[node="${Strophe.NS.BOOKMARKS2}"]`, s).length).pop(),
            );

            // Simulate server response with item-not-found error
            const error_stanza = stx`
                <iq xmlns="jabber:client" type="error"
                        id="${sent_stanza.getAttribute('id')}"
                        from="${sent_stanza.getAttribute('to')}"
                        to="${sent_stanza.getAttribute('from')}">
                    <pubsub xmlns="http://jabber.org/protocol/pubsub">
                        <items node="${Strophe.NS.BOOKMARKS2}"/>
                    </pubsub>
                    <error code="404" type="cancel">
                        <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, error_stanza));

            const { fetched_flag_key } = u.bookmarks.getStorageKeys();
            const cache_key = `converse.room-bookmarks.romeo@montague.lit-fetched`;
            expect(fetched_flag_key).toBe(cache_key);
            const result = await u.waitUntil(() => _converse.state.session.get(cache_key));
            expect(result).toBe(true);
        }),
    );

    it(
        'can be removed and sends out a retract stanza',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.bare_jid,
                [{ 'category': 'pubsub', 'type': 'pep' }],
                ['http://jabber.org/protocol/pubsub#publish-options', 'urn:xmpp:bookmarks:1#compat'],
            );
            await mock.waitUntilBookmarksReturned(_converse);

            const bare_jid = _converse.session.get('bare_jid');
            const muc_jid = 'theplay@conference.shakespeare.lit';
            const { api } = _converse;

            // First create a bookmark
            const operation = api.bookmarks.set({
                jid: muc_jid,
                autojoin: true,
                name: 'The Play',
                nick: 'romeo',
            });

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            await acknowledgeBookmarkPublish(_converse, operation, `publish[node="${Strophe.NS.BOOKMARKS2}"]`);

            // Clear previous stanzas
            while (IQ_stanzas.length) IQ_stanzas.pop();

            // Now remove the bookmark
            const bookmark = _converse.state.bookmarks.findWhere({ jid: muc_jid });
            expect(bookmark).toBeTruthy();
            _converse.state.bookmarks.remove(bookmark);

            // Check that a retract stanza is sent as per XEP-0402
            const sent_stanza = await u.waitUntil(() =>
                IQ_stanzas.filter((s) => sizzle(`retract[node="${Strophe.NS.BOOKMARKS2}"]`, s).length).pop(),
            );

            expect(sent_stanza).toEqualStanza(stx`
                <iq from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                    <pubsub xmlns="http://jabber.org/protocol/pubsub">
                        <retract node="${Strophe.NS.BOOKMARKS2}" notify="true">
                            <item id="${muc_jid}"/>
                        </retract>
                    </pubsub>
                </iq>`);
        }),
    );

    it(
        'can be pinned and sends out a stanza',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const bare_jid = _converse.session.get('bare_jid');
            const muc_jid = 'theplay@conference.shakespeare.lit';
            const { state } = _converse;

            // First create a bookmark
            state.bookmarks.create({
                jid: muc_jid,
                autojoin: true,
                name: 'The Play',
                nick: 'romeo',
                extensions: [],
            });

            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await u.waitUntil(() => state.chatboxes.length === 1);

            // Now pin the bookmark
            const bookmark = state.bookmarks.findWhere({ jid: muc_jid });
            expect(bookmark).toBeTruthy();
            const operation = state.bookmarks.pinBookmark(bookmark);
            const { sent_stanza } = await acknowledgeBookmarkPublish(
                _converse,
                operation,
                `publish[node="${Strophe.NS.BOOKMARKS2}"] conference[name="The Play"] extensions pinned`,
            );

            expect(bookmark.get('pinned')).toBe(true);

            expect(state.bookmarks.get(muc_jid).get('pinned')).toBe(true);

            expect(sent_stanza).toEqualStanza(stx`
                <iq from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                    <pubsub xmlns="http://jabber.org/protocol/pubsub">
                        <publish node="${Strophe.NS.BOOKMARKS2}">
                            <item id="${muc_jid}">
                                <conference xmlns="${Strophe.NS.BOOKMARKS2}" autojoin="true" name="The Play">
                                    <nick>romeo</nick>
                                    <extensions>
                                        <pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>
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
        }),
    );

    it(
        'can be unpinned and sends out a stanza',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const bare_jid = _converse.session.get('bare_jid');
            const muc_jid = 'theplay@conference.shakespeare.lit';
            const { state } = _converse;

            // First create a pinned bookmark
            const bookmark = state.bookmarks.create({
                jid: muc_jid,
                autojoin: true,
                name: 'The Play',
                nick: 'romeo',
                extensions: [`<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`],
            });

            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await u.waitUntil(() => state.chatboxes.length === 1);

            expect(bookmark.get('pinned')).toBe(true);
            expect(state.bookmarks.get(muc_jid).get('pinned')).toBe(true);

            // Now unpin the bookmark
            const operation = state.bookmarks.unpinBookmark(bookmark);
            const { sent_stanza } = await acknowledgeBookmarkPublish(
                _converse,
                operation,
                `publish[node="${Strophe.NS.BOOKMARKS2}"] conference[name="The Play"]`,
            );

            expect(bookmark.get('pinned')).toBe(false);
            expect(state.bookmarks.get(muc_jid).get('pinned')).toBe(false);

            expect(sent_stanza).toEqualStanza(stx`
                <iq from="${bare_jid}" to="${bare_jid}" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">
                    <pubsub xmlns="http://jabber.org/protocol/pubsub">
                        <publish node="${Strophe.NS.BOOKMARKS2}">
                            <item id="${muc_jid}">
                                <conference xmlns="${Strophe.NS.BOOKMARKS2}" autojoin="true" name="The Play">
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
        }),
    );

    it(
        'keeps its other settings when pinned and unpinned',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const muc_jid = 'theplay@conference.shakespeare.lit';
            const { state } = _converse;
            const bookmark = state.bookmarks.create({
                jid: muc_jid,
                autojoin: false,
                name: 'The Play',
                nick: 'romeo',
                password: 'secret',
                extensions: ['<note xmlns="urn:example:note"/>'],
            });

            let { sent_stanza } = await acknowledgeBookmarkPublish(
                _converse,
                state.bookmarks.pinRoom(muc_jid),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"] extensions pinned`,
            );
            expect(sizzle('conference', sent_stanza)[0]).toEqualStanza(stx`
                <conference xmlns="${Strophe.NS.BOOKMARKS2}" name="The Play" autojoin="false">
                    <nick>romeo</nick>
                    <password>secret</password>
                    <extensions>
                        <note xmlns="urn:example:note"/>
                        <pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>
                    </extensions>
                </conference>`);
            expect(bookmark.get('pinned')).toBe(true);
            expect(bookmark.get('autojoin')).toBe(false);

            ({ sent_stanza } = await acknowledgeBookmarkPublish(
                _converse,
                state.bookmarks.unpinRoom(muc_jid),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"] extensions:not(:has(pinned))`,
            ));
            expect(sizzle('conference', sent_stanza)[0]).toEqualStanza(stx`
                <conference xmlns="${Strophe.NS.BOOKMARKS2}" name="The Play" autojoin="false">
                    <nick>romeo</nick>
                    <password>secret</password>
                    <extensions>
                        <note xmlns="urn:example:note"/>
                    </extensions>
                </conference>`);
            expect(bookmark.get('pinned')).toBe(false);
            expect(state.bookmarks.get(muc_jid)).toBe(bookmark);
        }),
    );

    it(
        'can be unpinned again without adding or duplicating anything',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const muc_jid = 'theplay@conference.shakespeare.lit';
            const { state } = _converse;
            const bookmark = state.bookmarks.create({
                jid: muc_jid,
                autojoin: false,
                name: 'The Play',
                extensions: ['<note xmlns="urn:example:note"/>'],
            });

            const { sent_stanza } = await acknowledgeBookmarkPublish(
                _converse,
                state.bookmarks.unpinRoom(muc_jid),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"]`,
            );
            expect(sizzle('extensions > *', sent_stanza).map((e) => e.namespaceURI)).toEqual(['urn:example:note']);
            expect(bookmark.get('pinned')).toBe(false);
        }),
    );

    it(
        'keeps its pin when its MUC is left',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const muc_jid = 'theplay@conference.shakespeare.lit';
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', [], [], true, { name: 'The Play' });
            const { bookmarks } = _converse.state;
            await u.waitUntil(() => bookmarks.get(muc_jid));

            await acknowledgeBookmarkPublish(
                _converse,
                bookmarks.pinRoom(muc_jid),
                `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"] extensions pinned`,
            );

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            while (sent_IQs.length) sent_IQs.pop();

            await muc.close();
            const selector = `publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"]`;
            const sent_stanza = await u.waitUntil(() => sent_IQs.find((s) => sizzle(selector, s).length));
            expect(sizzle('conference', sent_stanza)[0]).toEqualStanza(stx`
                <conference xmlns="${Strophe.NS.BOOKMARKS2}" name="The Play" autojoin="false">
                    <nick>romeo</nick>
                    <extensions>
                        <pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>
                    </extensions>
                </conference>`);

            const bookmark = bookmarks.get(muc_jid);
            expect(bookmark.get('autojoin')).toBe(false);
            expect(bookmark.get('pinned')).toBe(true);
        }),
    );

    it(
        'rejects pinning when the server refuses the publish',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const muc_jid = 'theplay@conference.shakespeare.lit';
            const { state } = _converse;
            state.bookmarks.create({ jid: muc_jid, autojoin: false, name: 'The Play' });
            vi.spyOn(state.bookmarks, 'onBookmarkError').mockImplementation(() => {});

            const connection = _converse.api.connection.get();
            const operation = state.bookmarks.pinRoom(muc_jid);
            const sent_stanza = await u.waitUntil(() =>
                connection.IQ_stanzas.find(
                    (s) => sizzle(`publish[node="${Strophe.NS.BOOKMARKS2}"] item[id="${muc_jid}"]`, s).length,
                ),
            );
            connection._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<iq xmlns="jabber:client" to="${connection.jid}" type="error" id="${sent_stanza.getAttribute('id')}">
                        <error type="cancel">
                            <not-allowed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        </error>
                    </iq>`,
                ),
            );
            await expect(operation).rejects.toBeTruthy();
            expect(state.bookmarks.onBookmarkError).toHaveBeenCalled();
        }),
    );

    it(
        'normalizes extensions when publishing: drops malformed, dedups <pinned/>, preserves unknown',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const muc_jid = 'theplay@conference.shakespeare.lit';
            const { state } = _converse;

            // Already pinned, plus a malformed extension and an unrelated (unknown) one.
            const bookmark = state.bookmarks.create({
                jid: muc_jid,
                autojoin: true,
                name: 'The Play',
                nick: 'romeo',
                extensions: [
                    '<not valid xml',
                    '<note xmlns="urn:example:note"/>',
                    `<pinned xmlns="${Strophe.NS.BOOKMARKS_PINNING}"/>`,
                ],
            });

            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await u.waitUntil(() => state.chatboxes.length === 1);
            expect(bookmark.get('pinned')).toBe(true);

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;

            // Re-pinning must still publish (self-healing if the server diverged), and the
            // published <extensions> must drop the malformed entry, keep exactly one
            // <pinned/> (no duplicate) and preserve the unknown extension. (We don't await
            // the publish, since the mock server never answers the IQ.)
            state.bookmarks.pinBookmark(bookmark).catch(() => {});

            const sent_stanza = await u.waitUntil(() =>
                IQ_stanzas.filter(
                    (s) => sizzle(`publish[node="${Strophe.NS.BOOKMARKS2}"] conference[name="The Play"]`, s).length,
                ).pop(),
            );

            const children = Array.from(sizzle('extensions', sent_stanza)[0].children);
            expect(children.length).toBe(2); // malformed dropped
            expect(children.filter((c) => c.namespaceURI === Strophe.NS.BOOKMARKS_PINNING).length).toBe(1); // single <pinned/>
            expect(children.filter((c) => c.namespaceURI === 'urn:example:note').length).toBe(1); // unknown preserved
        }),
    );

    it(
        'derives pinned-ness by element identity, not substring matching',
        mock.initConverse(converse, ['connected', 'chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);

            const { state } = _converse;
            const ns = Strophe.NS.BOOKMARKS_PINNING;

            // A lookalike the old substring check would have mis-flagged as pinned.
            const lookalike = state.bookmarks.create({
                jid: 'a@conference.example',
                name: 'A',
                autojoin: false,
                extensions: [`<pinnedfoo xmlns="${ns}"/>`],
            });
            expect(lookalike.get('pinned')).toBe(false);

            // A real <pinned/> with reordered/extra attributes, single quotes and
            // an explicit close tag must still count as pinned.
            const pinned = state.bookmarks.create({
                jid: 'b@conference.example',
                name: 'B',
                autojoin: false,
                extensions: [`<pinned foo='bar' xmlns="${ns}"></pinned>`],
            });
            expect(pinned.get('pinned')).toBe(true);

            // A <pinned/> nested inside another extension must not count.
            const nested = state.bookmarks.create({
                jid: 'c@conference.example',
                name: 'C',
                autojoin: false,
                extensions: [`<wrap xmlns="urn:example:wrap"><pinned xmlns="${ns}"/></wrap>`],
            });
            expect(nested.get('pinned')).toBe(false);
        }),
    );
});
