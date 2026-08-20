import { describe, it, expect } from 'vitest';
import { parseXMPPURI, isHandledXMPPURI, DEFAULT_ACTION } from '../xmpp-uri.js';

describe('XEP-0147 xmpp: URI parsing', function () {
    it('parses a bare JID with no query', function () {
        expect(parseXMPPURI('xmpp:romeo@montague.lit')).toEqual({
            jid: 'romeo@montague.lit',
            action: null,
            params: {},
        });
    });

    it('tolerates a missing xmpp: scheme prefix', function () {
        expect(parseXMPPURI('romeo@montague.lit?message').action).toBe('message');
    });

    it('parses the querytype (action) with no params', function () {
        expect(parseXMPPURI('xmpp:romeo@montague.lit?message')).toEqual({
            jid: 'romeo@montague.lit',
            action: 'message',
            params: {},
        });
    });

    it('splits the semicolon-separated pairs, NOT on & (the ?join;password= regression)', function () {
        const { jid, action, params } = parseXMPPURI('xmpp:orchard@muc.shakespeare.lit?join;password=secret');
        expect(jid).toBe('orchard@muc.shakespeare.lit');
        expect(action).toBe('join');
        expect(params.password).toBe('secret');
    });

    it('percent-decodes keys and values', function () {
        const { params } = parseXMPPURI('xmpp:romeo@montague.lit?message;body=Here%27s%20a%20test');
        expect(params.body).toBe("Here's a test");
    });

    it('collects a repeated key (e.g. group) into an array', function () {
        const { params } = parseXMPPURI('xmpp:romeo@montague.lit?roster;group=Friends;group=Family');
        expect(params.group).toEqual(['Friends', 'Family']);
    });

    it('parses the roster action with name and group', function () {
        const { action, params } = parseXMPPURI('xmpp:romeo@montague.lit?roster;name=Romeo%20Montague;group=Friends');
        expect(action).toBe('roster');
        expect(params.name).toBe('Romeo Montague');
        expect(params.group).toBe('Friends');
    });

    it('treats a valueless pair as an empty-string value', function () {
        const { params } = parseXMPPURI('xmpp:romeo@montague.lit?message;body=');
        expect(params.body).toBe('');
    });

    it('never throws on a malformed percent-encoding', function () {
        expect(() => parseXMPPURI('xmpp:romeo@montague.lit?message;body=%')).not.toThrow();
        expect(parseXMPPURI('xmpp:romeo@montague.lit?message;body=%').params.body).toBe('%');
    });

    it('recognizes every handled action, and rejects the rest', function () {
        for (const a of ['message', 'join', 'roster', 'subscribe', 'remove', 'unsubscribe']) {
            expect(isHandledXMPPURI(`xmpp:romeo@montague.lit?${a}`)).toBe(true);
        }
        // Unhandled actions are left to the OS handler.
        expect(isHandledXMPPURI('xmpp:romeo@montague.lit?vcard')).toBe(false);
        expect(isHandledXMPPURI('xmpp:pubsub.shakespeare.lit?pubsub;action=subscribe')).toBe(false);
        // An action with no JID is not actionable.
        expect(isHandledXMPPURI('xmpp:?message')).toBe(false);
    });

    it('claims a bare JID, which means the default action', function () {
        // A query-less URI is the commonest form by far (it's what a "chat with
        // me" link on a web page looks like), so Converse has to claim it: with
        // Converse registered as the OS handler there is nothing to defer to.
        expect(isHandledXMPPURI('xmpp:romeo@montague.lit')).toBe(true);
        expect(DEFAULT_ACTION).toBe('message');
    });

    it('leaves a domain-only JID to the OS handler, which Converse cannot act on', function () {
        // NOT because these URIs are invalid: a JID's localpart is optional, so
        // they name a server, a service or a gateway, and `xmpp:irc.example.org?roster`
        // is precisely the XEP-0100 registration flow. It's that Converse's roster
        // API and chat creation both reject a localpart-less JID, so claiming the
        // click would swallow it and do nothing. Should that gap ever be closed,
        // this expectation is the one to flip.
        expect(isHandledXMPPURI('xmpp:irc.example.org?roster')).toBe(false);
        expect(isHandledXMPPURI('xmpp:montague.lit?message')).toBe(false);
        expect(isHandledXMPPURI('xmpp:montague.lit')).toBe(false);
        // Not JID-shaped at all.
        expect(isHandledXMPPURI('xmpp:%')).toBe(false);
    });
});
