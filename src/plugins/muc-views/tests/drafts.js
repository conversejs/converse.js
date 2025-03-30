/*global mock, converse */
const { u } = converse.env;

describe("An unsent groupchat message", function () {
    it(
        "will be saved as a draft when switching chats",
        mock.initConverse([], { view_mode: "fullscreen" }, async function (_converse) {
            const muc1_jid = "lounge@montague.lit";
            const muc2_jid = "garden@montague.lit";

            await mock.openAndEnterMUC(_converse, muc1_jid, "romeo");
            const view = _converse.chatboxviews.get(muc1_jid);

            const textarea = await u.waitUntil(() => view.querySelector(".chat-textarea"));
            textarea.value = "This is an unsaved message";

            await mock.openAndEnterMUC(_converse, muc2_jid, "romeo");

            // Switch back to the room with the draft
            document.querySelector(`converse-rooms-list li[data-room-jid="${muc1_jid}"] a`).click();
            expect(view.querySelector(".chat-textarea").value).toBe("This is an unsaved message");
        })
    );
});
