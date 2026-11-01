import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../dist/converse.js';

const { u } = converse.env;
const clearHash = () => history.replaceState(null, '', location.pathname + location.search);

/** The hash the browser hands an `xmpp:` link back on, exactly as it builds it. */
const actionHash = (uri) => `#converse/action?uri=${encodeURIComponent(uri)}`;

describe('The xmpp: protocol handler', function () {
    it(
        'opens a chat for an xmpp: URI handed over while the app is already running',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { state } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            clearHash();
            const jid = 'mercutio@montague.lit';

            // The protocol handler navigates the *open* tab, so all that changes
            // is the hash. Nothing re-initialises.
            location.hash = actionHash(`xmpp:${jid}`);

            await u.waitUntil(() => state.chatboxes.get(jid)?.get('hidden') === false);

            // The action hash is consumed rather than left in the address bar.
            await u.waitUntil(() => !location.hash.startsWith('#converse/action'));
        }),
    );

    it(
        'seeds the composer draft, keeping an escaped semicolon in the body intact',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { state } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            clearHash();
            const jid = 'mercutio@montague.lit';

            // XEP-0147 separates query params with ';', so a ';' inside a value
            // arrives escaped. It must survive as data and not be mistaken for a
            // parameter separator.
            location.hash = actionHash(`xmpp:${jid}?message;body=hello%3Bworld`);

            await u.waitUntil(() => state.chatboxes.get(jid)?.get('draft') === 'hello;world');
        }),
    );

    it(
        'survives a malformed percent-sequence and still handles the next URI',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { state } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            clearHash();
            const jid = 'mercutio@montague.lit';

            // Any page can link here, so a lone '%' must not throw and wedge the
            // handler for the rest of the session.
            location.hash = '#converse/action?uri=%';
            await u.waitUntil(() => !location.hash.startsWith('#converse/action'));
            expect(state.chatboxes.get(jid)).toBeUndefined();

            location.hash = actionHash(`xmpp:${jid}`);
            await u.waitUntil(() => state.chatboxes.get(jid)?.get('hidden') === false);
        }),
    );

    it(
        'asks before acting on a roster action from an untrusted URI',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            clearHash();
            const jid = 'newcontact@montague.lit';

            // Declining must leave the roster untouched: an xmpp: URI is
            // attacker-supplied, so a link alone can't mutate the roster.
            spyOn(api, 'confirm').and.returnValue(Promise.resolve(false));
            spyOn(api.contacts, 'add');

            location.hash = actionHash(`xmpp:${jid}?roster;name=Mallory`);

            await u.waitUntil(() => api.confirm.calls.any());
            expect(api.contacts.add).not.toHaveBeenCalled();
        }),
    );

    describe('given a legacy `?jid=` deep link', function () {
        it(
            'opens the chat it names and clears the link',
            mock.initConverse(converse, [], {}, async function (_converse) {
                const { state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                clearHash();
                const jid = 'mercutio@montague.lit';

                location.hash = `#converse/chat?jid=${jid}`;

                await u.waitUntil(() => state.chatboxes.get(jid)?.get('hidden') === false);
                // Cleared, so that a reload doesn't act on it a second time.
                expect(location.hash).toBe('');
            }),
        );

        it(
            'asks before joining the groupchat it names',
            mock.initConverse(converse, ['chatBoxesFetched'], { allow_bookmarks: false }, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                clearHash();
                const triggered = [];
                api.listen.on('openConversation', (data) => triggered.push(data));
                spyOn(api, 'confirm').and.returnValue(Promise.resolve(false));

                location.hash = '#converse/room?jid=coven@chat.shakespeare.lit';

                await u.waitUntil(() => api.confirm.calls.any());
                expect(api.confirm.calls.argsFor(0)[1]).toBe('Join the groupchat coven@chat.shakespeare.lit?');
                await new Promise((resolve) => setTimeout(resolve));
                expect(triggered).toEqual([]);
                expect(location.hash).toBe('');
            }),
        );

        it(
            "brings a groupchat that's already open to the foreground without asking",
            mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
                const { api } = _converse;
                const muc_jid = 'coven@chat.shakespeare.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                clearHash();
                spyOn(api, 'confirm').and.returnValue(Promise.resolve(true));
                const triggered = new Promise((resolve) => api.listen.once('openConversation', resolve));

                location.hash = `#converse/room?jid=${muc_jid}`;

                expect(await triggered).toEqual(jasmine.objectContaining({ view: 'room', jid: muc_jid }));
                expect(api.confirm).not.toHaveBeenCalled();
            }),
        );

        it(
            "waits for the groupchats joined automatically, and doesn't ask about one of them",
            mock.initConverse(
                converse,
                ['discoInitialized'],
                { auto_join_rooms: ['coven@chat.shakespeare.lit'], allow_bookmarks: false },
                async function (_converse) {
                    const { api } = _converse;
                    const muc_jid = 'coven@chat.shakespeare.lit';
                    clearHash();
                    const confirm = vi.spyOn(api, 'confirm').mockResolvedValue(true);
                    const triggered = new Promise((resolve) => api.listen.once('openConversation', resolve));

                    // Arrives before the auto-join has finished.
                    location.hash = `#converse/room?jid=${muc_jid}`;

                    await mock.waitForMUCDiscoInfo(_converse, muc_jid);
                    await mock.waitForReservedNick(_converse, muc_jid, 'romeo');
                    await mock.receiveOwnMUCPresence(_converse, muc_jid, 'romeo');

                    expect(await triggered).toEqual(expect.objectContaining({ view: 'room', jid: muc_jid }));
                    expect(confirm).not.toHaveBeenCalled();
                },
            ),
        );

        it(
            'handles a link that arrives while another is waiting on its confirm prompt',
            mock.initConverse(converse, ['chatBoxesFetched'], { allow_bookmarks: false }, async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                clearHash();
                const jid = 'mercutio@montague.lit';
                /** @type {(answer: boolean) => void} */
                let answer;
                const confirm = vi
                    .spyOn(api, 'confirm')
                    .mockReturnValue(new Promise((resolve) => (answer = resolve)));

                location.hash = '#converse/room?jid=coven@chat.shakespeare.lit';
                await u.waitUntil(() => confirm.mock.calls.length === 1);

                const hash = `#converse/chat?jid=${jid}`;
                location.hash = hash;
                await new Promise((resolve) => setTimeout(resolve, 50));
                expect(state.chatboxes.get(jid)).toBeUndefined();
                expect(location.hash).toBe(hash);

                answer(false);
                await u.waitUntil(() => state.chatboxes.get(jid)?.get('hidden') === false);
                expect(location.hash).toBe('');
            }),
        );

        it(
            'waits in the hash until there is a live connection',
            mock.initConverse(converse, [], {}, async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                clearHash();
                const jid = 'mercutio@montague.lit';
                const hash = `#converse/chat?jid=${jid}`;

                const connected = vi.spyOn(api.connection, 'connected').mockReturnValue(false);
                location.hash = hash;
                await new Promise((resolve) => setTimeout(resolve, 50));
                expect(state.chatboxes.get(jid)).toBeUndefined();
                expect(location.hash).toBe(hash);

                connected.mockRestore();
                api.trigger('reconnected');

                await u.waitUntil(() => state.chatboxes.get(jid)?.get('hidden') === false);
                expect(location.hash).toBe('');
            }),
        );

        it(
            'ignores an invalid, domain-only or malformed JID, and leaves the hash alone',
            mock.initConverse(converse, [], {}, async function (_converse) {
                const { api, state } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                clearHash();
                spyOn(api, 'confirm').and.returnValue(Promise.resolve(true));
                const triggered = [];
                api.listen.on('openConversation', (data) => triggered.push(data));
                const before = state.chatboxes.length;

                for (const hash of [
                    '#converse/chat?jid=not%20a%20jid',
                    '#converse/chat?jid=montague.lit',
                    '#converse/room?jid=chat.shakespeare.lit',
                    '#converse/chat?jid=%',
                    '#converse/chat?jid=romeo%40montague.lit%E0%A4%A',
                    '#converse/chat?jid=r%zz@montague.lit',
                    '#converse/chat?jid=',
                ]) {
                    location.hash = hash;
                    await new Promise((resolve) => setTimeout(resolve, 20));
                    // Not one we act on, so it's not ours to clear either.
                    expect(location.hash).toBe(hash);
                }
                expect(triggered).toEqual([]);
                expect(api.confirm).not.toHaveBeenCalled();
                expect(state.chatboxes.length).toBe(before);

                // And the handler isn't wedged.
                location.hash = '#converse/chat?jid=mercutio@montague.lit';
                await u.waitUntil(() => state.chatboxes.get('mercutio@montague.lit')?.get('hidden') === false);
            }),
        );

        it(
            "doesn't let a percent-encoded `?` in the JID pick the action",
            mock.initConverse(converse, [], {}, async function (_converse) {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);
                clearHash();
                spyOn(api, 'confirm').and.returnValue(Promise.resolve(true));
                spyOn(api.contacts, 'remove');

                // Read as `xmpp:romeo@montague.lit?remove`, this would ask to drop
                // a contact. The `?` belongs to the JID, which makes it invalid.
                const hash = '#converse/chat?jid=romeo%40montague.lit%3Fremove';
                location.hash = hash;
                await new Promise((resolve) => setTimeout(resolve, 50));

                expect(api.confirm).not.toHaveBeenCalled();
                expect(api.contacts.remove).not.toHaveBeenCalled();
                expect(location.hash).toBe(hash);
            }),
        );
    });

    it(
        'hands the browser a same-origin handler URL that round-trips to the action hash',
        mock.initConverse(converse, [], {}, function (_converse) {
            const { api } = _converse;

            // registerProtocolHandler is a real browser-permission boundary, so
            // it's stubbed. What's asserted is the URL we build: it has to be
            // same-origin and carry the '%s' placeholder on the same hash the
            // manifest declares, or the round trip silently breaks.
            spyOn(navigator, 'registerProtocolHandler');

            expect(api.protocolHandler.register()).toBe(true);

            const [scheme, url] = navigator.registerProtocolHandler.calls.mostRecent().args;
            expect(scheme).toBe('xmpp');
            expect(url.startsWith(location.origin)).toBe(true);
            expect(url.endsWith('#converse/action?uri=%s')).toBe(true);
        }),
    );
});
