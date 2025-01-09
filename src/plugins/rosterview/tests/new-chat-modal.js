/*global mock, converse */
const { u } = converse.env;

describe('New Chat Modal', function () {
    it(
        'should open a new chat with a valid JID',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);

            const jid = 'romeo@montague.lit';
            const cbview = _converse.chatboxviews.get('controlbox');
            const dropdown = await u.waitUntil(() => cbview.querySelector('.dropdown--contacts'));
            dropdown.querySelector('.new-chat').click();

            const modal = api.modal.get('converse-new-chat-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            const input = modal.querySelector('input[name="jid"]');
            input.value = jid;

            const form = modal.querySelector('form');
            form.querySelector('button[type="submit"]').click();

            await u.waitUntil(() => api.chats.get(jid));
            expect(modal.model.get('error')).toBe(null);
        })
    );

    it(
        'should return an error for an invalid JID',
        mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.openControlBox(_converse);

            const invalidJid = 'invalid-jid';
            const cbview = _converse.chatboxviews.get('controlbox');
            const dropdown = await u.waitUntil(() => cbview.querySelector('.dropdown--contacts'));
            dropdown.querySelector('.new-chat').click();

            const modal = api.modal.get('converse-new-chat-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            const input = modal.querySelector('input[name="jid"]');
            input.value = invalidJid;

            const form = modal.querySelector('form');
            form.querySelector('button[type="submit"]').click();

            await u.waitUntil(() => api.chats.get(invalidJid));

            const err_msg = 'Please enter a valid XMPP address';
            expect(modal.model.get('error')).toBeDefined();
            expect(modal.model.get('error')).toBe(err_msg);
            expect(modal.querySelector('.alert').textContent).toBe(err_msg);
        })
    );
});
