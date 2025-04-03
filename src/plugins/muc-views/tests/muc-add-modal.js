/*global mock, converse */
const {  Promise, sizzle, u } = converse.env;

describe('The "Groupchats" Add modal', function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it('can be opened from a link in the "Groupchats" section of the controlbox',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const modal = await mock.openAddMUCModal(_converse);

            const muc_jid = 'lounge@muc.montague.lit';

            let label_name = modal.querySelector('label[for="chatroom"]');
            expect(modal.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
            expect(label_name.textContent.trim()).toBe('Groupchat name or address:');
            const label_nick = modal.querySelector('label[for="nickname"]');
            expect(label_nick.textContent.trim()).toBe('Nickname:');
            const nick_input = modal.querySelector('input[name="nickname"]');
            expect(nick_input.value).toBe('Romeo');
            nick_input.value = 'romeo';

            modal.querySelector('input[name="chatroom"]').value = muc_jid;
            modal.querySelector('form input[type="submit"]').click();

            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await u.waitUntil(() => _converse.chatboxes.length);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
        })
    );

    it("doesn't require the domain when muc_domain is set",
        mock.initConverse(['chatBoxesFetched'], { muc_domain: 'muc.example.org' }, async function (_converse) {

            const modal = await mock.openAddMUCModal(_converse);
            expect(modal.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            const label_name = modal.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat name or address:');
            let name_input = modal.querySelector('input[name="chatroom"]');
            name_input.value = 'lounge';
            let nick_input = modal.querySelector('input[name="nickname"]');
            nick_input.value = 'max';

            modal.querySelector('form input[type="submit"]').click();
            await mock.waitForMUCDiscoInfo(_converse, 'lounge@muc.example.org');
            await u.waitUntil(() => _converse.chatboxes.length);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes('lounge@muc.example.org')).toBe(true);

            // However, you can still open MUCs with different domains
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            await u.waitUntil(() => u.isVisible(modal), 1000);
            name_input = modal.querySelector('input[name="chatroom"]');
            name_input.value = 'lounge@conference.example.org';
            nick_input = modal.querySelector('input[name="nickname"]');
            nick_input.value = 'max';
            modal.querySelector('form input[type="submit"]').click();
            await mock.waitForMUCDiscoInfo(_converse, 'lounge@conference.example.org');
            await u.waitUntil(() => _converse.chatboxes.models.filter(c => c.get('type') === 'chatroom').length === 2);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 2);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes('lounge@conference.example.org')).toBe(
                true
            );
        })
    );

    it('uses the muc_domain if locked_muc_domain is true', mock.initConverse(
        ['chatBoxesFetched'], { muc_domain: 'muc.example.org', locked_muc_domain: true },
        async function (_converse) {
            const modal = await mock.openAddMUCModal(_converse);

            expect(modal.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            const label_name = modal.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat name:');
            let name_input = modal.querySelector('input[name="chatroom"]');
            expect(name_input.placeholder).toBe('');
            name_input.value = 'lounge';
            let nick_input = modal.querySelector('input[name="nickname"]');
            nick_input.value = 'max';
            modal.querySelector('form input[type="submit"]').click();
            await mock.waitForMUCDiscoInfo(_converse, 'lounge@muc.example.org');
            await u.waitUntil(() => _converse.chatboxes.length);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes('lounge@muc.example.org')).toBe(true);

            // However, you can still open MUCs with different domains
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            await u.waitUntil(() => u.isVisible(modal), 1000);
            name_input = modal.querySelector('input[name="chatroom"]');
            name_input.value = 'lounge@conference';
            nick_input = modal.querySelector('input[name="nickname"]');
            nick_input.value = 'max';
            modal.querySelector('form input[type="submit"]').click();
            await mock.waitForMUCDiscoInfo(_converse, 'lounge-conference@muc.example.org');
            await u.waitUntil(
                () => _converse.chatboxes.models.filter(c => c.get('type') === 'chatroom').length === 2
            );
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 2);
            expect(
                _converse.chatboxes.models.map(m => m.get('id')).includes('lounge-conference@muc.example.org')
            ).toBe(true);
        })
    );

    it("lets you create a MUC with only the name",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const { domain } = _converse;
            await mock.waitUntilDiscoConfirmed(
                _converse,
                domain,
                [{ category: 'server', type: 'IM' }],
                [Strophe.NS.DISCO_ITEMS],
            );

            const nick = 'max';
            const muc_jid = 'the-lounge@muc.example.org';
            const own_jid = _converse.session.get('jid');

            const modal = await mock.openAddMUCModal(_converse);
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

            const name_input = modal.querySelector('input[name="chatroom"]');
            name_input.value = 'The Lounge';

            const nick_input = modal.querySelector('input[name="nickname"]');
            nick_input.value = nick;

            modal.querySelector('form input[type="submit"]').click();

            await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], ['muc.example.org'], 'items');
            await mock.waitUntilDiscoConfirmed(_converse, 'muc.example.org', [], [Strophe.NS.MUC]);
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes(muc_jid)).toBe(true);

            const muc = _converse.chatboxes.get(muc_jid);
            expect(muc.get('name')).toBe('The Lounge');

            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            // Own presence which states that the room is locked and needs to
            // be configured (code 201)
            const presence =
                stx`<presence
                        id="5025e055-036c-4bc5-a227-706e7e352053"
                        to="${own_jid}"
                        from="${muc_jid}/${nick}"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="owner" jid="${own_jid}" role="moderator"/>
                        <status code="110"/>
                        <status code="201"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const iq = await u.waitUntil(() => IQ_stanzas.filter((s) => sizzle(`query[xmlns="${Strophe.NS.MUC_OWNER}"]`, s).length).pop());

            spyOn(muc, 'sendConfiguration').and.callThrough();

            expect(iq).toEqualStanza(stx`
                <iq id="${iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#owner"/>
                </iq>`);

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<iq xmlns="jabber:client"
                    type="result"
                    to="${own_jid}"
                    from="${muc_jid}" id="${iq.getAttribute('id')}">
                <query xmlns="http://jabber.org/protocol/muc#owner">
                    <x xmlns="jabber:x:data" type="form">
                    <title>Configuration for ${muc_jid}</title>
                    <instructions>Complete and submit this form to configure the room.</instructions>
                    <field var="FORM_TYPE" type="hidden">
                        <value>http://jabber.org/protocol/muc#roomconfig</value>
                    </field>
                    <field type="text-single" var="muc#roomconfig_roomname" label="Name"><value></value></field>
                    <field type="text-single" var="muc#roomconfig_roomdesc" label="Description"><value/></field>
                    <field type="boolean" var="muc#roomconfig_persistentroom" label="Make Room Persistent?"/>
                    <field type="boolean" var="muc#roomconfig_publicroom" label="Make Room Publicly Searchable?"><value>1</value></field>
                    <field type="boolean" var="muc#roomconfig_changesubject" label="Allow Occupants to Change Subject?"/>
                    <field type="list-single" var="muc#roomconfig_whois" label="Who May Discover Real JIDs?"><option label="Moderators Only">
                       <value>moderators</value></option><option label="Anyone"><value>anyone</value></option>
                    </field>
                    <field label="Roles and Affiliations that May Retrieve Member List"
                           type="list-multi"
                           var="muc#roomconfig_getmemberlist">
                        <value>moderator</value>
                        <value>participant</value>
                        <value>visitor</value>
                    </field>
                    <field type="text-private" var="muc#roomconfig_roomsecret" label="Password"><value/></field>
                    <field type="boolean" var="muc#roomconfig_moderatedroom" label="Make Room Moderated?"/>
                    <field type="boolean" var="muc#roomconfig_membersonly" label="Make Room Members-Only?"/>
                    <field type="text-single" var="muc#roomconfig_historylength" label="Maximum Number of History Messages Returned by Room">
                       <value>20</value></field>
                    </x>
                </query>
                </iq>`));

            await u.waitUntil(() => muc.sendConfiguration.calls.count() === 1);

            const sent_stanza = IQ_stanzas.filter(s => s.getAttribute('type') === 'set').pop();
            expect(sizzle('field[var="muc#roomconfig_roomname"] value', sent_stanza).pop().textContent.trim()).toBe('The Lounge');
        })
    );

    it("shows a validation error when only the name was specified and there's no default MUC service",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const { domain } = _converse;
            await mock.waitUntilDiscoConfirmed(
                _converse,
                domain,
                [{ category: 'server', type: 'IM' }],
                [],
            );

            const nick = 'max';
            const modal = await mock.openAddMUCModal(_converse);
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

            const name_input = modal.querySelector('input[name="chatroom"]');
            name_input.value = 'The Lounge';

            const nick_input = modal.querySelector('input[name="nickname"]');
            nick_input.value = nick;

            modal.querySelector('form input[type="submit"]').click();

            await u.waitUntil(() => name_input.classList.contains('error'));
            expect(name_input.classList.contains('is-invalid')).toBe(true);
            expect(modal.querySelector('.invalid-feedback')?.textContent).toBe(
                "No default groupchat service found. "+
                "You'll need to specify the full address, for example room@conference.example.org"
            );
        })
    );

    it("normalizes the MUC name when creating the corresponding JID",
        mock.initConverse(['chatBoxesFetched'], {muc_domain: 'montague.lit'}, async function (_converse) {
            const modal = await mock.openAddMUCModal(_converse);
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

            const name_input = modal.querySelector('input[name="chatroom"]');
            name_input.value = 'Into the Äther: A Journey';

            const nick_input = modal.querySelector('input[name="nickname"]');
            nick_input.value = 'max';

            modal.querySelector('form input[type="submit"]').click();

            await mock.waitForMUCDiscoInfo(_converse, 'into-the-ather-a-journey@montague.lit');
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes('into-the-ather-a-journey@montague.lit')).toBe(true);

            expect(modal.normalizeNode('Into the Äther: A Journey')).toBe('into-the-ather-a-journey');
            expect(modal.normalizeNode(' A silly summer song ∷ ')).toBe('a-silly-summer-song');
        })
    );

    it("applies a muc_roomid_policy",
        mock.initConverse(['chatBoxesFetched'], {
            muc_domain: 'montague.lit',
            muc_roomid_policy: /^[a-z0-9._-]{5,40}$/,
            muc_roomid_policy_hint: '<br><b>Policy for groupchat id:</b><br>- between 5 and 40 characters,<br>- lowercase from a to z (no special characters) or<br>- digits or<br>- dots (.) or<br>- underlines (_) or<br>- hyphens (-),<br>- no spaces<br>',
        }, async function (_converse) {
            const modal = await mock.openAddMUCModal(_converse);

            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            const name_input = modal.querySelector('input[name="chatroom"]');
            name_input.value = 'lounge\ music@montague.lit';

            const nick_input = modal.querySelector('input[name="nickname"]');
            nick_input.value = 'max';

            modal.querySelector('form input[type="submit"]').click();
            await u.waitUntil(() => name_input.classList.contains('error'));
            expect(name_input.classList.contains('is-invalid')).toBe(true);
            expect(modal.querySelector('.invalid-feedback')?.textContent).toBe('Groupchat id is invalid.');
        })
    );
});
