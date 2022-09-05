/* global mock */

describe("A jingle chat history message", function () {

    it("has been shown in the chat",
    mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);
    const call_button = view.querySelector('converse-jingle-toolbar-button button');
    call_button.click();
    const jingle_chat_history_component = view.querySelector('converse-jingle-message');
    expect(jingle_chat_history_component).not.toBe(undefined);
    }));

    fit("has the end call button",
    mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    const view = _converse.chatboxviews.get(contact_jid);
    const call_button = view.querySelector('converse-jingle-toolbar-button button');
    call_button.click();
    const chatbox = view.model;
    const end_call_button = view.querySelector('converse-jingle-message button .end-call');
    expect(end_call_button).not.toBe(undefined);
    expect(chatbox.get('jingle_status')).toBe(_converse.JINGLE_CALL_STATUS.ENDED);
    }));
});
