/* global mock, converse */
const u = converse.env.utils;

describe("A Jingle Status", function () {

    it("has been shown in the toolbar",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        spyOn(_converse.api, "trigger").and.callThrough();
        // First check that the button does show
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        const toolbar = view.querySelector('.chat-toolbar');
        const call_button = toolbar.querySelector('converse-jingle-toolbar-button button');
        // Now check that the state changes
        // toggleJingleCallStatus
        const chatbox = view.model;
        call_button.click();
        expect(chatbox.get('jingle_status')).toBe(_converse.JINGLE_CALL_STATUS.OUTGOING_PENDING);
        }));

    fit("has been shown in the chat-header",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        spyOn(_converse.api, "trigger").and.callThrough();
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        const chat_head = view.querySelector('.chatbox-title--row');
        const chatbox = view.model;
        chatbox.save('jingle_status', _converse.JINGLE_CALL_STATUS.OUTGOING_PENDING);
        const header_notification = chat_head.querySelector('converse-call-notification');
        const call_intialized = await u.waitUntil(() => header_notification.querySelector('.jingle-call-initiated-button'));
        call_intialized.click();
        expect(chatbox.get('jingle_status') === _converse.JINGLE_CALL_STATUS.ENDED);
    }));
});
