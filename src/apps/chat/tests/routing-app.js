import { describe, it, expect } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { buildChatRoute } from '../routing.js';

const { u } = converse.env;

function mountChatApp() {
    document.querySelector('converse-app-chat')?.remove();
    const el = document.createElement('converse-app-chat');
    document.querySelector('#conversejs').appendChild(el);
    return el;
}

const clearHash = () => history.replaceState(null, '', location.pathname + location.search);

describe('The Chat app URL routing', function () {
    it(
        'mirrors the foreground chat into the hash via replaceState (no history entry)',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { enable_url_routing: true, view_mode: 'fullscreen' },
            async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const mercutio = 'mercutio@montague.lit';
                clearHash();

                const el = mountChatApp();
                const before = history.length;

                // Opening a chat reflects it into the hash, without a new history entry.
                await api.chats.open(mercutio, {}, true);
                await u.waitUntil(() => location.hash === buildChatRoute({ view: 'chat', jid: mercutio }));
                expect(history.length).toBe(before);
                expect(state.chatboxes.get(mercutio).get('hidden')).toBe(false);

                el.remove();
                clearHash();
            },
        ),
    );

    it(
        'opens a conversation from the `openConversation` event, pushing a history entry',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { enable_url_routing: true, view_mode: 'fullscreen' },
            async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const mercutio = 'mercutio@montague.lit';
                clearHash();

                const el = mountChatApp();
                const before = history.length;

                // A building block (roster/roomslist/modal) announces intent via the
                // event; the app-owned handler opens the box and, because this is a
                // user-initiated open, pushes a history entry (unlike the mirror).
                api.trigger('openConversation', { view: 'chat', jid: mercutio });
                await u.waitUntil(() => state.chatboxes.get(mercutio)?.get('hidden') === false);
                expect(location.hash).toBe(buildChatRoute({ view: 'chat', jid: mercutio }));
                expect(history.length).toBe(before + 1);

                el.remove();
                clearHash();
            },
        ),
    );

    it(
        'opens a 1:1 from a deep-link and backgrounds it on the bare list route',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { enable_url_routing: true, view_mode: 'fullscreen' },
            async function (_converse) {
                const { state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const mercutio = 'mercutio@montague.lit';
                clearHash();

                // Deep-link: mount with the chat hash already set.
                location.hash = buildChatRoute({ view: 'chat', jid: mercutio });
                const el = mountChatApp();
                await u.waitUntil(() => state.chatboxes.get(mercutio)?.get('hidden') === false);

                // The bare list route backgrounds the open conversation.
                location.hash = '#converse/chat';
                await u.waitUntil(() => state.chatboxes.get(mercutio)?.get('hidden') === true);

                el.remove();
                clearHash();
            },
        ),
    );

    it(
        "does not clobber another app's hash (e.g. #converse/social) nor background chats off a foreign hash",
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { enable_url_routing: true, view_mode: 'fullscreen' },
            async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const mercutio = 'mercutio@montague.lit';
                clearHash();

                const el = mountChatApp();
                await api.chats.open(mercutio, {}, true);
                await u.waitUntil(() => state.chatboxes.get(mercutio)?.get('hidden') === false);

                // Simulate being on the Social app (its route sits in the hash), as
                // happens during the boot window before the app-switcher settles.
                history.replaceState(null, '', '#converse/social');

                // syncFromHash off a foreign hash must NOT background the open chat.
                el.syncFromHash();
                expect(state.chatboxes.get(mercutio).get('hidden')).toBe(false);

                // The foreground mirror must NOT overwrite the social route.
                el.syncHashToForeground();
                expect(location.hash).toBe('#converse/social');

                el.remove();
                clearHash();
            },
        ),
    );

    it(
        'stays dormant when URL routing is disabled (never writes the hash)',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { view_mode: 'fullscreen' },
            async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const mercutio = 'mercutio@montague.lit';
                clearHash();

                const el = mountChatApp();
                await api.chats.open(mercutio, {}, true);
                await u.waitUntil(() => state.chatboxes.get(mercutio)?.get('hidden') === false);
                // Routing off: the URL is left untouched.
                expect(location.hash).toBe('');

                el.remove();
                clearHash();
            },
        ),
    );
});
