import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('An unsent groupchat message', function () {
    it(
        'will be saved as a draft when switching chats',
        mock.initConverse(converse, [], { view_mode: 'fullscreen' }, async function (_converse) {
            const muc1_jid = 'lounge@montague.lit';
            const muc2_jid = 'garden@montague.lit';

            await mock.openAndEnterMUC(_converse, muc1_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc1_jid);

            await mock.setComposerText(view, 'This is an unsaved message');

            await mock.openAndEnterMUC(_converse, muc2_jid, 'romeo');

            // Switch back to the room with the draft. Re-fetch the view: switching rooms
            // re-creates the element, so the one captured above is detached by now.
            document.querySelector(`converse-rooms-list li[data-room-jid="${muc1_jid}"] a`).click();
            await u.waitUntil(
                () => mock.composerText(_converse.chatboxviews.get(muc1_jid)) === 'This is an unsaved message',
            );
        }),
    );
});
