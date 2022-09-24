/*global mock, converse */

const {  Promise, sizzle, u } = converse.env;

describe('The "Groupchats" Add modal', function () {

    it('can be opened from a link in the "Groupchats" section of the controlbox',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);

            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('converse-add-muc-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            let label_name = modal.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat address:');
            const name_input = modal.querySelector('input[name="chatroom"]');
            expect(name_input.placeholder).toBe('name@conference.example.org');

            const label_nick = modal.querySelector('label[for="nickname"]');
            expect(label_nick.textContent.trim()).toBe('Nickname:');
            const nick_input = modal.querySelector('input[name="nickname"]');
            expect(nick_input.value).toBe('');
            nick_input.value = 'romeo';

            expect(modal.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            modal.querySelector('input[name="chatroom"]').value = 'lounge@muc.montague.lit';
            modal.querySelector('form input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.length);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);

            roomspanel.model.set('muc_domain', 'muc.example.org');
            roomspanel.querySelector('.show-add-muc-modal').click();
            label_name = modal.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat name:');
            await u.waitUntil(() => modal.querySelector('input[name="chatroom"]')?.placeholder === 'name@muc.example.org');
        })
    );

    it("doesn't require the domain when muc_domain is set",
        mock.initConverse(['chatBoxesFetched'], { 'muc_domain': 'muc.example.org' }, async function (_converse) {
            await mock.openControlBox(_converse);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            const modal = _converse.api.modal.get('converse-add-muc-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);
            expect(modal.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            const label_name = modal.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat name:');
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

    it('only uses the muc_domain is locked_muc_domain is true',
        mock.initConverse(
            ['chatBoxesFetched'],
            { 'muc_domain': 'muc.example.org', 'locked_muc_domain': true },
            async function (_converse) {
                await mock.openControlBox(_converse);
                const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
                roomspanel.querySelector('.show-add-muc-modal').click();
                const modal = _converse.api.modal.get('converse-add-muc-modal');
                await u.waitUntil(() => u.isVisible(modal), 1000);
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
                    _converse.chatboxes.models.map(m => m.get('id')).includes('lounge\\40conference@muc.example.org')
                ).toBe(true);
            }
        )
    );
});
