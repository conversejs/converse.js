/*global mock, converse */

const { u } = converse.env;

describe('The visible_toolbar_buttons configuration setting', function () {

    it("can be used to show a participants toggle in a MUC's toolbar",
        mock.initConverse([], { 'visible_toolbar_buttons': { 'toggle_occupants': true } },
        async (_converse) => {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-chat-toolbar .toggle_occupants'));
            expect(1).toBe(1);
        })
    );
});
