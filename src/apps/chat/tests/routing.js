import { describe, it, expect } from 'vitest';
import { CHAT_ROUTE_ROOT, buildChatRoute, parseChatRoute } from '../routing.js';

describe('Chat hash routing grammar', function () {
    it('treats non-Chat hashes as not-a-route (null)', function () {
        expect(parseChatRoute('')).toBe(null);
        expect(parseChatRoute('#converse/social/profile/juliet@capulet.lit')).toBe(null);
        expect(parseChatRoute('#converse?loglevel=debug')).toBe(null);
        expect(parseChatRoute('#something-else')).toBe(null);
        // `#converse/chatterbox/...` must not be mistaken for the chat app.
        expect(parseChatRoute('#converse/chatterbox/x')).toBe(null);
    });

    it('round-trips the list route', function () {
        expect(CHAT_ROUTE_ROOT).toBe('#converse/chat');
        expect(parseChatRoute('#converse/chat')).toEqual({ view: 'list' });
        expect(buildChatRoute({ view: 'list' })).toBe('#converse/chat');
        // A bare `#converse/room` is also the list (no conversation foregrounded).
        expect(parseChatRoute('#converse/room')).toEqual({ view: 'list' });
    });

    it('round-trips a 1:1 chat route, encoding the JID', function () {
        const hash = buildChatRoute({ view: 'chat', jid: 'juliet@capulet.lit' });
        expect(hash).toBe('#converse/chat/juliet%40capulet.lit');
        expect(parseChatRoute(hash)).toEqual({ view: 'chat', jid: 'juliet@capulet.lit' });
    });

    it('round-trips a full JID with a resource (reserved / is encoded)', function () {
        const hash = buildChatRoute({ view: 'chat', jid: 'juliet@capulet.lit/balcony' });
        expect(hash).toBe('#converse/chat/juliet%40capulet.lit%2Fbalcony');
        expect(parseChatRoute(hash)).toEqual({ view: 'chat', jid: 'juliet@capulet.lit/balcony' });
    });

    it('round-trips a MUC route, encoding the JID', function () {
        const hash = buildChatRoute({ view: 'room', jid: 'orchard@muc.shakespeare.lit' });
        expect(hash).toBe('#converse/room/orchard%40muc.shakespeare.lit');
        expect(parseChatRoute(hash)).toEqual({ view: 'room', jid: 'orchard@muc.shakespeare.lit' });
    });

    it('does not treat the legacy `?jid=` forms as a Chat route', function () {
        // The rootview protocol handler reads them, as the `xmpp:` URI they
        // stand for. Returning the list here would background the open chats.
        expect(parseChatRoute('#converse/chat?jid=juliet@capulet.lit')).toBe(null);
        expect(parseChatRoute('#converse/room?jid=orchard@muc.shakespeare.lit')).toBe(null);
        expect(parseChatRoute('#converse/chat?jid=')).toBe(null);
    });

    it('falls back to the list for an empty JID', function () {
        expect(parseChatRoute('#converse/chat/')).toEqual({ view: 'list' });
        expect(buildChatRoute({ view: 'chat' })).toBe(null);
        expect(buildChatRoute({ view: 'room' })).toBe(null);
    });

    it('never throws on a malformed percent-encoding', function () {
        // decodeURIComponent('%') throws; the parser must tolerate it.
        expect(parseChatRoute('#converse/chat/%')).toEqual({ view: 'chat', jid: '%' });
    });
});
