import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('The Chat app, on logging out of a device that keeps its cache', function () {
    it(
        'no longer shows the chats and rooms, without closing them',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            const { api, state } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');

            const app = document.querySelector('converse-app-chat');
            await u.waitUntil(() => app.querySelector('converse-chat') && app.querySelector('converse-muc'));

            const chat = state.chatboxes.get(contact_jid);
            const room = state.chatboxes.get('lounge@montague.lit');
            const close_chat = vi.spyOn(chat, 'close');
            const close_room = vi.spyOn(room, 'close');

            await api.user.logout();
            await u.waitUntil(() => !app.querySelector('converse-chat, converse-muc'));

            // Closing would remove what's stored of them.
            expect(close_chat).not.toHaveBeenCalled();
            expect(close_room).not.toHaveBeenCalled();
        }),
    );

    it(
        'no longer resizes the chats once they are gone',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            const { api, state } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await mock.openChatBoxFor(_converse, contact_jid);
            const chat = state.chatboxes.get(contact_jid);

            // As on a device that keeps its cache, which tests otherwise clear.
            vi.spyOn(state.chatboxes, 'clearStore').mockResolvedValue(undefined);
            vi.spyOn(chat, 'clearCache').mockResolvedValue(undefined);
            await api.user.logout();
            await u.waitUntil(() => !view.isConnected);

            const set_dimensions = vi.spyOn(view, 'setDimensions');
            window.dispatchEvent(new Event('resize'));
            await new Promise((resolve) => setTimeout(resolve, 300));
            expect(set_dimensions).not.toHaveBeenCalled();
        }),
    );

    it(
        'keeps what is stored of the chats, whatever is saved before the next login',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            const { api, state } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);

            const { chatboxes } = state;
            const { storage } = chatboxes;
            const save = vi.spyOn(storage, 'save');
            // As on a device that keeps its cache, which tests otherwise clear.
            const clear = vi.spyOn(chatboxes, 'clearStore').mockResolvedValue(undefined);
            await api.user.logout();
            clear.mockRestore();
            save.mockClear();

            // The control box is still there, and saving it would write the
            // list of chats anew, without the ones no longer in memory.
            u.safeSave(chatboxes.get('controlbox'), { closed: true });
            expect(save).not.toHaveBeenCalled();
            const stored = await storage.store.getItem(storage.name);
            expect(stored).toContain(storage.getItemName(contact_jid));
        }),
    );
});
