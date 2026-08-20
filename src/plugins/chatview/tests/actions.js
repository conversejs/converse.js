import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { stx, u } = converse.env;

describe('A Chat Message', function () {
    it(
        'Can be copied using a message action',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const firstMessageText = 'But soft, what light through yonder airlock breaks?';

            await mock.setComposerText(view, firstMessageText);
            await mock.pressComposerKey(view, 'Enter');
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

            const spyClipboard = spyOn(navigator.clipboard, 'writeText');
            let firstAction = view.querySelector('.chat-msg__action-copy');
            expect(firstAction).not.toBeNull();
            firstAction.click();
            expect(spyClipboard).toHaveBeenCalledOnceWith(firstMessageText);

            // Test messages from other users
            const secondMessageText = 'Hello';
            _converse.handleMessageStanza(
                stx`<message from="${contact_jid}"
                             to="${api.connection.get().jid}"
                             type="chat"
                             id="${u.getUniqueId()}"
                             xmlns="jabber:client">
                    <body>${secondMessageText}</body>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                </message>`,
            );
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);
            const copyActions = view.querySelectorAll('.chat-msg__action-copy');
            expect(copyActions.length).toBe(2);
            let secondAction = copyActions[copyActions.length - 1];
            expect(secondAction).not.toBeNull();
            secondAction.click();
            expect(spyClipboard).toHaveBeenCalledWith(secondMessageText);
        }),
    );

    it(
        'Can be quoted using a message action',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const firstMessageText = 'But soft, what light through yonder airlock breaks?';

            await mock.setComposerText(view, firstMessageText);
            await mock.pressComposerKey(view, 'Enter');
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);

            // Quote with empty text area
            expect(mock.composerText(view)).toBe('');
            let firstAction = view.querySelector('.chat-msg__action-quote');
            expect(firstAction).not.toBeNull();
            firstAction.click();
            await u.waitUntil(() => mock.composerText(view) === `> ${firstMessageText}`);

            // Quote with already-present text
            await mock.setComposerText(view, 'Hi!');

            firstAction.click();
            // A blank line separates the paragraph from the quote block, which is how both
            // markdown and XEP-0393 delimit blocks.
            await u.waitUntil(() => mock.composerText(view) === `Hi!\n\n> ${firstMessageText}`);

            // Test messages from other users
            await mock.setComposerText(view, '');

            const secondMessageText = 'Hello';
            _converse.handleMessageStanza(
                stx`<message from="${contact_jid}"
                             to="${api.connection.get().jid}"
                             type="chat"
                             id="${u.getUniqueId()}"
                             xmlns="jabber:client">
                    <body>${secondMessageText}</body>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                </message>`,
            );
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);

            const quoteActions = view.querySelectorAll('.chat-msg__action-quote');
            expect(quoteActions.length).toBe(2);
            let secondAction = quoteActions[quoteActions.length - 1];
            expect(secondAction).not.toBeNull();
            secondAction.click();
            await u.waitUntil(() => mock.composerText(view) === `> ${secondMessageText}`);
        }),
    );
});
