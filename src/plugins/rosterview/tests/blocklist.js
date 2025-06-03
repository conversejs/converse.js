const { u } = converse.env;

describe('The Blocklist Modal', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'shows a message when there are no blocked users',
        mock.initConverse([], {}, async function (_converse) {
            await mock.waitUntilBlocklistInitialized(_converse);
            const modal = await _converse.api.modal.show('converse-blocklist-modal');
            await u.waitUntil(() => modal.querySelector('p'));
            expect(modal.querySelector('p').textContent.trim()).toBe('No blocked XMPP addresses');
        })
    );

    it(
        'shows blocked users and allows unblocking them',
        mock.initConverse([], {}, async function (_converse) {
            await mock.waitUntilBlocklistInitialized(_converse);

            const { api } = _converse;
            const connection = api.connection.get();
            const { sent_stanzas } = connection;
            const own_jid = _converse.session.get('jid');

            // Need at least 6 users to show the filter
            api.blocklist.add([
                'user1@example.com',
                'user2@example.com',
                'user3@example.com',
                'user4@example.com',
                'user5@example.com',
                'user6@example.com',
            ]);
            let stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.matches('iq[type="set"]')).pop());

            expect(stanza).toEqualStanza(stx`
                <iq type="set" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                    <block xmlns="urn:xmpp:blocking">
                        <item jid="user1@example.com"/>
                        <item jid="user2@example.com"/>
                        <item jid="user3@example.com"/>
                        <item jid="user4@example.com"/>
                        <item jid="user5@example.com"/>
                        <item jid="user6@example.com"/>
                    </block>
                </iq>`);

            const result = stx`
                <iq type="result"
                    id="${stanza.getAttribute('id')}"
                    to="${own_jid}"
                    xmlns="jabber:client"/>`;
            connection._dataRecv(mock.createRequest(result));

            const modal = await api.modal.show('converse-blocklist-modal');
            await u.waitUntil(() => modal.querySelector('ul.items-list'));

            // Verify users are shown
            const items = modal.querySelectorAll('ul.items-list li');
            expect(items.length).toBe(6);
            expect(items[0].querySelector('label').textContent.trim()).toBe('user1@example.com');
            expect(items[1].querySelector('label').textContent.trim()).toBe('user2@example.com');
            expect(items[2].querySelector('label').textContent.trim()).toBe('user3@example.com');
            expect(items[3].querySelector('label').textContent.trim()).toBe('user4@example.com');
            expect(items[4].querySelector('label').textContent.trim()).toBe('user5@example.com');
            expect(items[5].querySelector('label').textContent.trim()).toBe('user6@example.com');

            // Test filtering
            const input = modal.querySelector('input[name="blocklist_filter"]');
            input.value = 'user1';
            input.dispatchEvent(new Event('input'));

            await u.waitUntil(() => modal.querySelectorAll('ul.items-list li').length === 1);
            expect(modal.querySelector('ul.items-list li label').textContent.trim()).toBe('user1@example.com');

            // Clear filter
            modal.querySelector('button.btn-outline-secondary').click();
            await u.waitUntil(() => modal.querySelectorAll('ul.items-list li').length === 6);

            // Test select all
            const selectAll = modal.querySelector('#select-all');
            selectAll.click();

            const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((cb) => {
                expect(cb.checked).toBe(true);
            });

            while (sent_stanzas.length) sent_stanzas.pop();

            // Test unblocking
            spyOn(api.toast, 'show').and.callThrough();
            const form = modal.querySelector('form');
            form.dispatchEvent(new Event('submit', { bubbles: true }));

            // Mock unblock response
            stanza = await u.waitUntil(() => sent_stanzas.filter((s) => s.matches('iq[type="set"]')).pop());

            expect(stanza).toEqualStanza(stx`
                <iq type="set" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                    <unblock xmlns="urn:xmpp:blocking">
                        <item jid="user1@example.com"/>
                        <item jid="user2@example.com"/>
                        <item jid="user3@example.com"/>
                        <item jid="user4@example.com"/>
                        <item jid="user5@example.com"/>
                        <item jid="user6@example.com"/>
                    </unblock>
                </iq>`);

            const unblock_result = stx`
                <iq type="result"
                    id="${stanza.getAttribute('id')}"
                    to="${own_jid}"
                    xmlns="jabber:client"/>`;
            connection._dataRecv(mock.createRequest(unblock_result));

            await u.waitUntil(() => api.toast.show.calls.count() === 1);
            expect(api.toast.show).toHaveBeenCalledWith('blocked', {
                type: 'success',
                body: 'Successfully unblocked 6 XMPP addresses',
            });
        })
    );
});
