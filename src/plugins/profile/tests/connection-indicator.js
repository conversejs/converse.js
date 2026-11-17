import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, u } = converse.env;

describe('The connection indicator', function () {
    it(
        'shows that Converse is offline or reconnecting, and nothing once connected',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.openControlBox(_converse);
            const el = await u.waitUntil(() => document.querySelector('converse-connection-indicator'));
            const live_region = () => document.querySelector('#converse-live-region');
            expect(el.textContent.trim()).toBe('');

            const reconnect = mock.dropConnection(_converse);
            await u.waitUntil(() => el.textContent.trim() === 'Offline');
            await u.waitUntil(() => live_region()?.textContent === 'Offline');
            // The profile and its status stay where they are.
            expect(document.querySelector('converse-user-profile .xmpp-status__msg')).not.toBeNull();

            const connection = _converse.api.connection.get();
            connection.onConnectStatusChanged(Strophe.Status.CONNECTING);
            await u.waitUntil(() => el.textContent.trim() === 'Reconnecting…');
            await u.waitUntil(() => live_region().textContent === 'Reconnecting…');

            await reconnect();
            await u.waitUntil(() => el.textContent.trim() === '');
            await u.waitUntil(() => live_region().textContent === 'Connected');
        }),
    );

    it(
        'shows that Converse is offline as soon as the browser reports it',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.openControlBox(_converse);
            const el = await u.waitUntil(() => document.querySelector('converse-connection-indicator'));

            const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
            window.dispatchEvent(new Event('offline'));
            await u.waitUntil(() => el.textContent.trim() === 'Offline');

            online.mockReturnValue(true);
            window.dispatchEvent(new Event('online'));
            await u.waitUntil(() => el.textContent.trim() === '');
        }),
    );
});
