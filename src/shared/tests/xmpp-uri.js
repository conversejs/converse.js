import { describe, it, expect } from 'vitest';
import { parseXMPPURI, isHandledXMPPURI, invitationToXMPPURI, DEFAULT_ACTION } from '../xmpp-uri.js';

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

    it('reads a first query part holding `=` as a param of an action-less query', function () {
        expect(parseXMPPURI('xmpp:romeo@montague.lit?omemo-sid-123=abc;omemo-sid-456=def')).toEqual({
            jid: 'romeo@montague.lit',
            action: null,
            params: { 'omemo-sid-123': 'abc', 'omemo-sid-456': 'def' },
        });
        expect(isHandledXMPPURI('xmpp:romeo@montague.lit?omemo-sid-123=abc')).toBe(true);
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

    it('leaves a JID whose domainpart is not a hostname to the OS handler', function () {
        expect(isHandledXMPPURI('xmpp:romeo@montague.lit%3Fremove')).toBe(false);
        expect(isHandledXMPPURI('xmpp:romeo@montague.lit%3Bx')).toBe(false);
        expect(isHandledXMPPURI('xmpp:romeo@monta%20gue.lit')).toBe(false);
        // A `?` is legal in a localpart, and in a resourcepart.
        expect(isHandledXMPPURI('xmpp:dev%3Ftalk@muc.example.org?join')).toBe(true);
        expect(isHandledXMPPURI('xmpp:romeo@montague.lit/phone%3F')).toBe(true);
        // IDNs and IP literals are hostnames too.
        expect(isHandledXMPPURI('xmpp:romeo@b%C3%BCcher.example')).toBe(true);
        expect(isHandledXMPPURI('xmpp:romeo@[::1]')).toBe(true);
    });
});

describe('https invitation links', function () {
    const toURI = (/** @type {string} */ href) => invitationToXMPPURI(new URL(href));

    it('reads the xmpp: URI from the fragment of an easy-xmpp-invitation page', function () {
        expect(toURI('https://xmpp.link/#romeo@montague.lit')).toBe('xmpp:romeo@montague.lit');
        expect(toURI('https://xmpp.link/#coven@chat.shakespeare.lit?join')).toBe(
            'xmpp:coven@chat.shakespeare.lit?join',
        );
        expect(toURI('https://i.kaidan.im/#romeo@montague.lit')).toBe('xmpp:romeo@montague.lit');
        expect(toURI('https://invite.joinjabber.org/#romeo@montague.lit')).toBe('xmpp:romeo@montague.lit');
    });

    it('percent-decodes a fragment that Conversations encoded as a whole', function () {
        expect(toURI('https://xmpp.link/#coven%40chat.shakespeare.lit%3Fjoin')).toBe(
            'xmpp:coven@chat.shakespeare.lit?join',
        );
        const uri = toURI('https://xmpp.link/#coven%40chat.shakespeare.lit%3Fjoin%3Bpassword%3Da%253Bb');
        expect(uri).toBe('xmpp:coven@chat.shakespeare.lit?join;password=a%3Bb');
        expect(parseXMPPURI(uri).params).toEqual({ password: 'a;b' });
    });

    it('claims the link Conversations shares for an account, with its OMEMO fingerprints', function () {
        const uri = toURI('https://xmpp.link/#romeo%40montague.lit%3Fomemo-sid-123%3Dabc%3Bomemo-sid-456%3Ddef');
        expect(uri).toBe('xmpp:romeo@montague.lit?omemo-sid-123=abc;omemo-sid-456=def');
        expect(isHandledXMPPURI(uri)).toBe(true);
    });

    it('leaves a fragment holding a literal query, as Kaidan writes it, for the parser to decode', function () {
        const uri = toURI('https://i.kaidan.im/#coven@chat.shakespeare.lit?join;password=a%3Bb%2541');
        expect(uri).toBe('xmpp:coven@chat.shakespeare.lit?join;password=a%3Bb%2541');
        expect(parseXMPPURI(uri).params).toEqual({ password: 'a;b%41' });
    });

    it('reads a `+` as a space only in a fragment that Conversations encoded', function () {
        const uri = toURI('https://xmpp.link/#romeo%40montague.lit%3Fmessage%3Bbody%3Dhi+there');
        expect(parseXMPPURI(uri).params).toEqual({ body: 'hi there' });
        expect(toURI('https://xmpp.link/#a%2Bb%40montague.lit')).toBe('xmpp:a+b@montague.lit');
        expect(toURI('https://i.kaidan.im/#a+b@montague.lit')).toBe('xmpp:a+b@montague.lit');
    });

    it('does not double the scheme of a fragment that already carries it', function () {
        expect(toURI('https://xmpp.link/#xmpp:romeo@montague.lit')).toBe('xmpp:romeo@montague.lit');
        expect(toURI('https://xmpp.link/#xmpp%3Aromeo%40montague.lit%3Fjoin')).toBe('xmpp:romeo@montague.lit?join');
    });

    it("reads Conversations' /i/ (contact) and /j/ (groupchat) paths", function () {
        expect(toURI('https://conversations.im/i/romeo@montague.lit')).toBe('xmpp:romeo@montague.lit');
        expect(toURI('https://conversations.im/j/coven@chat.shakespeare.lit')).toBe(
            'xmpp:coven@chat.shakespeare.lit?join',
        );
    });

    it("doesn't let an encoded `?` in a Conversations path choose the action", function () {
        const contact = parseXMPPURI(toURI('https://conversations.im/i/romeo@montague.lit%3Fremove'));
        expect(contact.action).toBeNull();
        expect(contact.jid).toBe('romeo@montague.lit?remove');

        const room = parseXMPPURI(toURI('https://conversations.im/j/coven@chat.shakespeare.lit%3Fmessage%3Bbody%3Dhi'));
        expect(room.action).toBe('join');
        expect(room.params).toEqual({});
        expect(room.jid).toBe('coven@chat.shakespeare.lit?message;body=hi');
    });

    it('ignores a Conversations path with a malformed percent-sequence', function () {
        expect(toURI('https://conversations.im/i/r%zz@montague.lit')).toBeNull();
    });

    it("doesn't let an encoded `#` in a Conversations path cut the JID short", function () {
        expect(parseXMPPURI(toURI('https://conversations.im/i/romeo@montague.lit%23x')).jid).toBe(
            'romeo@montague.lit#x',
        );
    });

    it('ignores every other link', function () {
        expect(toURI('https://xmpp.link/')).toBeNull();
        expect(toURI('https://xmpp.link/faq#romeo@montague.lit')).toBeNull();
        expect(toURI('http://xmpp.link/#romeo@montague.lit')).toBeNull();
        expect(toURI('https://example.org/#romeo@montague.lit')).toBeNull();
        expect(toURI('https://conversations.im/')).toBeNull();
        expect(toURI('https://conversations.im/x/romeo@montague.lit')).toBeNull();
        expect(toURI('https://conversations.im/i/romeo@montague.lit/extra')).toBeNull();
    });
});
