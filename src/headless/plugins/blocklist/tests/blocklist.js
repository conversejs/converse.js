/*global mock, converse */
const { u, stx } = converse.env;

fdescribe('A blocklist', function () {
    beforeEach(() => {
        jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza });
        window.sessionStorage.removeItem('converse.blocklist-romeo@montague.lit-fetched');
    });

    it(
        'is automatically fetched from the server once the user logs in',
        mock.initConverse(['discoInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitUntilDiscoConfirmed(
                _converse,
                _converse.domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['urn:xmpp:blocking']
            );
            await mock.waitForRoster(_converse, 'current', 0);

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const sent_stanza = await u.waitUntil(() => IQ_stanzas.find((s) => s.querySelector('iq blocklist')));

            expect(sent_stanza).toEqualStanza(stx`
                <iq xmlns="jabber:client" type="get" id="${sent_stanza.getAttribute('id')}">
                    <blocklist xmlns="urn:xmpp:blocking"/>
                </iq>`);

            const stanza = stx`
                    <iq xmlns="jabber:client"
                        to="${_converse.api.connection.get().jid}"
                        type="result"
                        id="${sent_stanza.getAttribute('id')}">
                    <blocklist xmlns='urn:xmpp:blocking'>
                        <item jid='iago@shakespeare.lit'/>
                        <item jid='juliet@capulet.lit'/>
                    </blocklist>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            const blocklist = await api.waitUntil('blocklistInitialized');
            expect(blocklist.length).toBe(2);
            expect(blocklist.models.map((m) => m.get('jid'))).toEqual(['iago@shakespeare.lit', 'juliet@capulet.lit']);
        })
    );

    it(
        'is updated when the server sends IQ stanzas',
        mock.initConverse(['discoInitialized'], {}, async function (_converse) {
            const { api, domain } = _converse;
            await mock.waitUntilDiscoConfirmed(
                _converse,
                domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['urn:xmpp:blocking']
            );
            await mock.waitForRoster(_converse, 'current', 0);

            const IQ_stanzas = api.connection.get().IQ_stanzas;
            let sent_stanza = await u.waitUntil(() => IQ_stanzas.find((s) => s.querySelector('iq blocklist')));

            const stanza = stx`
                    <iq xmlns="jabber:client"
                        to="${api.connection.get().jid}"
                        type="result"
                        id="${sent_stanza.getAttribute('id')}">
                    <blocklist xmlns='urn:xmpp:blocking'>
                        <item jid='iago@shakespeare.lit'/>
                    </blocklist>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            const blocklist = await api.waitUntil('blocklistInitialized');
            expect(blocklist.length).toBe(1);

            // The server sends a push IQ stanza
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    stx`
                    <iq xmlns="jabber:client"
                        to="${api.connection.get().jid}"
                        type="set"
                        id="${u.getUniqueId()}">
                    <block xmlns='urn:xmpp:blocking'>
                        <item jid='juliet@capulet.lit'/>
                    </block>
                </iq>`
                )
            );
            await u.waitUntil(() => blocklist.length === 2);
            expect(blocklist.models.map((m) => m.get('jid'))).toEqual(['iago@shakespeare.lit', 'juliet@capulet.lit']);

            // The server sends a push IQ stanza
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    stx`
                    <iq xmlns="jabber:client"
                        to="${api.connection.get().jid}"
                        type="set"
                        id="${u.getUniqueId()}">
                    <unblock xmlns='urn:xmpp:blocking'>
                        <item jid='juliet@capulet.lit'/>
                    </unblock>
                </iq>`
                )
            );
            await u.waitUntil(() => blocklist.length === 1);
            expect(blocklist.models.map((m) => m.get('jid'))).toEqual(['iago@shakespeare.lit']);
        })
    );

    it(
        'can be updated via the api',
        mock.initConverse(['discoInitialized'], {}, async function (_converse) {
            const { api, domain } = _converse;
            await mock.waitUntilDiscoConfirmed(
                _converse,
                domain,
                [{ 'category': 'server', 'type': 'IM' }],
                ['urn:xmpp:blocking']
            );
            await mock.waitForRoster(_converse, 'current', 0);

            const IQ_stanzas = api.connection.get().IQ_stanzas;
            let sent_stanza = await u.waitUntil(() => IQ_stanzas.find((s) => s.querySelector('iq blocklist')));

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<iq xmlns="jabber:client"
                        to="${api.connection.get().jid}"
                        type="result"
                        id="${sent_stanza.getAttribute('id')}">
                    <blocklist xmlns='urn:xmpp:blocking'>
                        <item jid='iago@shakespeare.lit'/>
                    </blocklist>
                </iq>`));

            const blocklist = await api.waitUntil('blocklistInitialized');
            expect(blocklist.length).toBe(1);

            api.blocklist.add('juliet@capulet.lit');

            sent_stanza = await u.waitUntil(() => IQ_stanzas.find((s) => s.querySelector('iq block')));
            expect(sent_stanza).toEqualStanza(stx`
                <iq xmlns="jabber:client" type="set" id="${sent_stanza.getAttribute('id')}">
                    <block xmlns='urn:xmpp:blocking'>
                        <item jid='juliet@capulet.lit'/>
                    </block>
                </iq>`);

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<iq xmlns="jabber:client" type="result" id="${sent_stanza.getAttribute('id')}"/>`)
            );

            await u.waitUntil(() => blocklist.length === 2);
            expect(blocklist.models.map((m) => m.get('jid'))).toEqual(['iago@shakespeare.lit', 'juliet@capulet.lit']);

            api.blocklist.remove('juliet@capulet.lit');

            sent_stanza = await u.waitUntil(() => IQ_stanzas.find((s) => s.querySelector('iq unblock')));
            expect(sent_stanza).toEqualStanza(stx`
                <iq xmlns="jabber:client" type="set" id="${sent_stanza.getAttribute('id')}">
                    <unblock xmlns='urn:xmpp:blocking'>
                        <item jid='juliet@capulet.lit'/>
                    </unblock>
                </iq>`);

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<iq xmlns="jabber:client" type="result" id="${sent_stanza.getAttribute('id')}"/>`)
            );

            await u.waitUntil(() => blocklist.length === 1);
            expect(blocklist.models.map((m) => m.get('jid'))).toEqual(['iago@shakespeare.lit']);
        })
    );
});
