/*global mock, converse */

const { u, stx } = converse.env;

describe('Groupchats', () => {
    describe('A Groupchat', () => {
        it(
            'has an avatar image',
            mock.initConverse(['chatBoxesFetched'], { vcard: { nickname: '' } }, async function (_converse) {
                const muc_jid = 'lounge@montague.lit';
                await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

                const view = _converse.chatboxviews.get(muc_jid);
                const avatar = view.querySelector('.chat-head converse-avatar .avatar-initials');
                expect(avatar.textContent).toBe('L');
                expect(getComputedStyle(avatar).backgroundColor).toBe('rgb(0, 135, 113)');

                // eslint-disable-next-line max-len
                const image =
                    'PD94bWwgdmVyc2lvbj0iMS4wIj8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiA8cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzU1NSIvPgogPGNpcmNsZSBjeD0iNjQiIGN5PSI0MSIgcj0iMjQiIGZpbGw9IiNmZmYiLz4KIDxwYXRoIGQ9Im0yOC41IDExMiB2LTEyIGMwLTEyIDEwLTI0IDI0LTI0IGgyMyBjMTQgMCAyNCAxMiAyNCAyNCB2MTIiIGZpbGw9IiNmZmYiLz4KPC9zdmc+Cg==';
                const image_type = 'image/svg+xml';

                view.model.vcard.set({
                    image,
                    image_type,
                    vcard_updated: new Date().toISOString(),
                });
                const el = await u.waitUntil(() => view.querySelector(`.chat-head converse-avatar svg image`));
                expect(el.getAttribute('href')).toBe(`data:image/svg+xml;base64,${image}`);
            })
        );

        it('has an avatar which opens a details modal when clicked',
            mock.initConverse(
                ['chatBoxesFetched'],
                {
                    whitelisted_plugins: ['converse-roomslist'],
                    allow_bookmarks: false, // Makes testing easier, otherwise we
                    // have to mock stanza traffic.
                },
                async function (_converse) {
                    const { u } = converse.env;
                    const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
                    const muc_jid = 'coven@chat.shakespeare.lit';
                    await mock.waitForRoster(_converse, 'current', 0);
                    await mock.openControlBox(_converse);
                    await _converse.api.rooms.open(muc_jid, { 'nick': 'some1' });

                    const selector = `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`;
                    const features_query = await u.waitUntil(() =>
                        IQ_stanzas.filter((iq) => iq.querySelector(selector)).pop()
                    );

                    const features_stanza = stx`
                        <iq from="coven@chat.shakespeare.lit"
                                id="${features_query.getAttribute('id')}"
                                to="romeo@montague.lit/desktop"
                                type="result"
                                xmlns="jabber:client">
                            <query xmlns="http://jabber.org/protocol/disco#info">
                                <identity category="conference" name="A Dark Cave" type="text"/>
                                <feature var="http://jabber.org/protocol/muc"/>
                                <feature var="muc_passwordprotected"/>
                                <feature var="muc_hidden"/>
                                <feature var="muc_temporary"/>
                                <feature var="muc_open"/>
                                <feature var="muc_unmoderated"/>
                                <feature var="muc_nonanonymous"/>
                                <feature var="urn:xmpp:mam:0"/>
                                <x xmlns="jabber:x:data" type="result">
                                    <field var="FORM_TYPE" type="hidden">
                                        <value>http://jabber.org/protocol/muc#roominfo</value>
                                    </field>
                                    <field type="text-single" var="muc#roominfo_description" label="Description">
                                        <value>This is the description</value>
                                    </field>
                                    <field type="text-single" var="muc#roominfo_occupants" label="Number of occupants">
                                        <value>0</value>
                                    </field>
                                </x>
                            </query>
                        </iq>`;
                    _converse.api.connection.get()._dataRecv(mock.createRequest(features_stanza));

                    const view = _converse.chatboxviews.get(muc_jid);
                    await u.waitUntil(
                        () => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING
                    );
                    let presence = stx`
                        <presence to="${_converse.api.connection.get().jid}"
                                  from="coven@chat.shakespeare.lit/some1"
                                  id="DC352437-C019-40EC-B590-AF29E879AF97"
                                  xmlns="jabber:client">
                            <x xmlns="http://jabber.org/protocol/muc#user">
                                <item affiliation="member" jid="${_converse.bare_jid}" role="participant"/>
                            </x>
                            <status code="110"/>
                        </presence>`;
                    _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

                    const avatar_el = await u.waitUntil(
                        () => view.querySelector('converse-muc-heading converse-avatar')
                    );

                    const initials_el = avatar_el.querySelector('.avatar-initials');
                    expect(initials_el.textContent).toBe('AC');
                    expect(getComputedStyle(initials_el).backgroundColor).toBe('rgb(75, 103, 255)');
                    avatar_el.click();

                    const modal = _converse.api.modal.get('converse-muc-details-modal');
                    await u.waitUntil(() => u.isVisible(modal), 1000);

                    const modal_avatar_el = modal.querySelector('converse-avatar');
                    const modal_initials_el = modal_avatar_el.querySelector('.avatar-initials');
                    expect(modal_initials_el.textContent).toBe('AC');
                    expect(getComputedStyle(modal_initials_el).backgroundColor).toBe('rgb(75, 103, 255)');

                    let els = modal.querySelectorAll('p.room-info');
                    expect(els[0].textContent).toBe('Name: A Dark Cave');

                    expect(els[1].querySelector('strong').textContent).toBe('XMPP address:');
                    expect(els[1].querySelector('converse-texture').textContent.trim()).toBe(
                        'xmpp:coven@chat.shakespeare.lit?join'
                    );
                    expect(els[2].querySelector('strong').textContent).toBe('Description:');
                    expect(els[2].querySelector('converse-texture').textContent).toBe('This is the description');

                    expect(els[3].textContent).toBe('Online users: 1');
                    const features_list = modal.querySelector('.features-list');
                    expect(features_list.textContent.replace(/(\n|\s{2,})/g, '')).toBe(
                        'Password protected - This groupchat requires a password before entry' +
                        'Hidden - This groupchat is not publicly searchable' +
                        'Open - Anyone can join this groupchat' +
                        'Temporary - This groupchat will disappear once the last person leaves ' +
                        'Not anonymous - All other groupchat participants can see your XMPP address' +
                        'Not moderated - Participants entering this groupchat can write right away '
                    );
                    presence = stx`
                        <presence to="romeo@montague.lit/_converse.js-29092160"
                                from="coven@chat.shakespeare.lit/newguy"
                                xmlns="jabber:client">
                            <x xmlns="http://jabber.org/protocol/muc#user">
                                <item affiliation="none" jid="newguy@montague.lit/_converse.js-290929789" role="participant"/>
                            </x>
                        </presence>`;
                    _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
                    await u.waitUntil(() => view.model.occupants.length === 2);

                    els = modal.querySelectorAll('p.room-info');
                    expect(els[3].textContent).toBe('Online users: 2');

                    view.model.set({ 'subject': { 'author': 'someone', 'text': 'Hatching dark plots' } });
                    els = modal.querySelectorAll('p.room-info');
                    expect(els[0].textContent).toBe('Name: A Dark Cave');

                    expect(els[1].querySelector('strong').textContent).toBe('XMPP address:');
                    expect(els[1].querySelector('converse-texture').textContent.trim()).toBe(
                        'xmpp:coven@chat.shakespeare.lit?join'
                    );
                    expect(els[2].querySelector('strong').textContent).toBe('Description:');
                    expect(els[2].querySelector('converse-texture').textContent).toBe('This is the description');
                    expect(els[3].querySelector('strong').textContent).toBe('Topic:');
                    await u.waitUntil(
                        () => els[3].querySelector('converse-texture').textContent === 'Hatching dark plots'
                    );

                    expect(els[4].textContent).toBe('Topic author: someone');
                    expect(els[5].textContent).toBe('Online users: 2');
                }
            )
        );
    });
});
