/* global mock */

describe("A Call Button", function () {

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
        const call_button = toolbar.querySelector('converse-jingle-toolbar-button');
        // Now check that the state changes
        // toggleJingleCallStatus
        const chatbox = view.model;
        call_button.click();
        expect(chatbox.get('jingle_status') === _converse.JINGLE_CALL_STATUS.PENDING);
        call_button.click();        
    }));
});
