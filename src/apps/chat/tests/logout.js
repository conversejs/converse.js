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
});
