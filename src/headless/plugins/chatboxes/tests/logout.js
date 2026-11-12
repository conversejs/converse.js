import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

describe('Logging out', function () {
    it(
        'lets go of the open chats on a device that keeps its cache',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await api.chats.open(contact_jid);
            const muc = await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            expect(muc.message_handler).toBeDefined();

            // As on a device that keeps its cache, which tests otherwise clear.
            const clear = vi.spyOn(state.chatboxes, 'clearStore').mockResolvedValue(undefined);
            await api.user.logout();

            expect(state.chatboxes.filter((c) => c.get('type') !== 'controlbox')).toEqual([]);
            expect(muc.message_handler).toBeUndefined();
            clear.mockRestore();
        }),
    );
});

describe('Reconnecting anonymously', function () {
    it(
        'keeps the open rooms, to rejoin them',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            const muc = await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const connection = api.connection.get();

            // An anonymous reconnection clears the session before logging in again.
            api.settings.set('authentication', 'anonymous');
            const login = vi.spyOn(api.user, 'login').mockResolvedValue(undefined);
            // As on a device that keeps its cache, which tests otherwise clear.
            const clear = vi.spyOn(state.chatboxes, 'clearStore').mockResolvedValue(undefined);
            try {
                await connection.reconnect();
                expect(login).toHaveBeenCalledOnce();
            } finally {
                clear.mockRestore();
                api.settings.set('authentication', 'login');
                delete connection.reconnecting;
            }
            expect(state.chatboxes.get(muc.get('jid'))).toBe(muc);
            expect(muc.message_handler).toBeDefined();
        }),
    );
});
