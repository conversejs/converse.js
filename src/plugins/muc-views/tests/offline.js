import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('A MUC loaded from the cache while there is no connection', function () {
    it(
        'shows its messages',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            await muc.messages.create({ body: 'Hello all', type: 'groupchat', nick: 'juliet', msgid: 'm1' });
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-muc-chatarea .chat-msg__text'));

            muc.session.save({ connection_status: converse.ROOMSTATUS.OFFLINE });
            await u.waitUntil(() => !view.querySelector('converse-muc-disconnected'));
            const text = await u.waitUntil(() => view.querySelector('converse-muc-chatarea .chat-msg__text'));
            expect(text.textContent).toBe('Hello all');
        }),
    );
});
