/* global mock */

describe("The persistent store", function() {

    it("is unique to the user based on their JID",
            mock.initConverse([], {'persistent_store': 'IndexedDB'}, (_converse) => {

        expect(_converse.storage.persistent.config().storeName).toBe(_converse.bare_jid);
        expect(_converse.storage.persistent.config().description).toBe('indexedDB instance');
    }));
});
