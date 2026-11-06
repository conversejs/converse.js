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
                // A history entry pushed via `location.hash` fires `hashchange`, but
                // `replaceState` doesn't. (Counting `history.length` can't tell: the
                // browser caps it, and the whole run shares one tab's history.)
                let hashchanges = 0;
                const onHashChange = () => hashchanges++;
                window.addEventListener('hashchange', onHashChange);

                // Opening a chat reflects it into the hash, without a new history entry.
                await api.chats.open(mercutio, {}, true);
                await u.waitUntil(() => location.hash === buildChatRoute({ view: 'chat', jid: mercutio }));
                await new Promise((resolve) => setTimeout(resolve));
                expect(hashchanges).toBe(0);
                expect(state.chatboxes.get(mercutio).get('hidden')).toBe(false);

                window.removeEventListener('hashchange', onHashChange);
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

                // A building block (roster/roomslist/modal) announces intent via the
                // event; the app-owned handler opens the box and, because this is a
                // user-initiated open, pushes a history entry (unlike the mirror).
                api.trigger('openConversation', { view: 'chat', jid: mercutio });
                await u.waitUntil(() => state.chatboxes.get(mercutio)?.get('hidden') === false);
                expect(location.hash).toBe(buildChatRoute({ view: 'chat', jid: mercutio }));

                // Back returns to the hash we started on, so the open pushed an entry.
                // (Counting `history.length` can't tell: the browser caps it, and the
                // whole run shares one tab's history.)
                history.back();
                await u.waitUntil(() => location.hash === '');

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

    it(
        'opens the chat a shareable link to this page names, and routes to it',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            {
                enable_url_routing: true,
                view_mode: 'fullscreen',
                shareable_link_url: `${location.origin}${location.pathname}`,
            },
            async function (_converse) {
                const { state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const mercutio = 'mercutio@montague.lit';
                clearHash();
                const el = mountChatApp();

                location.hash = `#${mercutio}`;
                await u.waitUntil(() => state.chatboxes.get(mercutio)?.get('hidden') === false);
                // The invitation's fragment gives way to the chat's own route.
                await u.waitUntil(() => location.hash === buildChatRoute({ view: 'chat', jid: mercutio }));

                el.remove();
                clearHash();
            },
        ),
    );

    it(
        "doesn't mirror a conversation over a hash it doesn't own",
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            {
                enable_url_routing: true,
                view_mode: 'fullscreen',
                // Shareable links point at the page the specs run on.
                shareable_link_url: `${location.origin}${location.pathname}`,
            },
            async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const mercutio = 'mercutio@montague.lit';
                const el = mountChatApp();

                // A link that is still waiting for login to be handled (here
                // planted without a `hashchange`) survives a conversation coming
                // to the foreground, be it a protocol-handler link or a
                // shareable one. The legacy `?jid=` forms look like Chat
                // routes, but aren't ours either.
                for (const hash of [
                    '#converse/action?uri=xmpp%3Ajuliet%40capulet.lit',
                    '#juliet@capulet.lit',
                    '#converse/chat?jid=juliet@capulet.lit',
                    '#converse/room?jid=coven@chat.shakespeare.lit',
                ]) {
                    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
                    await api.chats.open(mercutio, {}, true);
                    await u.waitUntil(() => state.chatboxes.get(mercutio).get('hidden') === false);
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    expect(location.hash).toBe(hash);
                    await state.chatboxes.get(mercutio).close();
                }

                el.remove();
                clearHash();
            },
        ),
    );

    it(
        'mirrors a conversation over a hash that names nothing to act on',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { enable_url_routing: true, view_mode: 'fullscreen' },
            async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                const mercutio = 'mercutio@montague.lit';
                const el = mountChatApp();

                // A stale login/register form route, the log level fragment or a
                // page anchor must not stop the open chat reaching the address
                // bar for the rest of the session.
                for (const hash of ['#converse/register', '#converse/login', '#converse?loglevel=debug', '#faq']) {
                    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
                    await api.chats.open(mercutio, {}, true);
                    await u.waitUntil(() => location.hash === buildChatRoute({ view: 'chat', jid: mercutio }));
                    await state.chatboxes.get(mercutio).close();
                }

                el.remove();
                clearHash();
            },
        ),
    );

    it(
        'opens a legacy `?jid=` link that waited for the connection once, and ends on its canonical route',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { enable_url_routing: true, view_mode: 'fullscreen' },
            async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 2);
                const mercutio = 'mercutio@montague.lit';
                const juliet = 'juliet.capulet@montague.lit';
                clearHash();
                const el = mountChatApp();
                const opened = [];
                api.listen.on('openConversation', (data) => opened.push(data));

                // The link is waiting for the connection (planted without a
                // `hashchange`, so it isn't dispatched yet), while a conversation
                // restored from the session comes to the foreground without
                // overwriting it.
                const legacy = `#converse/chat?jid=${mercutio}`;
                history.replaceState(null, '', `${location.pathname}${location.search}${legacy}`);
                api.chats.open(juliet, {}, true);
                await u.waitUntil(() => state.chatboxes.get(juliet)?.get('hidden') === false);
                await new Promise((resolve) => setTimeout(resolve, 50));
                expect(location.hash).toBe(legacy);

                api.trigger('reconnected');

                const route = buildChatRoute({ view: 'chat', jid: mercutio });
                await u.waitUntil(() => location.hash === route);
                await u.waitUntil(() => state.chatboxes.get(mercutio)?.get('hidden') === false);
                await new Promise((resolve) => setTimeout(resolve, 50));
                expect(opened).toEqual([{ view: 'chat', jid: mercutio, attrs: {} }]);
                expect(location.hash).toBe(route);

                el.remove();
                clearHash();
            },
        ),
    );

    it(
        'clears the login form route on login and goes on mirroring the open chat',
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            { auto_login: false, allow_registration: false, enable_url_routing: true, view_mode: 'fullscreen' },
            async function (_converse) {
                const { api, state } = _converse;
                const mercutio = 'mercutio@montague.lit';
                location.hash = '#converse/login';

                const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
                await u.waitUntil(() => cbview.querySelector('input[name="jid"]'));
                cbview.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
                cbview.querySelector('input[name="password"]').value = 'secret';
                cbview.querySelector('button[type="submit"]').click();

                await u.waitUntil(() => location.hash !== '#converse/login');
                await mock.waitForRoster(_converse, 'current', 1);

                const el = mountChatApp();
                await api.chats.open(mercutio, {}, true);
                await u.waitUntil(() => state.chatboxes.get(mercutio)?.get('hidden') === false);
                await u.waitUntil(() => location.hash === buildChatRoute({ view: 'chat', jid: mercutio }));

                el.remove();
                clearHash();
            },
        ),
    );
});
