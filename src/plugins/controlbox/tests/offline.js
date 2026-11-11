import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('The Controlbox, while a connection is retried', function () {
    it(
        'keeps showing a session loaded from the cache',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.openControlBox(_converse);
            const view = _converse.chatboxviews.get('controlbox');
            await u.waitUntil(() => view.querySelector('converse-user-profile'));

            // As for a session resumed from the cache
            api.connection.get().cached_jid = 'romeo@montague.lit';
            api.trigger('will-reconnect');
            expect(view.model.get('connected')).toBe(true);
            await view.updateComplete;
            expect(view.querySelector('converse-user-profile')).not.toBeNull();
            expect(view.querySelector('converse-login-form')).toBeNull();
        }),
    );

    it(
        'shows that it is disconnected otherwise',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.openControlBox(_converse);
            const view = _converse.chatboxviews.get('controlbox');
            _converse.api.trigger('will-reconnect');
            expect(view.model.get('connected')).toBe(false);
        }),
    );
});
