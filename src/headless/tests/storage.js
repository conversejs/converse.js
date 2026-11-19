import mock from './mock.js';
import converse from '../dist/converse-headless.js';

describe('The stores kept in IndexedDB', function () {
    it(
        'share one batch of pending writes, so that flushing one writes them all',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 2);
            const [first_jid, second_jid] = mock.cur_names
                .slice(0, 2)
                .map((name) => name.replace(/ /g, '.').toLowerCase() + '@montague.lit');
            // Only writes to IndexedDB are batched.
            api.settings.set('persistent_store', 'IndexedDB');
            const first = await api.chats.open(first_jid);
            const { store } = first.messages.storage;
            const batch = store.debouncedSetItems;
            expect(batch).toBeDefined();

            const second = await api.chats.open(second_jid);
            api.settings.set('persistent_store', 'localStorage');
            expect(second.messages.storage.store).toBe(store);
            expect(store.debouncedSetItems).toBe(batch);
        }),
    );
});
