import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('The Controlbox, while a connection is retried', function () {
    it(
        'keeps showing a session that this device remembers',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { api } = _converse;
            await mock.openControlBox(_converse);
            const view = _converse.chatboxviews.get('controlbox');
            await u.waitUntil(() => view.querySelector('converse-user-profile'));

            expect(api.connection.remembered()).toBe(true);
            api.trigger('will-reconnect');
            expect(view.model.get('connected')).toBe(true);
            await view.updateComplete;
            expect(view.querySelector('converse-user-profile')).not.toBeNull();
            expect(view.querySelector('converse-login-form')).toBeNull();
        }),
    );

    it(
        'shows that it is disconnected on a device that clears its cache',
        mock.initConverse(converse, ['chatBoxesFetched'], { clear_cache_on_logout: true }, async function (_converse) {
            const { api } = _converse;
            await mock.openControlBox(_converse);
            const view = _converse.chatboxviews.get('controlbox');
            expect(api.connection.remembered()).toBe(false);
            api.trigger('will-reconnect');
            expect(view.model.get('connected')).toBe(false);
        }),
    );
});
