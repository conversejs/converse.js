import { describe, it, expect } from 'vitest';
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
