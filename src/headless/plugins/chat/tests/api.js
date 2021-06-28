/* global mock, converse */

describe("The \"chats\" API", function() {

    it("has a method 'get' which returns the promise that resolves to a chat model", mock.initConverse(
            ['rosterInitialized', 'chatBoxesInitialized'], {},
            async (_converse) => {

        const u = converse.env.utils;

        await mock.openControlBox(_converse);
        await mock.waitForRoster(_converse, 'current', 2);

        // Test on chat that doesn't exist.
        let chat = await _converse.api.chats.get('non-existing@jabber.org');
        expect(chat).toBeFalsy();
        const jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        // Test on chat that's not open
        chat = await _converse.api.chats.get(jid);
        expect(chat === null).toBeTruthy();
        expect(_converse.chatboxes.length).toBe(1);

        // Test for one JID
        chat = await _converse.api.chats.open(jid);
        expect(chat instanceof Object).toBeTruthy();
        expect(chat.get('box_id')).toBe(`box-${jid}`);

        // Test for multiple JIDs
        await mock.openChatBoxFor(_converse, jid2);
        await u.waitUntil(() => _converse.chatboxes.length == 3);
        const list = await _converse.api.chats.get([jid, jid2]);
        expect(Array.isArray(list)).toBeTruthy();
        expect(list[0].get('box_id')).toBe(`box-${jid}`);
        expect(list[1].get('box_id')).toBe(`box-${jid2}`);
    }));

    it("has a method 'open' which opens and returns a promise that resolves to a chat model", mock.initConverse(
            ['chatBoxesInitialized'], {}, async (_converse) => {

        await mock.openControlBox(_converse);
        await mock.waitForRoster(_converse, 'current', 2);

        const jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const jid2 = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        // Test on chat that doesn't exist.
        let chat = await _converse.api.chats.get('non-existing@jabber.org');
        expect(chat).toBeFalsy();

        chat = await _converse.api.chats.open(jid);
        expect(chat instanceof Object).toBeTruthy();
        expect(chat.get('box_id')).toBe(`box-${jid}`);
        expect(
            Object.keys(chat),
            ['close', 'endOTR', 'focus', 'get', 'initiateOTR', 'is_chatroom', 'maximize', 'minimize', 'open', 'set']
        );

        // Test for multiple JIDs
        const list = await _converse.api.chats.open([jid, jid2]);
        expect(Array.isArray(list)).toBeTruthy();
        expect(list[0].get('box_id')).toBe(`box-${jid}`);
        expect(list[1].get('box_id')).toBe(`box-${jid2}`);
    }));
});
