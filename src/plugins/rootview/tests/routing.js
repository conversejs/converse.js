import { describe, it, expect } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../dist/converse.js';

const { u } = converse.env;
const clearHash = () => history.replaceState(null, '', location.pathname + location.search);

describe('The app-switcher URL routing', function () {
    it(
        'restores the open chat when switching Chat -> Social -> Chat via the switcher',
        mock.initConverse(
            converse,
            [],
            { enable_url_routing: true, view_mode: 'fullscreen' },
            async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                clearHash();
                const jid = 'mercutio@montague.lit';

                // Open a chat; the foreground mirror reflects it into the hash.
                await api.chats.open(jid, {}, true);
                await u.waitUntil(() => location.hash === `#converse/chat/${encodeURIComponent(jid)}`);

                // Click the real app-switcher buttons (the path that was broken: the
                // switcher used to push each app's bare root, dropping the sub-route).
                const btn = (name) =>
                    u.waitUntil(() =>
                        document.querySelector(`converse-app-switcher a.nav-link[data-app-name="${name}"]`),
                    );
                (await btn('social')).click();
                await u.waitUntil(() => api.apps.getActive().name === 'social');
                expect(location.hash).toBe('#converse/social');

                (await btn('chat')).click();
                await u.waitUntil(() => api.apps.getActive().name === 'chat');

                // Back on Chat: the conversation we left is reopened, not the list.
                expect(location.hash).toBe(`#converse/chat/${encodeURIComponent(jid)}`);
                await u.waitUntil(() => state.chatboxes.get(jid)?.get('hidden') === false);

                clearHash();
            },
        ),
    );

    it(
        'restores each app\'s last route on a programmatic switch (syncAppToHash)',
        mock.initConverse(
            converse,
            [],
            { enable_url_routing: true, view_mode: 'fullscreen' },
            function (_converse) {
                const { api } = _converse;
                const chat = api.apps.get('chat');
                const social = api.apps.get('social');

                // `appSwitch` is what `api.apps.switch` triggers for the hash side;
                // firing it directly exercises `syncAppToHash`.
                history.replaceState(null, '', '#converse/chat/mercutio@montague.lit');
                api.trigger('appSwitch', social);
                expect(location.hash).toBe('#converse/social');

                history.replaceState(null, '', '#converse/social/tag/xmpp');
                api.trigger('appSwitch', chat);
                expect(location.hash).toBe('#converse/chat/mercutio@montague.lit');

                api.trigger('appSwitch', social);
                expect(location.hash).toBe('#converse/social/tag/xmpp');

                clearHash();
            },
        ),
    );

    it(
        'stays dormant when URL routing is disabled',
        mock.initConverse(converse, [], { view_mode: 'fullscreen' }, function (_converse) {
            const { api } = _converse;
            clearHash();
            api.trigger('appSwitch', api.apps.get('social'));
            expect(location.hash).toBe('');
            clearHash();
        }),
    );
});
