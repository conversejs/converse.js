/*global mock, converse */
const {  Promise, sizzle, u } = converse.env;


describe('The "Groupchats" Add modal', function () {

    it('can be opened from a link in the "Groupchats" section of the controlbox',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const modal = await mock.openAddMUCModal(_converse);

            let label_name = modal.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat name or address:');
            const name_input = modal.querySelector('input[name="chatroom"]');
            expect(name_input.placeholder).toBe('name@conference.example.org');

            const label_nick = modal.querySelector('label[for="nickname"]');
            expect(label_nick.textContent.trim()).toBe('Nickname:');
            const nick_input = modal.querySelector('input[name="nickname"]');
            expect(nick_input.value).toBe('Romeo');
            nick_input.value = 'romeo';

            expect(modal.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            modal.querySelector('input[name="chatroom"]').value = 'lounge@muc.montague.lit';
            modal.querySelector('form input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.length);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
        })
    );

    it("doesn't require the domain when muc_domain is set",
        mock.initConverse(['chatBoxesFetched'], { 'muc_domain': 'muc.example.org' }, async function (_converse) {
            const modal = await mock.openAddMUCModal(_converse);

            expect(modal.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            const label_name = modal.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat name or address:');
            let name_input = modal.querySelector('input[name="chatroom"]');
            expect(name_input.placeholder).toBe('name@muc.example.org');
            name_input.value = 'lounge';
            let nick_input = modal.querySelector('input[name="nickname"]');
            nick_input.value = 'max';

            modal.querySelector('form input[type="submit"]').click();
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
            await u.waitUntil(() => _converse.chatboxes.models.filter(c => c.get('type') === 'chatroom').length === 2);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 2);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes('lounge@conference.example.org')).toBe(
                true
            );
        })
    );

    it('only uses the muc_domain if locked_muc_domain is true', mock.initConverse(
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
            await u.waitUntil(
                () => _converse.chatboxes.models.filter(c => c.get('type') === 'chatroom').length === 2
            );
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 2);
            expect(
                _converse.chatboxes.models.map(m => m.get('id')).includes('lounge-conference@muc.example.org')
            ).toBe(true);
        })
    );

    fit("lets you create a MUC with only the name",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const { domain } = _converse;
            await mock.waitUntilDiscoConfirmed(
                _converse,
                domain,
                [{ category: 'server', type: 'IM' }],
                [Strophe.NS.DISCO_ITEMS],
            );

            const modal = await mock.openAddMUCModal(_converse);
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

            const name_input = modal.querySelector('input[name="chatroom"]');
            name_input.value = 'The Lounge';

            const nick_input = modal.querySelector('input[name="nickname"]');
            nick_input.value = 'max';

            modal.querySelector('form input[type="submit"]').click();

            await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], ['muc.example.org'], 'items');
            await mock.waitUntilDiscoConfirmed(_converse, 'muc.example.org', [], [Strophe.NS.MUC]);

            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes('the-lounge@muc.example.org')).toBe(true);

            const muc = _converse.chatboxes.get('the-lounge@muc.example.org');
            expect(muc.get('name')).toBe('The Lounge');
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
