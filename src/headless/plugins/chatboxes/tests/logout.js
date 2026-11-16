import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { u } = converse.env;

describe('Logging out', function () {
    it(
        'lets go of the open chats on a device that keeps its cache',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const add = vi.spyOn(window, 'addEventListener');
            const remove = vi.spyOn(window, 'removeEventListener');
            // Only writes to IndexedDB are batched, and flushed on leaving the page.
            api.settings.set('persistent_store', 'IndexedDB');
            const chat = await api.chats.open(contact_jid);
            api.settings.set('persistent_store', 'localStorage');
            const muc = await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            expect(muc.message_handler).toBeDefined();
            // An occupant has a store of its own, for the private messages exchanged with it.
            api.settings.set('persistent_store', 'IndexedDB');
            const occupant = muc.occupants.create({ nick: 'juliet', jid: 'juliet@montague.lit' });
            api.settings.set('persistent_store', 'localStorage');

            // As on a device that keeps its cache, which tests otherwise clear.
            const clear = vi.spyOn(state.chatboxes, 'clearStore').mockResolvedValue(undefined);
            [chat, muc].forEach((c) => vi.spyOn(c, 'clearCache').mockResolvedValue(undefined));
            await api.user.logout();

            expect(state.chatboxes.filter((c) => c.get('type') !== 'controlbox')).toEqual([]);
            expect(muc.message_handler).toBeUndefined();
            clear.mockRestore();

            // Leaving the page no longer flushes their messages.
            const flush = vi.spyOn(chat.messages.storage, 'flush');
            const flush_private = vi.spyOn(occupant.messages.storage, 'flush');
            const listeners = (/** @type {any} */ spy) =>
                spy.mock.calls.filter(([name]) => name === 'pagehide').map(([, listener]) => listener);
            const removed = listeners(remove);
            listeners(add)
                .filter((/** @type {Function} */ l) => !removed.includes(l))
                .forEach((/** @type {Function} */ l) => l());
            expect(flush).not.toHaveBeenCalled();
            expect(flush_private).not.toHaveBeenCalled();
        }),
    );
});

describe('Logging out on a device that clears its cache', function () {
    it(
        'removes what is stored of the rooms, their occupants and private messages',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            const muc = await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const occupant = muc.occupants.create({ nick: 'juliet', jid: 'juliet@montague.lit' });
            await new Promise((success) =>
                occupant.messages.create({ body: 'psst', msgid: 'pm1', type: 'chat' }, { success }),
            );

            const stores = [
                muc.session.storage,
                muc.features.storage,
                muc.config.storage,
                muc.occupants.storage,
                occupant.messages.storage,
            ];
            const stored = async () => {
                const keys = await Promise.all(stores.map((s) => s.store.keys()));
                return stores.flatMap((s, i) => keys[i].filter((k) => k.startsWith(s.name)));
            };
            expect(await stored()).not.toEqual([]);

            const add = vi.spyOn(window, 'addEventListener');
            const remove = vi.spyOn(window, 'removeEventListener');
            // Only writes to IndexedDB are batched, and flushed on leaving the page.
            api.settings.set('persistent_store', 'IndexedDB');
            const batched = muc.occupants.create({ nick: 'nurse', jid: 'nurse@montague.lit' });
            api.settings.set('persistent_store', 'localStorage');

            await api.user.logout();
            expect(await stored()).toEqual([]);

            // Leaving the page no longer flushes the private messages.
            const flush = vi.spyOn(batched.messages.storage, 'flush');
            const listeners = (/** @type {any} */ spy) =>
                spy.mock.calls.filter(([name]) => name === 'pagehide').map(([, listener]) => listener);
            const removed = listeners(remove);
            listeners(add)
                .filter((/** @type {Function} */ l) => !removed.includes(l))
                .forEach((/** @type {Function} */ l) => l());
            expect(flush).not.toHaveBeenCalled();
        }),
    );
});

describe('Reconnecting anonymously', function () {
    it(
        'keeps the open rooms and their messages, and rejoins them',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api, state } = _converse;
            const muc_jid = 'lounge@montague.lit';
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            await muc.sendMessage({ body: 'hello' });
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const chat = await api.chats.open(contact_jid);
            const clearCache = vi.spyOn(chat, 'clearCache');
            const { IQ_stanzas, sent_stanzas } = api.connection.get();
            // So that the room's disco query is the one sent on rejoining.
            IQ_stanzas.length = 0;
            const joins = () =>
                sent_stanzas.filter((s) => s.nodeName === 'presence' && s.getAttribute('to') === `${muc_jid}/romeo`);
            const joined = joins().length;

            // The domain to log in at, which gives out the new account.
            api.settings.set({ authentication: 'anonymous', jid: 'montague.lit' });
            try {
                await api.connection.reconnect();
                await mock.waitForMUCDiscoInfo(_converse, muc_jid, []);
                await u.waitUntil(() => joins().length === joined + 1);
            } finally {
                api.settings.set({ authentication: 'login', jid: undefined });
            }
            expect(state.chatboxes.get(muc_jid)).toBe(muc);
            expect(muc.messages.map((m) => m.get('body'))).toEqual(['hello']);
            // A one-to-one chat was had as the old account, so it goes, with its history.
            expect(state.chatboxes.get(contact_jid)).toBeUndefined();
            expect(clearCache).toHaveBeenCalled();
            // What was cleared with the old account is there again for the new one.
            expect(state.vcards).toBeDefined();
            expect(state.popular_emojis).toBeDefined();
        }),
    );

    it(
        'reads the chats when the first connection only comes up on a retry',
        mock.initConverse(
            converse,
            [],
            { auto_login: false, authentication: 'anonymous', jid: 'montague.lit' },
            async (_converse) => {
                const { api } = _converse;
                // It never connected, so this retries the first connection.
                await api.connection.reconnect();
                await api.waitUntil('chatBoxesFetched');
            },
        ),
    );
});
