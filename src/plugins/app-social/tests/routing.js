import { describe, it, expect } from 'vitest';
import { SOCIAL_ROUTE_ROOT, buildSocialRoute, parseSocialRoute } from '../routing.js';

const MICROBLOG_NODE = 'urn:xmpp:microblog:0';

describe('Social hash routing grammar', function () {
    it('treats non-Social hashes as not-a-route (null)', function () {
        expect(parseSocialRoute('')).toBe(null);
        expect(parseSocialRoute('#converse/chat?jid=juliet@capulet.lit')).toBe(null);
        expect(parseSocialRoute('#converse/room?jid=orchard@muc.shakespeare.lit')).toBe(null);
        expect(parseSocialRoute('#converse?loglevel=debug')).toBe(null);
        expect(parseSocialRoute('#something-else')).toBe(null);
        // A `#converse/socialite/...` must not be mistaken for the social app.
        expect(parseSocialRoute('#converse/socialite/x')).toBe(null);
    });

    it('round-trips the timeline route', function () {
        expect(SOCIAL_ROUTE_ROOT).toBe('#converse/social');
        expect(parseSocialRoute('#converse/social')).toEqual({ view: 'timeline' });
        expect(buildSocialRoute({ view: 'timeline' })).toBe('#converse/social');
    });

    it('round-trips a profile route on the following tab', function () {
        const hash = buildSocialRoute({ view: 'profile', jid: 'juliet@capulet.lit', tab: 'following' });
        expect(hash).toBe('#converse/social/profile/juliet%40capulet.lit/following');
        expect(parseSocialRoute(hash)).toEqual({ view: 'profile', jid: 'juliet@capulet.lit', tab: 'following' });
    });

    it('omits the tab segment for the default posts tab', function () {
        expect(buildSocialRoute({ view: 'profile', jid: 'juliet@capulet.lit', tab: 'posts' })).toBe(
            '#converse/social/profile/juliet%40capulet.lit',
        );
    });

    it('round-trips a followed community feed on its own /feed route', function () {
        const route = { view: 'profile', jid: 'pubsub.movim.eu', node: 'comics' };
        const hash = buildSocialRoute(route);
        expect(hash).toBe('#converse/social/feed/pubsub.movim.eu/comics');
        expect(parseSocialRoute(hash)).toEqual(route);
    });

    it('round-trips a profile route, encoding the JID', function () {
        const hash = buildSocialRoute({ view: 'profile', jid: 'juliet@capulet.lit' });
        expect(hash).toBe('#converse/social/profile/juliet%40capulet.lit');
        expect(parseSocialRoute(hash)).toEqual({ view: 'profile', jid: 'juliet@capulet.lit' });
    });

    it('round-trips a full JID with a resource (reserved / is encoded)', function () {
        const hash = buildSocialRoute({ view: 'profile', jid: 'juliet@capulet.lit/balcony' });
        expect(hash).toBe('#converse/social/profile/juliet%40capulet.lit%2Fbalcony');
        expect(parseSocialRoute(hash)).toEqual({ view: 'profile', jid: 'juliet@capulet.lit/balcony' });
    });

    it('falls back to the timeline for an empty profile JID', function () {
        expect(parseSocialRoute('#converse/social/profile/')).toEqual({ view: 'timeline' });
        expect(buildSocialRoute({ view: 'profile' })).toBe(null);
    });

    it('round-trips a post route, omitting the node for the microblog node', function () {
        const route = { view: 'post', feedJid: 'juliet@capulet.lit', node: MICROBLOG_NODE, itemId: 'post-1' };
        const hash = buildSocialRoute(route);
        expect(hash).toBe('#converse/social/post/juliet%40capulet.lit/post-1');
        expect(parseSocialRoute(hash)).toEqual(route);
    });

    it('defaults the node to the microblog node when building without one', function () {
        expect(buildSocialRoute({ view: 'post', feedJid: 'x@y.lit', itemId: 'p1' })).toBe(
            '#converse/social/post/x%40y.lit/p1',
        );
    });

    it('round-trips a post route with an explicit non-microblog node', function () {
        const route = { view: 'post', feedJid: 'pubsub.shakespeare.lit', node: 'party', itemId: 'i1' };
        const hash = buildSocialRoute(route);
        expect(hash).toBe('#converse/social/post/pubsub.shakespeare.lit/party/i1');
        expect(parseSocialRoute(hash)).toEqual(route);
    });

    it('returns null when a post route is missing its feed or item id', function () {
        expect(buildSocialRoute({ view: 'post', feedJid: 'x@y.lit' })).toBe(null);
        expect(buildSocialRoute({ view: 'post', itemId: 'p1' })).toBe(null);
    });

    it('falls back to the timeline for a malformed post route', function () {
        expect(parseSocialRoute('#converse/social/post/onlyfeedjid')).toEqual({ view: 'timeline' });
    });

    it('round-trips a hashtag route, including unicode', function () {
        expect(buildSocialRoute({ view: 'tag', tag: 'xmpp' })).toBe('#converse/social/tag/xmpp');
        expect(parseSocialRoute('#converse/social/tag/xmpp')).toEqual({ view: 'tag', tag: 'xmpp' });

        const cafe = buildSocialRoute({ view: 'tag', tag: 'café' });
        expect(cafe).toBe(`#converse/social/tag/${encodeURIComponent('café')}`);
        expect(parseSocialRoute(cafe)).toEqual({ view: 'tag', tag: 'café' });
    });

    it('falls back to the timeline for an empty tag or an unknown view', function () {
        expect(parseSocialRoute('#converse/social/tag/')).toEqual({ view: 'timeline' });
        expect(parseSocialRoute('#converse/social/bogus/x')).toEqual({ view: 'timeline' });
    });

    it('never throws on a malformed percent-encoding', function () {
        // decodeURIComponent('%') throws; the parser must tolerate it.
        expect(parseSocialRoute('#converse/social/tag/%')).toEqual({ view: 'tag', tag: '%' });
    });
});
