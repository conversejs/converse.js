import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('A MUC loaded from the cache while there is no connection', function () {
    it(
        'shows its messages, a composer and its participants as last seen',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            await muc.messages.create({ body: 'Hello all', type: 'groupchat', nick: 'juliet', msgid: 'm1' });
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-muc-chatarea .chat-msg__text'));
            // Hidden in a viewport as narrow as the tests'
            muc.save({ hidden_occupants: false });
            await u.waitUntil(() => view.querySelector('converse-muc-occupants .occupants'));
            expect(view.querySelector('.occupants--stale')).toBeNull();

            await muc.loadOffline();
            await u.waitUntil(() => !view.querySelector('converse-muc-disconnected'));
            const text = await u.waitUntil(() => view.querySelector('converse-muc-chatarea .chat-msg__text'));
            expect(text.textContent).toBe('Hello all');
            expect(view.querySelector('converse-muc-message-form .chat-rich__editable')).not.toBeNull();

            const occupants = await u.waitUntil(() => view.querySelector('.occupants--stale'));
            expect(occupants.querySelector('.occupants-stale-note').textContent).toBe(
                'As last seen. You are not in this groupchat while offline.',
            );
            expect(getComputedStyle(occupants.querySelector('.occupant-list')).opacity).toBe('0.5');
        }),
    );

    it(
        'has no composer if we were not in it',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-muc-message-form'));

            muc.session.save({ connection_status: converse.ROOMSTATUS.PASSWORD_REQUIRED });
            await muc.loadOffline();
            await u.waitUntil(() => !view.querySelector('converse-muc-message-form'));
            expect(muc.canPostMessages()).toBe(false);
        }),
    );
});

describe('A MUC whose connection drops', function () {
    it(
        'shows its participants as last seen, and what is sent as not sent yet',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('converse-muc-message-form'));
            // Hidden in a viewport as narrow as the tests'
            muc.save({ hidden_occupants: false });

            mock.dropConnection(_converse);
            await u.waitUntil(() => view.querySelector('.occupants--stale'));

            await mock.setComposerText(view, 'Anyone there?');
            await mock.pressComposerKey(view, 'Enter');
            const pending = await u.waitUntil(() => view.querySelector('.chat-msg__send-pending-text'));
            expect(pending.textContent).toBe('Not sent yet');
        }),
    );
});
