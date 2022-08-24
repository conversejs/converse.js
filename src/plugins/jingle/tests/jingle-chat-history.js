/*global mock, converse */

const { u } = converse.env;

describe("A jingle chat message", function () {

    it("will be displayed on the initiator's",
        mock.initConverse(['chatBoxesFetched'], {},
            async function (_converse) {

                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                const call_button = view.querySelector('converse-jingle-toolbar-button button');
                call_button.click();
                const initiator_message = await u.waitUntil(() => view.querySelectorAll('converse-message-history converse-chat-message .chat-msg__text ')?.textContent === 'Initiated a Call at');
                expect(initiator_message).toBe().not(undefined);
            }));
});
