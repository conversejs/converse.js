import { describe, it, expect, vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx } = converse.env;

const ATOM = 'http://www.w3.org/2005/Atom';
const NS_DISCO_ITEMS = 'http://jabber.org/protocol/disco#items';
const NS_DISCO_INFO = 'http://jabber.org/protocol/disco#info';
const NS_RSM = 'http://jabber.org/protocol/rsm';
const SERVICE = 'pubsub.shakespeare.lit';

/**
 * Build a disco#items result listing the given nodes on a service, optionally
 * carrying an RSM `<set>` with a `<last>` cursor so paging can be exercised.
 * @param {Array<{ node: string, name?: string }>} nodes
 * @param {{ last?: string }} [rsm]
 */
const itemsResult = (nodes, { last } = {}) =>
    stx`<iq xmlns="jabber:client" type="result" from="${SERVICE}">
        <query xmlns="${NS_DISCO_ITEMS}">
            ${nodes.map((n) =>
                n.name
                    ? stx`<item jid="${SERVICE}" node="${n.node}" name="${n.name}"/>`
                    : stx`<item jid="${SERVICE}" node="${n.node}"/>`,
            )}
            ${last !== undefined ? stx`<set xmlns="${NS_RSM}"><last>${last}</last></set>` : ''}
        </query>
    </iq>`.tree();

/**
 * Build a disco#info result for a node, carrying the XEP-0060 § 5.4 meta-data
 * form (title/type/subscribers) when `meta` is given.
 * @param {string} node
 * @param {{ node_type?: string, title?: string, type?: string, subs?: number }} [meta]
 */
const infoResult = (node, { node_type = 'leaf', title, type, subs } = {}) =>
    stx`<iq xmlns="jabber:client" type="result" from="${SERVICE}">
        <query xmlns="${NS_DISCO_INFO}" node="${node}">
            <identity category="pubsub" type="${node_type}"/>
            <feature var="http://jabber.org/protocol/pubsub"/>
            <x xmlns="jabber:x:data" type="result">
                <field var="FORM_TYPE" type="hidden"><value>http://jabber.org/protocol/pubsub#meta-data</value></field>
                ${title !== undefined ? stx`<field var="pubsub#title"><value>${title}</value></field>` : ''}
                ${type !== undefined ? stx`<field var="pubsub#type"><value>${type}</value></field>` : ''}
                ${subs !== undefined ? stx`<field var="pubsub#num_subscribers"><value>${'' + subs}</value></field>` : ''}
            </x>
        </query>
    </iq>`.tree();

describe('Microblog browseFeeds (XEP-0060 node discovery)', function () {
    it(
        'lists a service’s nodes and flags the Atom feeds among them',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;

            vi.spyOn(api.disco, 'items').mockResolvedValue(
                itemsResult([{ node: 'news', name: 'Community News' }, { node: 'weather' }, { node: 'avatars' }]),
            );
            vi.spyOn(api.disco, 'info').mockImplementation((_jid, node) => {
                if (node === 'news') return Promise.resolve(infoResult('news', { title: 'Town News', type: ATOM, subs: 214 }));
                if (node === 'weather') return Promise.resolve(infoResult('weather', { title: 'Weather', type: ATOM }));
                // A non-feed node (e.g. an avatar node): no Atom type.
                return Promise.resolve(infoResult('avatars', { type: 'urn:xmpp:avatar:data' }));
            });

            const { feeds, cursor, has_more } = await api.microblog.browseFeeds(SERVICE);

            expect(feeds.length).toBe(3);
            const news = feeds.find((r) => r.node === 'news');
            expect(news.jid).toBe(SERVICE);
            expect(news.title).toBe('Town News'); // pubsub#title wins over the item name
            expect(news.type).toBe(ATOM);
            expect(news.num_subscribers).toBe(214);
            expect(news.is_feed).toBe(true);
            expect(news.probed).toBe(true);

            expect(feeds.find((r) => r.node === 'weather').is_feed).toBe(true);
            expect(feeds.find((r) => r.node === 'avatars').is_feed).toBe(false);

            // No RSM <set> in the response → no cursor, no further pages.
            expect(cursor).toBe(null);
            expect(has_more).toBe(false);
        }),
    );

    it(
        'flags XEP-0472 social-feed and gallery nodes as feeds, not just Atom-typed ones',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;

            vi.spyOn(api.disco, 'items').mockResolvedValue(itemsResult([{ node: 'photos' }, { node: 'family' }]));
            vi.spyOn(api.disco, 'info').mockImplementation((_jid, node) =>
                node === 'photos'
                    ? Promise.resolve(infoResult('photos', { type: 'urn:xmpp:pubsub-social-feed:gallery:1' }))
                    : Promise.resolve(infoResult('family', { type: 'urn:xmpp:pubsub-social-feed:1' })),
            );

            const { feeds } = await api.microblog.browseFeeds(SERVICE);

            // A gallery node and a base social-feed node identify as feeds by their
            // modern pubsub#type, not only via the Atom namespace.
            expect(feeds.find((r) => r.node === 'photos').is_feed).toBe(true);
            expect(feeds.find((r) => r.node === 'family').is_feed).toBe(true);
        }),
    );

    it(
        'falls back to the item name and lists a node whose info probe fails',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;

            vi.spyOn(api.disco, 'items').mockResolvedValue(
                itemsResult([{ node: 'news', name: 'Community News' }, { node: 'broken' }]),
            );
            vi.spyOn(api.disco, 'info').mockImplementation((_jid, node) => {
                if (node === 'broken') return Promise.reject(new Error('item-not-found'));
                // No meta-data form at all: title should fall back to the item name.
                return Promise.resolve(infoResult('news', { type: ATOM }));
            });

            const { feeds } = await api.microblog.browseFeeds(SERVICE);

            expect(feeds.length).toBe(2);
            const news = feeds.find((r) => r.node === 'news');
            // No pubsub#title in the form, so `title` stays empty and the display
            // label falls back to the disco#items `name` (the UI does title||name||node).
            expect(news.title).toBeUndefined();
            expect(news.name).toBe('Community News');
            expect(news.is_feed).toBe(true);

            const broken = feeds.find((r) => r.node === 'broken');
            expect(broken.is_feed).toBe(false); // probe failed, listed as not-a-feed
            expect(broken.probed).toBe(true);
        }),
    );

    it(
        'hides XEP-0277 comment-thread nodes from the results',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;

            const COMMENT_NODE = 'urn:xmpp:microblog:0:comments/0028e63ddd4ec4377e2cb3b442deefe2';
            vi.spyOn(api.disco, 'items').mockResolvedValue(
                itemsResult([{ node: 'urn:xmpp:microblog:0', name: 'Blog' }, { node: COMMENT_NODE }]),
            );
            const info = vi
                .spyOn(api.disco, 'info')
                .mockImplementation((_jid, node) => Promise.resolve(infoResult(node, { type: ATOM })));

            const { feeds } = await api.microblog.browseFeeds(SERVICE);

            expect(feeds.map((r) => r.node)).toEqual(['urn:xmpp:microblog:0']);
            // The comment node is dropped before probing, so no info IQ is wasted on it.
            expect(info).not.toHaveBeenCalledWith(SERVICE, COMMENT_NODE, expect.anything());
        }),
    );

    it(
        'returns the RSM cursor + has_more and pages with `after`',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;

            // Page 1 (no cursor) → a full page (max=2) + a <last> cursor; page 2
            // (after the cursor) → a short page, ending the set.
            const items = vi.spyOn(api.disco, 'items').mockImplementation((_jid, _node, options) => {
                const after = options?.rsm?.after;
                if (!after) return Promise.resolve(itemsResult([{ node: 'a' }, { node: 'b' }], { last: 'c1' }));
                return Promise.resolve(itemsResult([{ node: 'c' }], { last: 'c2' }));
            });
            vi.spyOn(api.disco, 'info').mockImplementation((_jid, node) => Promise.resolve(infoResult(node, { type: ATOM })));

            const page1 = await api.microblog.browseFeeds(SERVICE, { max: 2 });
            expect(page1.feeds.map((f) => f.node)).toEqual(['a', 'b']);
            expect(page1.cursor).toBe('c1');
            expect(page1.has_more).toBe(true); // full page (2 >= 2) + a cursor

            const page2 = await api.microblog.browseFeeds(SERVICE, { after: page1.cursor, max: 2 });
            expect(page2.feeds.map((f) => f.node)).toEqual(['c']);
            expect(page2.has_more).toBe(false); // short page (1 < 2) → end of set
            // The second request carried the first page's cursor.
            expect(items.mock.calls[1][2].rsm).toMatchObject({ after: 'c1' });
        }),
    );

    it(
        'keeps has_more when a full page is entirely comment nodes',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;

            // A full page of comment threads: no feeds to show, but the set isn't
            // exhausted, so has_more stays true (the UI pages past it).
            vi.spyOn(api.disco, 'items').mockResolvedValue(
                itemsResult(
                    [
                        { node: 'urn:xmpp:microblog:0:comments/aaa' },
                        { node: 'urn:xmpp:microblog:0:comments/bbb' },
                    ],
                    { last: 'c1' },
                ),
            );
            const info = vi.spyOn(api.disco, 'info');

            const { feeds, cursor, has_more } = await api.microblog.browseFeeds(SERVICE, { max: 2 });

            expect(feeds).toEqual([]);
            expect(cursor).toBe('c1');
            expect(has_more).toBe(true);
            expect(info).not.toHaveBeenCalled(); // comment nodes are never probed
        }),
    );

    it(
        'offers no paging when the server returns a full page with no RSM cursor',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;

            // A full page (max=2) with NO <set>: a service without RSM returns its
            // nodes in one unpaged batch, so there's no cursor to page with.
            vi.spyOn(api.disco, 'items').mockResolvedValue(itemsResult([{ node: 'a' }, { node: 'b' }]));
            vi.spyOn(api.disco, 'info').mockImplementation((_jid, node) => Promise.resolve(infoResult(node, { type: ATOM })));

            const { cursor, has_more } = await api.microblog.browseFeeds(SERVICE, { max: 2 });

            expect(cursor).toBe(null);
            expect(has_more).toBe(false); // no cursor → nothing to page to
        }),
    );

    it(
        'reports progress as nodes are probed',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;

            vi.spyOn(api.disco, 'items').mockResolvedValue(itemsResult([{ node: 'a' }, { node: 'b' }]));
            vi.spyOn(api.disco, 'info').mockImplementation((_jid, node) => Promise.resolve(infoResult(node, { type: ATOM })));

            const seen = [];
            await api.microblog.browseFeeds(SERVICE, { onProgress: (p) => seen.push(p) });

            expect(seen[0]).toEqual({ probed: 0, total: 2 });
            expect(seen[seen.length - 1]).toEqual({ probed: 2, total: 2 });
        }),
    );

    it(
        'rejects an unusable service address',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;
            await expect(api.microblog.browseFeeds('notajid')).rejects.toMatchObject({ name: 'InvalidFeedAddress' });
        }),
    );
});
