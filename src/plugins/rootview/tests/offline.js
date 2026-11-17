import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('The app switcher, while there is no connection', function () {
    it(
        'still switches between the apps',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            const { api } = _converse;
            const btn = (name) =>
                u.waitUntil(() => document.querySelector(`converse-app-switcher a.nav-link[data-app-name="${name}"]`));
            await btn('social');

            mock.dropConnection(_converse);
            (await btn('social')).click();
            await u.waitUntil(() => api.apps.getActive().name === 'social');
            await u.waitUntil(() => document.querySelector('converse-app-social .social-feed-container'));
            expect(document.querySelector('converse-login-form')).toBeNull();

            (await btn('chat')).click();
            await u.waitUntil(() => api.apps.getActive().name === 'chat');
            await u.waitUntil(() => document.querySelector('converse-app-chat converse-user-profile'));
            expect(document.querySelector('converse-login-form')).toBeNull();
        }),
    );

    it(
        'is gone once the user has logged out',
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            await u.waitUntil(() => document.querySelector('converse-app-switcher'));
            await _converse.api.user.logout();
            await u.waitUntil(() => !document.querySelector('converse-app-switcher'));
        }),
    );
});
