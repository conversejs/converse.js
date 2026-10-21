import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { stx, u } = converse.env;

/**
 * @param {string} code
 */
function pressShortcut(code) {
    document.dispatchEvent(new KeyboardEvent('keydown', { code, altKey: true, shiftKey: true, bubbles: true }));
}

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @param {string} from
 * @param {string} body
 */
function receiveMessage(_converse, from, body) {
    return _converse.handleMessageStanza(stx`
        <message from="${from}"
                 to="${_converse.api.connection.get().jid}"
                 type="chat"
                 id="${u.getUniqueId()}"
                 xmlns="jabber:client">
            <body>${body}</body>
        </message>`);
}

const liveRegionText = () => document.getElementById('converse-live-region')?.textContent ?? '';

describe('The accessibility plugin', function () {
    describe('screen reader announcements', function () {
        it(
            'announce a message in a hidden chat',
            mock.initConverse(converse, [], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                const jid = 'mercutio@montague.lit';
                const view = await mock.openChatBoxFor(_converse, jid);
                view.model.save({ hidden: true });

                await receiveMessage(_converse, jid, 'Are you there?');
                const name = view.model.getDisplayName();
                await u.waitUntil(() => liveRegionText() === `${name}: Are you there?`);
            }),
        );

        it(
            'are not made for a message in the open chat',
            mock.initConverse(converse, [], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                const jid = 'mercutio@montague.lit';
                const view = await mock.openChatBoxFor(_converse, jid);

                await receiveMessage(_converse, jid, 'Are you there?');
                await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
                await new Promise((resolve) => setTimeout(resolve, 200));
                expect(liveRegionText()).toBe('');
            }),
        );

        it(
            'are not made when disabled',
            mock.initConverse(converse, [], { enable_screen_reader_announcements: false }, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                const jid = 'mercutio@montague.lit';
                const view = await mock.openChatBoxFor(_converse, jid);
                view.model.save({ hidden: true });

                await receiveMessage(_converse, jid, 'Are you there?');
                await u.waitUntil(() => view.model.messages.length === 1);
                await new Promise((resolve) => setTimeout(resolve, 200));
                expect(liveRegionText()).toBe('');
            }),
        );

        it(
            'announce a groupchat message that mentions you in a hidden groupchat',
            mock.initConverse(converse, [], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                const muc_jid = 'lounge@montague.lit';
                const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                model.save({ hidden: true });

                const nick = mock.chatroom_names[0];
                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`
                    <message from="${muc_jid}/${nick}"
                             id="${u.getUniqueId()}"
                             to="romeo@montague.lit"
                             type="groupchat"
                             xmlns="jabber:client">
                        <body>romeo: hello</body>
                        <reference xmlns="urn:xmpp:reference:0"
                                   begin="0"
                                   end="5"
                                   type="mention"
                                   uri="xmpp:romeo@montague.lit"/>
                    </message>`,
                    ),
                );
                await u.waitUntil(() => liveRegionText() === `${nick} in ${model.getDisplayName()}: romeo: hello`);
            }),
        );
    });

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
            'are ignored when disabled',
            mock.initConverse(converse, [], { enable_keyboard_shortcuts: false }, async (_converse) => {
                pressShortcut('KeyH');
                await new Promise((resolve) => setTimeout(resolve, 100));
                expect(_converse.api.modal.get('converse-keyboard-shortcuts-modal')).toBeUndefined();
            }),
        );
    });
});
