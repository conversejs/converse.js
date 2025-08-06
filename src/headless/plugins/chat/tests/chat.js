/* global converse */
import mock from "../../../tests/mock.js";

describe("A ChatBox", function() {

    it("considers both 'chat' and 'normal' messages as chat messages", mock.initConverse(
            ['rosterInitialized', 'chatBoxesInitialized'], {},
            async (_converse) => {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);

        const { handleMessageStanza } = _converse;
        await handleMessageStanza(mock.createChatMessage(_converse, contact_jid, 'This is an info message', 'info'));
        await handleMessageStanza(mock.createChatMessage(_converse, contact_jid, 'This is a normal message', 'normal'));
        await handleMessageStanza(mock.createChatMessage(_converse, contact_jid, 'This is a chat message', 'chat'));

        const chatbox = _converse.state.chatboxes.get(contact_jid);
        const oldest_msg = chatbox.getOldestMessage();
        expect(oldest_msg.get('message')).toBe('This is a normal message');

        const newest_msg = chatbox.getMostRecentMessage();
        expect(newest_msg.get('message')).toBe('This is a chat message');
    }));
});
