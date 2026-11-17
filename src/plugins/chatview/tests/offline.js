import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('A message sent while there is no connection', function () {
    it(
        'is shown as not sent yet, until it is sent once connected again',
        mock.initConverse(converse, ['chatBoxesFetched'], { show_send_button: true }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const reconnect = mock.dropConnection(_converse);
            expect(view.querySelector('.send-button').disabled).toBe(false);
            await mock.setComposerText(view, 'Into the void');
            await mock.pressComposerKey(view, 'Enter');

            const pending = await u.waitUntil(() => view.querySelector('.chat-msg__send-pending-text'));
            expect(pending.textContent).toBe('Not sent yet');
            expect(view.querySelector('.chat-msg__text').textContent).toBe('Into the void');
            expect(view.querySelector('converse-message-form').getInputText()).toBe('');

            await reconnect();
            await u.waitUntil(() => !view.querySelector('.chat-msg__send-pending'));
            expect(view.querySelector('.chat-msg__text').textContent).toBe('Into the void');
            expect(view.querySelector('.chat-msg__send-failed')).toBeNull();
        }),
    );
});
