import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

async function openChat(_converse) {
    await mock.waitForRoster(_converse, 'current', 1);
    const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
    await mock.openChatBoxFor(_converse, contact_jid);
    return _converse.chatboxviews.get(contact_jid);
}

describe('The rich chat composer', function () {
    it(
        'replaces the textarea with a contenteditable when enabled',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const view = await openChat(_converse);
                await u.waitUntil(() => view.querySelector('.chat-rich__editable'));

                expect(view.querySelector('textarea')).toBe(null);
                // The editable keeps the chat-textarea class, so the views that focus the
                // composer by that selector go on working.
                const editable = view.querySelector('.chat-rich__editable');
                expect(editable.classList.contains('chat-textarea')).toBe(true);
                expect(editable.getAttribute('contenteditable')).toBe('true');
        }),
    );

    it(
        'sends the body as XEP-0393 styling markers',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const view = await openChat(_converse);
                await u.waitUntil(() => view.querySelector('.chat-rich__editable'));
                const form = view.querySelector('converse-message-form-rich');

                const handle = await form.ensureEditor();
                handle.setMarkdown('*bold* _italic_');

                // What reaches headless must be a plain string a textarea user could have
                // typed: no markup, no XHTML, just the markers.
                const sendMessage = vi.spyOn(view.model, 'sendMessage').mockResolvedValue({});
                await form.onFormSubmitted();

                expect(sendMessage).toHaveBeenCalledTimes(1);
                expect(sendMessage.mock.calls[0][0].body).toBe('*bold* _italic_');
        }),
    );

    it(
        'restores a draft into the editor',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const view = await openChat(_converse);
                await u.waitUntil(() => view.querySelector('.chat-rich__editable'));
                const form = view.querySelector('converse-message-form-rich');

                // The quote action and the hide-the-chat handler both stash text in `draft`.
                view.model.set('draft', '> quoted me');
                const handle = await form.ensureEditor();

                expect(handle.getMarkdown()).toBe('> quoted me');
                expect(form.getInputText()).toBe('> quoted me');
        }),
    );
});
