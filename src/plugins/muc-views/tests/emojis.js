import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { sizzle } = converse.env;
const u = converse.env.utils;

/**
 * Open a MUC and wait until its composer is on screen.
 * @param {any} _converse
 */
async function openMUC(_converse, muc_jid = 'lounge@montague.lit') {
    await mock.waitForRoster(_converse, 'current', 0);
    await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
    const view = _converse.chatboxviews.get(muc_jid);
    await u.waitUntil(() => view.querySelector('.chat-rich__editable'));
    return view;
}

describe('Emojis', function () {
    describe('The emoji picker', function () {
        it(
            'inserts an emoji into the composer when one is clicked',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const view = await openMUC(_converse);
                await u.waitUntil(() => view.querySelector('converse-emoji-dropdown'));

                const toolbar = view.querySelector('converse-chat-toolbar');
                toolbar.querySelector('.toggle-emojis').click();
                await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')));

                const item = await u.waitUntil(() => view.querySelector('.emoji-picker li.insert-emoji a'));
                item.click();
                // Insertion goes through the editor, which may still be loading.
                await u.waitUntil(() => mock.composerText(view).length);
            }),
        );

        it(
            'allows you to search for particular emojis',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const view = await openMUC(_converse);
                await u.waitUntil(() => view.querySelector('converse-emoji-dropdown'));
                const toolbar = view.querySelector('converse-chat-toolbar');
                toolbar.querySelector('.toggle-emojis').click();
                await u.waitUntil(() => u.isVisible(view.querySelector('.emoji-picker__lists')));
                await u.waitUntil(() => sizzle('converse-chat-toolbar .insert-emoji:not(.hidden)', view).length > 500);

                const input = view.querySelector('.emoji-search');
                input.value = 'smiley';
                const event = {
                    'target': input,
                    'preventDefault': function preventDefault() {},
                    'stopPropagation': function stopPropagation() {},
                };
                input.dispatchEvent(new KeyboardEvent('keydown', event));

                await u.waitUntil(
                    () => sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden)', view).length === 2,
                    1000,
                );
                let visible_emojis = sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden)', view);
                expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':smiley:');
                expect(visible_emojis[1].getAttribute('data-emoji')).toBe(':smiley_cat:');

                // Check that pressing enter without an unambiguous match does nothing
                const enter_event = Object.assign({}, event, { key: 'Enter', 'bubbles': true });
                input.dispatchEvent(new KeyboardEvent('keydown', enter_event));
                expect(input.value).toBe('smiley');

                // Check that search results update when chars are deleted
                input.value = 'sm';
                input.dispatchEvent(new KeyboardEvent('keydown', event));
                await u.waitUntil(
                    () => sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden)', view).length === 25,
                    1000,
                );

                input.value = 'smiley';
                input.dispatchEvent(new KeyboardEvent('keydown', event));
                await u.waitUntil(
                    () => sizzle('.emojis-lists__container--search .insert-emoji:not(.hidden)', view).length === 2,
                    1000,
                );

                // Test that TAB autocompletes to the first match
                const tab_event = Object.assign({}, event, { 'key': 'Tab' });
                input.dispatchEvent(new KeyboardEvent('keydown', tab_event));

                await u.waitUntil(() => input.value === ':smiley:');
                await u.waitUntil(
                    () => sizzle(".emojis-lists__container--search .insert-emoji:not('.hidden')", view).length === 1,
                    1000,
                );
                visible_emojis = sizzle(".emojis-lists__container--search .insert-emoji:not('.hidden')", view);
                expect(visible_emojis[0].getAttribute('data-emoji')).toBe(':smiley:');

                // Check that ENTER now inserts the match
                input.dispatchEvent(new KeyboardEvent('keydown', enter_event));
                await u.waitUntil(() => input.value === '');
                await u.waitUntil(() => mock.composerText(view) === ':smiley:');
            }),
        );
    });

    describe('The emoji typeahead', function () {
        it(
            'completes emoji shortnames from the caret',
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const view = await openMUC(_converse);
                const form = mock.getMessageForm(view);
                await form.ensureEditor();

                // The menu only opens while the editor has focus, since Lexical keeps its
                // selection across a blur.
                view.querySelector('.chat-rich__editable').focus();
                // Report a `:smi` trigger under the caret. Matched on the pattern rather
                // than by identity: the spec's copy of the regex is not the bundle's.
                form._handle.getTriggerQuery = (re) => (re.source.includes(':(') ? 'smi' : null);

                await form.typeahead.update();

                // The MUC composer carries both an emoji and a mention source, so this
                // also pins down that the emoji one still wins on a `:` trigger.
                expect(form.typeahead.kind).toBe('emoji');
                expect(form.typeahead.items.length).toBeGreaterThan(0);
                for (const item of form.typeahead.items) {
                    expect(item.label.includes('smi')).toBe(true);
                    expect(item.glyph).toBeTruthy();
                }
            }),
        );
    });
});
