/*global mock, converse */
const { sizzle, u } = converse.env;

describe('A message form', function () {
    it(
        'allows native paste if no files',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const textarea = view.querySelector('textarea.chat-textarea');

            const clipboardData = new DataTransfer();
            clipboardData.setData('text/plain', 'Hello');

            // Create a paste event with clipboard data
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData,
            });

            // Dispatch the paste event
            textarea.dispatchEvent(pasteEvent);
            expect(pasteEvent.defaultPrevented).toBe(false);
        }),
    );
});
