import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { stx, u } = converse.env;

/**
 * The relative luminance of a computed colour, per WCAG 2. `getComputedStyle`
 * gives back `color(srgb r g b)` with 0-1 components for a `color-mix()` result
 * and `rgb(r, g, b)` for everything else.
 * @param {string} colour
 * @returns {number}
 */
function getRelativeLuminance(colour) {
    const [r, g, b] = colour.startsWith('color(')
        ? colour
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map((n) => Number(n) * 255)
        : colour.match(/\d+/g).slice(0, 3).map(Number);
    const channel = /** @param {number} c */ (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * @param {string} fg
 * @param {string} bg
 * @returns {number}
 */
function getContrastRatio(fg, bg) {
    const [lighter, darker] = [getRelativeLuminance(fg), getRelativeLuminance(bg)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Sends a presence from the contact carrying a status message, the way a real
 * one arrives.
 * @param {any} _converse
 * @param {string} full_jid
 * @param {string} message
 */
function receivePresenceWithStatus(_converse, full_jid, message) {
    const presence = stx`
        <presence from="${full_jid}" to="${_converse.jid}" xmlns="jabber:client">
            <status>${message}</status>
        </presence>`;
    _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, presence));
}

describe('The chat heading', function () {
    it(
        "shows the contact's status message, and keeps it current",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            // The status message rides on the contact's presence, and is kept
            // on the contact rather than on the chat.
            receivePresenceWithStatus(_converse, `${contact_jid}/resource`, 'Working on Converse');
            const desc = await u.waitUntil(() => view.querySelector('.chat-head__desc'));
            expect(desc.textContent.trim()).toBe('Working on Converse');

            const contact = await _converse.api.contacts.get(contact_jid);
            expect(contact.get('status')).toBe('Working on Converse');

            // Under the display name and to the right of the avatar, rather
            // than on a row of its own across the bottom of the header.
            const name = view.querySelector('.chatbox-title__text');
            const avatar = view.querySelector('.chat-head converse-avatar');
            expect(Math.round(desc.getBoundingClientRect().left)).toBe(Math.round(name.getBoundingClientRect().left));
            expect(desc.getBoundingClientRect().left).toBeGreaterThan(avatar.getBoundingClientRect().right);
            expect(desc.getBoundingClientRect().top).toBeGreaterThanOrEqual(name.getBoundingClientRect().bottom);

            // A later presence replaces it without the chat being reopened.
            receivePresenceWithStatus(_converse, `${contact_jid}/resource`, 'Out for lunch');
            await u.waitUntil(() => view.querySelector('.chat-head__desc')?.textContent.trim() === 'Out for lunch');

            // A name too long for the heading truncates rather than wrapping
            // and growing it.
            const one_line = Math.round(name.getBoundingClientRect().height);
            contact.save({ nickname: 'Bartholomew Montague-Capulet the Third of Verona' });
            await u.waitUntil(() => name.textContent.includes('Bartholomew'));

            expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
            expect(Math.round(name.getBoundingClientRect().height)).toBe(one_line);
        }),
    );

    it(
        'shows our own status message in a chat with ourselves',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            // Not mock.openChatBoxFor: that goes through the roster, and we're
            // not in our own.
            const own_jid = _converse.session.get('bare_jid');
            await _converse.api.chats.open(own_jid, {}, true);
            const view = await u.waitUntil(() => _converse.chatboxviews.get(own_jid));

            // Our own profile keeps the free text in `status_message`. Its
            // `status` is the availability, so reading that here would put
            // "away" under our name.
            _converse.state.profile.set({ status: 'away', status_message: 'Away from keyboard' });

            const desc = await u.waitUntil(() => view.querySelector('.chat-head__desc'));
            expect(desc.textContent.trim()).toBe('Away from keyboard');
        }),
    );

    it(
        'renders that status message legibly against the header',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            receivePresenceWithStatus(_converse, `${contact_jid}/resource`, 'Working on Converse');
            const desc = await u.waitUntil(() => view.querySelector('.chat-head__desc'));

            const name = view.querySelector('.chatbox-title__text .user');
            const head = view.querySelector('.chat-head-chatbox');
            const bg = getComputedStyle(head).backgroundColor;
            const desc_contrast = getContrastRatio(getComputedStyle(desc).color, bg);
            const name_contrast = getContrastRatio(getComputedStyle(name).color, bg);

            // Quieter than the name above it, which is what makes it read as
            // secondary. How legible either is against the header is a matter
            // for the theme.
            expect(desc_contrast).toBeLessThan(name_contrast);

            // But still text: this was painted --chat-header-bg-color, the
            // header's own background, which made it invisible in a 1:1 chat
            // while the MUC and headlines headers overrode the colour and
            // looked fine.
            expect(desc_contrast).toBeGreaterThan(2);
        }),
    );
});
