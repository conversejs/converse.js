import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { log, u } = converse.env;

// In its own file because emoji.json is loaded once per page, and each spec file gets a fresh page.
describe('The emoji picker, when emoji.json could not be loaded (#4132)', function () {
    let fetch_spy;
    let unhandled;

    beforeEach(() => {
        unhandled = vi.fn();
        window.addEventListener('unhandledrejection', unhandled);
        const fetch = window.fetch;
        fetch_spy = vi
            .spyOn(window, 'fetch')
            .mockImplementation((url, ...args) =>
                String(url).endsWith('/emoji.json')
                    ? Promise.resolve(new Response('', { status: 404 }))
                    : fetch(url, ...args),
            );
    });

    afterEach(() => {
        window.removeEventListener('unhandledrejection', unhandled);
        fetch_spy.mockRestore();
    });

    it(
        'opens without emojis',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            const error = vi.spyOn(log, 'error');
            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[2].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const toolbar = await u.waitUntil(() => view.querySelector('converse-chat-toolbar'));
            toolbar.querySelector('.toggle-emojis').click();

            // The header calls getTonedEmojis for every category icon, which is where #4132 crashed.
            await u.waitUntil(
                () => view.querySelectorAll('converse-emoji-picker .emoji-picker__header .emoji-category').length,
            );
            // The picker is re-rendered once it's shown, so query it afresh rather than keep a reference.
            const categories = Object.values(api.settings.get('emoji_categories')).filter(Boolean);
            await u.waitUntil(
                () =>
                    view.querySelectorAll('converse-emoji-picker .emoji-lists__container--browse ul.emoji-picker')
                        .length === categories.length,
            );
            expect(view.querySelectorAll('converse-emoji-picker .insert-emoji').length).toBe(0);
            expect(converse.emojis.json).toEqual({});
            const [, e] = error.mock.calls.find(([msg]) => String(msg).startsWith('Could not load the emoji data'));
            expect(e.message).toContain('/emoji.json (HTTP 404)');
            expect(e.message).toContain('assets_path');
            expect(unhandled).not.toHaveBeenCalled();
        }),
    );
});
