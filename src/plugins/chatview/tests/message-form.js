import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

describe('A message form', function () {
    it(
        'pastes files.',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const textarea = view.querySelector('textarea.chat-textarea');

            const clipboardData = new DataTransfer();
            clipboardData.items.add(new File(['test'], 'test.txt', { type: 'text/plain' }));

            // Create a paste event with clipboard data
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData,
            });

            // Dispatch the paste event
            textarea.dispatchEvent(pasteEvent);
            expect(pasteEvent.defaultPrevented).toBe(true);
        }),
    );

    it(
        'does not paste file if shift is pressed',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const textarea = view.querySelector('textarea.chat-textarea');

            const keyDownEvent = new KeyboardEvent('keydown', {
                key: 'Shift',
            });

            textarea.dispatchEvent(keyDownEvent);

            const clipboardData = new DataTransfer();
            clipboardData.items.add(new File(['test'], 'test.txt', { type: 'text/plain' }));

            // Create a paste event with clipboard data
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData,
            });

            // Dispatch the paste event
            textarea.dispatchEvent(pasteEvent);

            const keyUpEvent = new KeyboardEvent('keyup', {
                key: 'Shift',
            });

            textarea.dispatchEvent(keyUpEvent);

            expect(pasteEvent.defaultPrevented).toBe(false);
        }),
    );

    it(
        'cancels an in-progress message correction when Escape is pressed',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const message = await view.model.sendMessage({ body: 'hello world' });
            message.save('correcting', true);

            const textarea = view.querySelector('textarea.chat-textarea');
            const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
            textarea.dispatchEvent(escEvent);

            expect(message.get('correcting')).toBe(false);
            expect(escEvent.defaultPrevented).toBe(true);
        }),
    );

    it(
        'allows native paste if no files',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
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
