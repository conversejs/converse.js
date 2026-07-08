import { describe, it, expect, vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';
import { ATOM, MICROBLOG_NODE, makePostStanza, receive, stubPubsubNetwork } from './utils.js';

/**
 * Build a XEP-0330 follow-list `<item>` for the given `server`/`node`, as the
 * follow-list node would return it.
 * @param {string} id
 * @param {string} server
 * @param {string} [node=MICROBLOG_NODE]
 */
const followItem = (id, server, node = MICROBLOG_NODE) =>
    stx`<item id="${id}"><subscription xmlns="${NS_SUBSCRIPTION}" server="${server}" node="${node}"/></item>`.tree();

const { stx, u } = converse.env;

const FOLLOWING_NODE = 'urn:xmpp:pubsub:subscription';
const NS_SUBSCRIPTION = 'urn:xmpp:pubsub:subscription:0';
const SOCIAL_FEED_FEATURE = 'urn:xmpp:pubsub-social-feed:1';

// XEP-0330 item id = lowercase-hex SHA-1 of `server<node<own-bare-jid`. With the
// default test account (romeo@montague.lit) following pubsub.shakespeare.lit's
// `party` node, this is exactly the id in the spec's publish/retract examples —
// proving our id generation interoperates with the spec / Movim.
const PARTY_ID = '0bc0e76cb803b3b107aa369169d8c0d45086f844';

describe('Microblog following (XEP-0330)', function () {
    it(
        'publishes a follow item with the interop-compatible id and node config',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            const { publish } = stubPubsubNetwork(api);

            await api.microblog.follow('pubsub.shakespeare.lit', {
                node: 'party',
                title: 'Party at the Capulets',
            });

            expect(publish).toHaveBeenCalledTimes(1);
            const [jid, node, item, options] = publish.mock.calls[0];
            expect(jid).toBe(null); // published to our own PEP service
            expect(node).toBe(FOLLOWING_NODE);

            const el = item.tree();
            expect(el.getAttribute('id')).toBe(PARTY_ID);
            const sub = el.querySelector('subscription');
            expect(sub.namespaceURI).toBe(NS_SUBSCRIPTION);
            expect(sub.getAttribute('server')).toBe('pubsub.shakespeare.lit');
            expect(sub.getAttribute('node')).toBe('party');
            expect(sub.querySelector('title').textContent).toBe('Party at the Capulets');

            // Node config matches Movim's so the list interoperates.
            expect(options.access_model).toBe('presence');
            expect(options.persist_items).toBe('true');
            expect(options.max_items).toBe('max');
            expect(options.notify_retract).toBe('true');

            // A feed for the followed node now exists and is being backfilled.
            expect(api.microblog.isFollowing('pubsub.shakespeare.lit', 'party')).toBe(true);
            expect(api.pubsub.items.get).toHaveBeenCalledWith('pubsub.shakespeare.lit', 'party', { max_items: 20 });
        }),
    );

    it(
        'retracts the matching item id and drops the feed when unfollowing',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            stubPubsubNetwork(api);

            await api.microblog.follow('pubsub.shakespeare.lit', { node: 'party' });
            expect(api.microblog.isFollowing('pubsub.shakespeare.lit', 'party')).toBe(true);

            const retract = vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);
            await api.microblog.unfollow('pubsub.shakespeare.lit', { node: 'party' });

            // Retracted from our own PEP service by the same SHA-1 item id.
            expect(retract).toHaveBeenCalledWith(null, FOLLOWING_NODE, PARTY_ID);
            expect(api.microblog.isFollowing('pubsub.shakespeare.lit', 'party')).toBe(false);
        }),
    );

    it(
        'reads the durable follow list from the XEP-0330 node',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: [
                    stx`<item id="i1"><subscription xmlns="${NS_SUBSCRIPTION}"
                            server="juliet@capulet.lit" node="${MICROBLOG_NODE}"
                            ><title>Juliet</title></subscription></item>`.tree(),
                    stx`<item id="i2"><subscription xmlns="${NS_SUBSCRIPTION}"
                            server="mercutio@montague.lit" node="${MICROBLOG_NODE}"/></item>`.tree(),
                ],
            });

            const following = await api.microblog.following();
            expect(api.pubsub.items.get).toHaveBeenCalledWith(null, FOLLOWING_NODE);
            expect(following).toEqual([
                { server: 'juliet@capulet.lit', node: MICROBLOG_NODE, title: 'Juliet' },
                { server: 'mercutio@montague.lit', node: MICROBLOG_NODE, title: undefined },
            ]);
        }),
    );

    it(
        'materialises and backfills the own + followed feeds from the durable list',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.session.get('bare_jid');

            vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, node) => {
                if (node === FOLLOWING_NODE) {
                    return Promise.resolve({
                        items: [
                            stx`<item id="i1"><subscription xmlns="${NS_SUBSCRIPTION}"
                                    server="juliet@capulet.lit" node="${MICROBLOG_NODE}"/></item>`.tree(),
                        ],
                    });
                }
                return Promise.resolve({ items: [] });
            });

            await api.microblog.initFollowing();

            // The own feed and the followed feed both exist now.
            expect(_converse.state.pubsubfeeds.getFeed(bare_jid, MICROBLOG_NODE, false)).toBeDefined();
            expect(api.microblog.isFollowing('juliet@capulet.lit')).toBe(true);

            // The follow list was read, and each feed was backfilled.
            expect(api.pubsub.items.get).toHaveBeenCalledWith(null, FOLLOWING_NODE);
            expect(api.pubsub.items.get).toHaveBeenCalledWith(bare_jid, MICROBLOG_NODE, { max_items: 20 });
            expect(api.pubsub.items.get).toHaveBeenCalledWith('juliet@capulet.lit', MICROBLOG_NODE, { max_items: 20 });
        }),
    );

    it(
        "routes a followed contact's PEP post into that contact's feed",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            stubPubsubNetwork(api);

            const feed = await api.microblog.follow('juliet@capulet.lit');
            expect(feed).toBeDefined();
            expect(feed.messages.length).toBe(0);

            receive(_converse, makePostStanza('juliet@capulet.lit', 'jpost-1', 'O Romeo, Romeo'));

            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);
            expect(post.get('title')).toBe('O Romeo, Romeo');
            // A followed contact's post is not ours.
            expect(post.get('is_mine')).toBe(false);
        }),
    );

    it(
        'canFollow resolves the social-feed feature against a contact resource, never the bare JID',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'juliet@capulet.lit';
            const full_jid = `${jid}/phone`;

            // A roster contact with one online resource. A social feed is
            // advertised in per-resource entity caps, so the feature lives on
            // the full JID.
            _converse.roster.create({ jid, subscription: 'both' });
            const presences = _converse.state.presences;
            (presences.get(jid) || presences.create({ jid })).resources.create({ name: 'phone' });

            const supports = vi.spyOn(api.disco, 'supports').mockImplementation((feature, j) =>
                Promise.resolve(feature === SOCIAL_FEED_FEATURE && j === full_jid),
            );

            expect(await api.microblog.canFollow(jid)).toBe(true);
            // It resolves against the resource (full JID) and never queries the
            // bare JID, which would be a wasted disco#info round-trip per contact.
            expect(supports).toHaveBeenCalledWith(SOCIAL_FEED_FEATURE, full_jid);
            expect(supports).not.toHaveBeenCalledWith(SOCIAL_FEED_FEATURE, jid);
        }),
    );

    it(
        'canFollow returns false without querying when the contact has no known resources',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'offline-contact@capulet.lit';

            // A roster contact with no online/known resources (e.g. offline, or
            // not yet seen this session).
            _converse.roster.create({ jid, subscription: 'both' });

            const supports = vi.spyOn(api.disco, 'supports').mockResolvedValue(true);

            // Nothing to resolve against → false, and crucially no disco#info
            // round-trip is issued.
            expect(await api.microblog.canFollow(jid)).toBe(false);
            expect(supports).not.toHaveBeenCalled();
        }),
    );

    it(
        'canFollow returns false when no resource advertises a social feed',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'mercutio@capulet.lit';
            _converse.roster.create({ jid, subscription: 'both' });
            const presences = _converse.state.presences;
            (presences.get(jid) || presences.create({ jid })).resources.create({ name: 'desktop' });

            vi.spyOn(api.disco, 'supports').mockResolvedValue(false);
            expect(await api.microblog.canFollow(jid)).toBe(false);
        }),
    );

    it(
        'discoverFollowable returns saved roster contacts with a feed that are not already followed',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            // juliet has a feed and is not followed → suggested.
            // mercutio has a feed but is already followed → excluded.
            // tybalt has no feed → excluded.
            // benvolio is an unsaved/pending contact → excluded.
            _converse.roster.create({ jid: 'juliet@capulet.lit', subscription: 'both', nickname: 'Juliet' });
            _converse.roster.create({ jid: 'mercutio@montague.lit', subscription: 'both', nickname: 'Mercutio' });
            _converse.roster.create({ jid: 'tybalt@capulet.lit', subscription: 'both', nickname: 'Tybalt' });
            _converse.roster.create({ jid: 'benvolio@montague.lit', requesting: true });

            vi.spyOn(api.microblog, 'canFollow').mockImplementation((jid) =>
                Promise.resolve(jid === 'juliet@capulet.lit' || jid === 'mercutio@montague.lit'),
            );
            vi.spyOn(api.microblog, 'isFollowing').mockImplementation((jid) => jid === 'mercutio@montague.lit');

            const followable = await api.microblog.discoverFollowable();
            expect(followable).toEqual(['juliet@capulet.lit']);
        }),
    );

    it(
        'scanFollowable probes every saved contact, caches verdicts, and re-probes on an explicit re-scan',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');
            const cache = _converse.state.followablecache;

            _converse.roster.create({ jid: 'juliet@capulet.lit', subscription: 'both' }); // has a post → followable
            _converse.roster.create({ jid: 'romeo@montague.lit', subscription: 'to' }); // empty node → not
            _converse.roster.create({ jid: 'tybalt@capulet.lit', subscription: 'both' }); // error → not
            _converse.roster.create({ jid: 'paris@verona.lit', subscription: 'none' }); // not subscribed, but still probed

            const itemsGet = vi.spyOn(api.pubsub.items, 'get').mockImplementation((jid) => {
                if (jid === 'juliet@capulet.lit') {
                    return Promise.resolve({
                        items: [
                            stx`<item id="p1" publisher="${jid}"><entry xmlns="${ATOM}">
                                    <title type="text">O Romeo</title>
                                    <id>tag:capulet.lit,2024-01-01:p1</id>
                                    <published>2024-01-01T18:30:02Z</published>
                                </entry></item>`.tree(),
                        ],
                    });
                }
                if (jid === 'romeo@montague.lit') return Promise.resolve({ items: [] });
                return Promise.reject(new Error('item-not-found'));
            });

            const found = await api.microblog.scanFollowable();

            expect(found).toEqual(['juliet@capulet.lit']);
            // Subscription is not a precondition — every saved contact is probed.
            expect(itemsGet.mock.calls.map((c) => c[0])).toContain('paris@verona.lit');
            expect(cache.get('paris@verona.lit').get('followable')).toBe(false);
            // Verdicts (and the preview timestamp) are cached.
            expect(cache.get('juliet@capulet.lit').get('followable')).toBe(true);
            expect(cache.get('juliet@capulet.lit').get('latest')).toBe('2024-01-01T18:30:02Z');
            expect(cache.get('romeo@montague.lit').get('followable')).toBe(false);
            expect(cache.get('tybalt@capulet.lit').get('followable')).toBe(false);

            // An explicit re-scan re-probes (it doesn't skip already-checked
            // contacts) — a manual sweep should always do real work.
            itemsGet.mockClear();
            await api.microblog.scanFollowable();
            expect(itemsGet).toHaveBeenCalled();
        }),
    );

    it(
        'scanFollowable reports progress and stops when its signal aborts',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            // Several concurrency windows' worth of contacts, so aborting early
            // must leave most of them unscanned.
            const jids = Array.from({ length: 30 }, (_, i) => `c${i}@capulet.lit`);
            jids.forEach((jid) => _converse.roster.create({ jid, subscription: 'both' }));

            // A small delay so the abort lands before the pool drains the queue.
            vi.spyOn(api.pubsub.items, 'get').mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve({ items: [] }), 10)),
            );

            const controller = new AbortController();
            const progress = [];
            await api.microblog.scanFollowable({
                signal: controller.signal,
                onProgress: (p) => {
                    progress.push(p);
                    if (p.scanned >= 1) controller.abort(); // stop as soon as work begins
                },
            });

            // It stopped early: no further contacts were pulled once aborted.
            const last = progress[progress.length - 1];
            expect(last.total).toBe(30);
            expect(last.scanned).toBeGreaterThan(0);
            expect(last.scanned).toBeLessThan(30);
        }),
    );

    it(
        'discoverFollowable includes cached followable contacts and excludes snoozed ones',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');
            const cache = _converse.state.followablecache;

            _converse.roster.create({ jid: 'juliet@capulet.lit', subscription: 'both' });
            _converse.roster.create({ jid: 'romeo@montague.lit', subscription: 'both' });

            // No online-caps hits in this test — only cached sweep verdicts.
            vi.spyOn(api.microblog, 'canFollow').mockResolvedValue(false);

            cache.record('juliet@capulet.lit', { followable: true });
            cache.record('romeo@montague.lit', { followable: true });
            cache.snooze(['romeo@montague.lit']);

            const list = await api.microblog.discoverFollowable();
            expect(list).toContain('juliet@capulet.lit');
            expect(list).not.toContain('romeo@montague.lit');
        }),
    );

    it(
        'reconciles the local follow mirror against the durable list (adds and prunes)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            // The durable list on the server has mercutio (followed elsewhere) but
            // not juliet (unfollowed elsewhere); other nodes backfill empty.
            vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, node) =>
                node === FOLLOWING_NODE
                    ? Promise.resolve({ items: [followItem('i2', 'mercutio@montague.lit')] })
                    : Promise.resolve({ items: [] }),
            );

            // Locally we still follow juliet (e.g. from a previous session).
            await api.microblog.follow('juliet@capulet.lit');
            expect(api.microblog.isFollowing('juliet@capulet.lit')).toBe(true);

            await api.microblog.initFollowing();

            // The mirror now matches the server: juliet dropped, mercutio added.
            expect(api.microblog.isFollowing('juliet@capulet.lit')).toBe(false);
            expect(api.microblog.isFollowing('mercutio@montague.lit')).toBe(true);
        }),
    );

    it(
        'keeps the follow mirror intact when the durable list read fails',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, node) =>
                // A transient failure reading the follow list must NOT be treated
                // as "follows nothing" and wipe the local mirror.
                node === FOLLOWING_NODE ? Promise.reject(new Error('timeout')) : Promise.resolve({ items: [] }),
            );

            await api.microblog.follow('juliet@capulet.lit');
            expect(api.microblog.isFollowing('juliet@capulet.lit')).toBe(true);

            await api.microblog.initFollowing();

            expect(api.microblog.isFollowing('juliet@capulet.lit')).toBe(true);
        }),
    );

    it(
        'followMany follows each jid sequentially and reports per-jid outcomes',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            const order = [];
            const follow = vi.spyOn(api.microblog, 'follow').mockImplementation((jid) => {
                order.push(jid);
                return jid === 'mercutio@montague.lit'
                    ? Promise.reject(new Error('boom'))
                    : Promise.resolve(/** @type {any} */ ({}));
            });

            const results = await api.microblog.followMany([
                'juliet@capulet.lit',
                'mercutio@montague.lit',
                'tybalt@capulet.lit',
            ]);

            // Each jid was followed, in order.
            expect(follow).toHaveBeenCalledTimes(3);
            expect(order).toEqual(['juliet@capulet.lit', 'mercutio@montague.lit', 'tybalt@capulet.lit']);

            // A single failure doesn't abort the rest, and is reported.
            expect(results).toEqual([
                { jid: 'juliet@capulet.lit', ok: true },
                { jid: 'mercutio@montague.lit', ok: false, error: expect.any(Error) },
                { jid: 'tybalt@capulet.lit', ok: true },
            ]);
        }),
    );
});
