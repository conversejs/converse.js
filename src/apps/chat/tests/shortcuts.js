import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/**
 * @param {KeyboardEventInit} init
 */
function pressKeys(init) {
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

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

describe('The Chat app keyboard shortcuts', function () {
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
});
