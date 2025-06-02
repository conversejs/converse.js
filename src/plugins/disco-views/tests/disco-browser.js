const { u } = converse.env;

describe('DiscoBrowser', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'initializes with the session domain as the first entity',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            await mock.openControlBox(_converse);
            const cbview = _converse.chatboxviews.get('controlbox');
            const button = await u.waitUntil(() => cbview.querySelector('a.show-client-info'));
            button.click();
            const modal = api.modal.get('converse-user-settings-modal');
            modal.tab = 'disco';
            await u.waitUntil(() => modal.querySelector('converse-disco-browser'));
            const el = modal.querySelector('converse-disco-browser');
            expect(el._entity_jids).toEqual([_converse.session.get('domain')]);
        })
    );

    it(
        'returns an error message for item-not-found errors',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            await api.modal.show('converse-user-settings-modal');
            const modal = api.modal.get('converse-user-settings-modal');
            modal.tab = 'disco';
            await u.waitUntil(() => modal.querySelector('converse-disco-browser'));
            const el = modal.querySelector('converse-disco-browser');
            const input = el.querySelector('converse-autocomplete[name="entity_jid"] input');
            input.value = 'nonexistent.domain';

            const connection = api.connection.get();
            while (connection.IQ_stanzas.length) connection.IQ_stanzas.pop();

            const form = el.querySelector('form');
            const submitEvent = new Event('submit', { bubbles: true });
            form.dispatchEvent(submitEvent);

            const sent = await u.waitUntil(() =>
                connection.IQ_stanzas.filter(
                    (iq) =>
                        iq.getAttribute('type') === 'get' &&
                        iq.querySelector('query[xmlns="http://jabber.org/protocol/disco#info"]')
                ).pop()
            );

            connection._dataRecv(
                mock.createRequest(
                    stx`<iq from="nonexistent.domain"
                        to="${_converse.session.get('jid')}"
                        id="${sent.getAttribute('id')}"
                        type="error"
                        xmlns="jabber:client">
                    <error type="cancel">
                        <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </iq>`
                )
            );

            const alert = await u.waitUntil(() => modal.querySelector('.alert-danger'));
            expect(alert.textContent).toBe('No service found with that XMPP address');
        })
    );

    it(
        'returns features, identities and items when successful',
        mock.initConverse(['discoInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            await api.modal.show('converse-user-settings-modal');
            const modal = api.modal.get('converse-user-settings-modal');
            modal.tab = 'disco';
            await u.waitUntil(() => modal.querySelector('converse-disco-browser'));
            const connection = api.connection.get();
            const { IQ_stanzas, IQ_ids } = connection;

            await u.waitUntil(function () {
                return (
                    IQ_stanzas.filter(function (iq) {
                        return iq.querySelector(
                            'iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]'
                        );
                    }).length > 0
                );
            });
            let stanza = IQ_stanzas.find(function (iq) {
                return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#info"]');
            });
            const info_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
            stanza = stx`
            <iq xmlns="jabber:client"
                type='result'
                from='montague.lit'
                to='romeo@montague.lit/orchard'
                id='${info_IQ_id}'>
                <query xmlns='http://jabber.org/protocol/disco#info'>
                    <identity category='server' type='im'/>
                    <identity category='conference' type='text' name='Play-Specific Chatrooms'/>
                    <identity category='directory' type='chatroom' name='Play-Specific Chatrooms'/>
                    <feature var='http://jabber.org/protocol/disco#info'/>
                    <feature var='http://jabber.org/protocol/disco#items'/>
                    <feature var='jabber:iq:register'/>
                    <feature var='jabber:iq:time'/>
                    <feature var='jabber:iq:version'/>
                </query>
            </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            await u.waitUntil(() => {
                // Converse.js sees that the entity has a disco#items feature,
                // so it will make a query for it.
                return (
                    IQ_stanzas.filter((iq) => iq.querySelector('query[xmlns="http://jabber.org/protocol/disco#items"]'))
                        .length > 0
                );
            });

            stanza = IQ_stanzas.find((iq) =>
                iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]')
            );
            const items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
            <iq xmlns="jabber:client"
                type='result'
                from='montague.lit'
                to='romeo@montague.lit/orchard'
                id='${items_IQ_id}'>
                <query xmlns='http://jabber.org/protocol/disco#items'>
                    <item jid='people.shakespeare.lit' name='Directory of Characters'/>
                    <item jid='plays.shakespeare.lit' name='Play-Specific Chatrooms'/>
                    <item jid='words.shakespeare.lit' name='Gateway to Marlowe IM'/>
                    <item jid='montague.lit' node='books' name='Books by and about Shakespeare'/>
                    <item node='montague.lit' name='Wear your literary taste with pride'/>
                    <item jid='montague.lit' node='music' name='Music from the time of Shakespeare'/>
                </query>
            </iq>`)
            );

            await u.waitUntil(() => modal.querySelector('.items-list'));

            // Verify identities are rendered
            const identities = modal.querySelectorAll('#server-tabpanel .identities .list-item');
            expect(identities.length).toBe(3); // server, conference, directory identities
            expect(identities[0].textContent).toContain('Category: server');
            expect(identities[0].textContent).toContain('Type: im');
            expect(identities[1].textContent).toContain('Name: Play-Specific Chatrooms');
            expect(identities[1].textContent).toContain('Category: conference');
            expect(identities[1].textContent).toContain('Type: text');
            expect(identities[2].textContent).toContain('Name: Play-Specific Chatrooms');
            expect(identities[2].textContent).toContain('Category: directory');
            expect(identities[2].textContent).toContain('Type: chatroom');

            // Verify features are rendered
            const features = modal.querySelectorAll('#server-tabpanel .items-list.features li');
            expect(features.length).toBe(5);
            expect(features[0].textContent).toBe('http://jabber.org/protocol/disco#info');
            expect(features[1].textContent).toBe('http://jabber.org/protocol/disco#items');
            expect(features[2].textContent).toBe('jabber:iq:register');
            expect(features[3].textContent).toBe('jabber:iq:time');
            expect(features[4].textContent).toBe('jabber:iq:version');

            // "nodes" are not yet supported so not shown
            const items = modal.querySelectorAll('#server-tabpanel .items-list a');
            expect(items.length).toBe(3);
            expect(items[0].textContent).toBe('Directory of Characters <people.shakespeare.lit>');
            expect(items[1].textContent).toBe('Play-Specific Chatrooms <plays.shakespeare.lit>');
            expect(items[2].textContent).toBe('Gateway to Marlowe IM <words.shakespeare.lit>');
            /**
                expect(items[3].textContent).toBe('Books by and about Shakespeare <montague.lit>');
                expect(items[4].textContent).toBe('Wear your literary taste with pride <montague.lit>');
                expect(items[5].textContent).toBe('Music from the time of Shakespeare <montague.lit>');
            */
        })
    );

    it(
        'updates the _entity_jids array to only include up to the clicked breadcrumb',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            await api.modal.show('converse-user-settings-modal');
            const modal = api.modal.get('converse-user-settings-modal');
            modal.tab = 'disco';
            await u.waitUntil(() => modal.querySelector('converse-disco-browser'));
            const el = modal.querySelector('converse-disco-browser');
            el._entity_jids = ['domain1', 'domain2', 'domain3'];
            const ev = { preventDefault: function () {} };
            spyOn(ev, 'preventDefault');
            el.handleBreadcrumbClick(ev, 1);
            await u.waitUntil(() => el._entity_jids.length === 2);
            expect(el._entity_jids).toEqual(['domain1', 'domain2']);
            expect(ev.preventDefault).toHaveBeenCalled();
        })
    );

    it(
        'updates _entity_jids with the submitted JID',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            await api.modal.show('converse-user-settings-modal');
            const modal = api.modal.get('converse-user-settings-modal');
            modal.tab = 'disco';
            await u.waitUntil(() => modal.querySelector('converse-disco-browser'));
            const el = modal.querySelector('converse-disco-browser');

            const input = el.querySelector('converse-autocomplete[name="entity_jid"] input');
            input.value = 'new.domain';

            const form = el.querySelector('form');
            const submitEvent = new Event('submit', { bubbles: true });
            spyOn(submitEvent, 'preventDefault');
            form.dispatchEvent(submitEvent);

            await u.waitUntil(() => el._entity_jids[0] === 'new.domain');
            expect(el._entity_jids).toEqual(['new.domain']);
            expect(submitEvent.preventDefault).toHaveBeenCalled();
        })
    );
});
