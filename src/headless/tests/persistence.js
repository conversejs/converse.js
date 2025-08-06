import mock from "../tests/mock.js";

describe("The persistent store", function() {

    xit("is unique to the user based on their JID",
            mock.initConverse([], {'persistent_store': 'IndexedDB'}, (_converse) => {
        const { session, storage } = _converse;
        const bare_jid = session.get('bare_jid');
        expect(storage.persistent.config().storeName).toBe(bare_jid);
        expect(storage.persistent.config().description).toBe('indexedDB instance');
    }));
});
