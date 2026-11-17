import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, u } = converse.env;

describe('The Controlbox, while there is no connection', function () {
    ['overlayed', 'fullscreen'].forEach((view_mode) => {
        it(
            `keeps showing the profile and the contacts in ${view_mode} view mode`,
            mock.initConverse(converse, ['chatBoxesFetched'], { view_mode }, async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);
                const view = _converse.chatboxviews.get('controlbox');
                await u.waitUntil(() => view.querySelector('converse-roster .list-item'));

                const isSessionShown = () =>
                    view.querySelector('converse-user-profile') &&
                    view.querySelector('converse-roster .list-item') &&
                    !view.querySelector('converse-login-form') &&
                    !view.querySelector('converse-spinner');

                const reconnect = mock.dropConnection(_converse);
                await view.updateComplete;
                expect(isSessionShown()).toBe(true);
                expect(view.classList.contains('logged-out')).toBe(false);

                // A retry that fails
                const connection = _converse.api.connection.get();
                connection.onConnectStatusChanged(Strophe.Status.CONNECTING);
                await view.updateComplete;
                expect(isSessionShown()).toBe(true);
                connection.onConnectStatusChanged(Strophe.Status.CONNFAIL, 'remote-connection-failed');
                connection.onConnectStatusChanged(Strophe.Status.DISCONNECTED);
                await view.updateComplete;
                expect(isSessionShown()).toBe(true);

                await reconnect();
                await view.updateComplete;
                expect(isSessionShown()).toBe(true);
            }),
        );
    });

    it(
        'shows the login form with the reason, once the server rejects the stored login',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'overlayed' }, async function (_converse) {
            const { api } = _converse;
            await mock.openControlBox(_converse);
            const view = _converse.chatboxviews.get('controlbox');
            await u.waitUntil(() => view.querySelector('converse-user-profile'));
            view.close();
            await u.waitUntil(() => !document.querySelector('converse-controlbox'));

            // As on a device that keeps its cache, which tests otherwise clear.
            vi.spyOn(_converse.state.chatboxes, 'clearStore').mockResolvedValue(undefined);
            mock.dropConnection(_converse);
            // As Strophe reports it when its stored keys no longer match the server's.
            api.connection.get().connect_callback(Strophe.Status.AUTHFAIL, null, null);

            const feedback = await u.waitUntil(() =>
                document.querySelector('converse-controlbox converse-login-form .conn-feedback:not(.d-none)'),
            );
            expect(feedback.textContent.trim()).toBe(
                'Your session has ended, because your saved login is no longer accepted. Please log in again.',
            );
        }),
    );
});
