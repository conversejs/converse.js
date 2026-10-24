import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/**
 * @param {string} code
 */
function pressShortcut(code) {
    document.dispatchEvent(new KeyboardEvent('keydown', { code, altKey: true, shiftKey: true, bubbles: true }));
}

const liveRegionText = () => document.getElementById('converse-live-region')?.textContent ?? '';

describe('The accessibility plugin', function () {
    describe('keyboard shortcuts', function () {
        it(
            'show the shortcuts help with Alt+Shift+H',
            mock.initConverse(converse, [], {}, async (_converse) => {
                pressShortcut('KeyH');
                const modal = await u.waitUntil(() => _converse.api.modal.get('converse-keyboard-shortcuts-modal'));
                await u.waitUntil(() => u.isVisible(modal));
                expect(modal.querySelector('.modal-title').textContent.trim()).toBe('Keyboard shortcuts');
                const labels = Array.from(modal.querySelectorAll('kbd')).map((el) => el.textContent);
                expect(labels).toEqual(['Alt+Shift+H', 'Alt+Shift+C', 'Alt+Shift+N']);
            }),
        );

        it(
            'focus the composer of the open chat with Alt+Shift+C',
            mock.initConverse(converse, [], { auto_focus: false }, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                const view = await mock.openChatBoxFor(_converse, 'mercutio@montague.lit');
                const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
                textarea.blur();
                expect(document.activeElement).not.toBe(textarea);

                pressShortcut('KeyC');
                expect(document.activeElement).toBe(textarea);
            }),
        );

        it(
            'focus the composer of the chat that has focus with Alt+Shift+C',
            mock.initConverse(converse, [], { auto_focus: false }, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                const first = await mock.openChatBoxFor(_converse, 'mercutio@montague.lit');
                const jid = mock.cur_names[1].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                const second = await mock.openChatBoxFor(_converse, jid);
                const first_textarea = await u.waitUntil(() => first.querySelector('.chat-textarea'));
                const second_textarea = await u.waitUntil(() => second.querySelector('.chat-textarea'));

                // Without focus in a chat, the most recently opened one is used
                document.activeElement?.blur();
                pressShortcut('KeyC');
                expect(document.activeElement).toBe(second_textarea);

                const content = first.querySelector('.chat-content');
                content.setAttribute('tabindex', '-1');
                content.focus();
                pressShortcut('KeyC');
                expect(document.activeElement).toBe(first_textarea);
            }),
        );

        it(
            'open the next chat with unread messages with Alt+Shift+N',
            mock.initConverse(converse, [], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                await mock.openChatBoxFor(_converse, 'mercutio@montague.lit');
                const jid = mock.cur_names[1].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                const chatbox = await _converse.api.chats.get(jid, {}, true);
                chatbox.save({ hidden: true, num_unread: 1 });

                pressShortcut('KeyN');
                await u.waitUntil(() => !chatbox.get('hidden'));
            }),
        );

        it(
            'announce when there are no chats with unread messages',
            mock.initConverse(converse, [], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                await mock.openChatBoxFor(_converse, 'mercutio@montague.lit');
                pressShortcut('KeyN');
                await u.waitUntil(() => liveRegionText() === 'No chats with unread messages');

                const region = document.getElementById('converse-live-region');
                expect(region.parentElement.matches('converse-root')).toBe(true);
                expect(region.classList.contains('visually-hidden')).toBe(true);
            }),
        );

        it(
            'are ignored when disabled',
            mock.initConverse(converse, [], { enable_keyboard_shortcuts: false }, async (_converse) => {
                pressShortcut('KeyH');
                await new Promise((resolve) => setTimeout(resolve, 100));
                expect(_converse.api.modal.get('converse-keyboard-shortcuts-modal')).toBeUndefined();
            }),
        );
    });
});
