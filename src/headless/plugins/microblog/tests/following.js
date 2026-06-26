import { describe, it, expect, vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, stx, u } = converse.env;

const ATOM = 'http://www.w3.org/2005/Atom';
const PUBSUB_EVENT = `${Strophe.NS.PUBSUB}#event`;
const MICROBLOG_NODE = 'urn:xmpp:microblog:0';
const FOLLOWING_NODE = 'urn:xmpp:pubsub:subscription';
const NS_SUBSCRIPTION = 'urn:xmpp:pubsub:subscription:0';
const SOCIAL_FEED_FEATURE = 'urn:xmpp:pubsub-social-feed:1';

// XEP-0330 item id = lowercase-hex SHA-1 of `server<node<own-bare-jid`. With the
// default test account (romeo@montague.lit) following pubsub.shakespeare.lit's
// `party` node, this is exactly the id in the spec's publish/retract examples —
// proving our id generation interoperates with the spec / Movim.
const PARTY_ID = '0bc0e76cb803b3b107aa369169d8c0d45086f844';

/**
 * Inject an incoming PEP/PubSub event stanza, as if pushed by the server.
 * @param {any} _converse
 * @param {Element} stanza
 */
function receive(_converse, stanza) {
    _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
}

/**
 * Build a headline PEP event carrying a single plain-text microblog post.
 * @param {string} from - The publisher's bare JID.
 * @param {string} id - The PubSub item id.
 * @param {string} body - The post body.
 */
function makePostStanza(from, id, body) {
    return stx`
        <message xmlns="jabber:client" from="${from}" to="${from}" type="headline">
          <event xmlns="${PUBSUB_EVENT}">
            <items node="${MICROBLOG_NODE}">
              <item id="${id}" publisher="${from}">
                <entry xmlns="${ATOM}">
                  <title type="text">${body}</title>
                  <id>tag:capulet.lit,2024-01-01:posts-${id}</id>
                  <published>2024-01-01T18:30:02Z</published>
                  <updated>2024-01-01T18:30:02Z</updated>
                </entry>
              </item>
            </items>
          </event>
        </message>`;
}

describe('Microblog following (XEP-0330)', function () {
    it(
        'publishes a follow item with the interop-compatible id and node config',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

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

            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'unsubscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

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
                            server="juliet@capulet.lit" node="${MICROBLOG_NODE}"><title>Juliet</title></subscription></item>`.tree(),
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

            vi.spyOn(api.pubsub.items, 'get').mockImplementation((jid, node) => {
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

            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const feed = await api.microblog.follow('juliet@capulet.lit');
            expect(feed).toBeDefined();
            expect(feed.messages.length).toBe(0);

            receive(_converse, makePostStanza('juliet@capulet.lit', 'jpost-1', 'O Romeo, Romeo'));

            await u.waitUntil(() => feed.messages.length === 1);
            const post = feed.messages.at(0);
            expect(post.get('body')).toBe('O Romeo, Romeo');
            // A followed contact's post is not ours.
            expect(post.get('is_mine')).toBe(false);
        }),
    );

    it(
        'canFollow resolves the social-feed feature against a contact resource, not the bare JID',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const jid = 'juliet@capulet.lit';
            const full_jid = `${jid}/phone`;

            // A roster contact with one online resource. Entity caps are
            // advertised per-resource, so the feature lives on the full JID.
            _converse.roster.create({ jid, subscription: 'both' });
            const presences = _converse.state.presences;
            (presences.get(jid) || presences.create({ jid })).resources.create({ name: 'phone' });

            vi.spyOn(api.disco, 'supports').mockImplementation(
                async (feature, j) => feature === SOCIAL_FEED_FEATURE && j === full_jid,
            );

            // The bare JID carries no caps features, but the resource does.
            expect(await api.disco.supports(SOCIAL_FEED_FEATURE, jid)).toBe(false);
            expect(await api.microblog.canFollow(jid)).toBe(true);
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
});
