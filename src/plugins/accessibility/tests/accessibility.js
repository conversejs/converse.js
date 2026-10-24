import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/**
 * @param {KeyboardEventInit} init
 */
function pressKeys(init) {
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

const showHelp = () => pressKeys({ key: '/', ctrlKey: true });
const nextUnread = () => pressKeys({ key: 'ArrowDown', altKey: true, shiftKey: true });
const previousUnread = () => pressKeys({ key: 'ArrowUp', altKey: true, shiftKey: true });

/**
 * Opens a chat with mercutio and two hidden chats with unread messages, in
 * that order.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 */
async function openChatsWithUnreadMessages(_converse) {
    await mock.waitForRoster(_converse, 'current');
    await mock.openChatBoxFor(_converse, 'mercutio@montague.lit');
    const chatboxes = [];
    for (const name of mock.cur_names.slice(1, 3)) {
        const jid = name.replace(/ /g, '.').toLowerCase() + '@montague.lit';
        const chatbox = await _converse.api.chats.get(jid, {}, true);
        chatbox.save({ hidden: true, num_unread: 1 });
        chatboxes.push(chatbox);
    }
    return chatboxes;
}

const liveRegionText = () => document.getElementById('converse-live-region')?.textContent ?? '';

describe('The accessibility plugin', function () {
    describe('keyboard shortcuts', function () {
        it(
            'show the shortcuts help with Ctrl+/',
            mock.initConverse(converse, [], {}, async (_converse) => {
                showHelp();
                const modal = await u.waitUntil(() => _converse.api.modal.get('converse-keyboard-shortcuts-modal'));
                await u.waitUntil(() => u.isVisible(modal));
                expect(modal.querySelector('.modal-title').textContent.trim()).toBe('Keyboard shortcuts');
                const labels = Array.from(modal.querySelectorAll('kbd')).map((el) => el.textContent);
                expect(labels).toEqual(['Ctrl+/', 'Alt+Shift+↓', 'Alt+Shift+↑']);
            }),
        );

        it(
            'open the next chat with unread messages with Alt+Shift+Down',
            mock.initConverse(converse, [], {}, async (_converse) => {
                const [first, second] = await openChatsWithUnreadMessages(_converse);
                nextUnread();
                await u.waitUntil(() => !first.get('hidden'));
                expect(second.get('hidden')).toBe(true);
            }),
        );

        it(
            'open the previous chat with unread messages with Alt+Shift+Up',
            mock.initConverse(converse, [], {}, async (_converse) => {
                const [first, second] = await openChatsWithUnreadMessages(_converse);
                previousUnread();
                await u.waitUntil(() => !second.get('hidden'));
                expect(first.get('hidden')).toBe(true);
            }),
        );

        it(
            'announce when there are no chats with unread messages',
            mock.initConverse(converse, [], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                await mock.openChatBoxFor(_converse, 'mercutio@montague.lit');
                nextUnread();
                await u.waitUntil(() => liveRegionText() === 'No chats with unread messages');

                const region = document.getElementById('converse-live-region');
                expect(region.parentElement.matches('converse-root')).toBe(true);
                expect(region.classList.contains('visually-hidden')).toBe(true);
            }),
        );

        it(
            'are ignored when disabled',
            mock.initConverse(converse, [], { enable_keyboard_shortcuts: false }, async (_converse) => {
                showHelp();
                await new Promise((resolve) => setTimeout(resolve, 100));
                expect(_converse.api.modal.get('converse-keyboard-shortcuts-modal')).toBeUndefined();
            }),
        );
    });
});
