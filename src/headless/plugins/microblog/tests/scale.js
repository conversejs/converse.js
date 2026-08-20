/**
 * Thread scale behaviour: paging vs. targeted orphan resolution. A reply whose
 * parent is outside the newest window is adopted by RSM paging (no id-fetch) or,
 * on a non-RSM node, reconnected by fetching the missing ancestor by item id.
 */
import { describe, it, expect, vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';
import { buildCommentTree } from '../utils/thread.js';
import { commentItem, replyItem, seedPost } from './utils.js';

/** The item ids of a tree node list. */
const ids = (/** @type {any[]} */ nodes) => nodes.map((n) => n.comment.get('id'));

describe('Thread scale (paging & orphans)', function () {
    it(
        'reconnects an orphan on a non-RSM node by fetching the parent by id',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            const service = post.getCommentsService();
            const node = post.getCommentsNode();

            // The newest window holds only the reply; its parent c1 is older and
            // reachable only by a targeted id fetch (this node has no RSM).
            const getSpy = vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, _node, opts) => {
                if (opts?.item_ids) {
                    const items = opts.item_ids.includes('c1')
                        ? [commentItem('c1', 'She is so pretty!', 'juliet@capulet.lit')]
                        : [];
                    return Promise.resolve({ items });
                }
                return Promise.resolve({
                    items: [replyItem('r1', 'Agreed!', 'benvolio@montague.lit', { service, node, parent: 'c1' })],
                });
            });

            const feed = await api.microblog.comments.feed(post);
            await feed.fetchComments();

            expect(feed.get('supports_rsm')).toBeFalsy();
            expect(feed.messages.get('c1')).toBeDefined(); // parent fetched by id
            expect(getSpy.mock.calls.some((c) => c[2]?.item_ids?.includes('c1'))).toBe(true);

            const { roots, by_id } = buildCommentTree(feed.getComments());
            expect(ids(roots)).toEqual(['c1']);
            expect(ids(by_id.get('c1').replies)).toEqual(['r1']);
        }),
    );

    it(
        'adopts an orphan by paging on an RSM node, issuing no id-fetch',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            const service = post.getCommentsService();
            const node = post.getCommentsNode();

            // An RSM response (carries a <set>), so paging is the adoption path.
            const getSpy = vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({
                items: [replyItem('r1', 'Agreed!', 'benvolio@montague.lit', { service, node, parent: 'c1' })],
                rsm: { result: { first: 'cur', last: 'cur' } },
            });

            const feed = await api.microblog.comments.feed(post);
            await feed.fetchComments();

            expect(feed.get('supports_rsm')).toBe(true);
            // No targeted parent fetch on an RSM node.
            expect(getSpy.mock.calls.every((c) => !c[2]?.item_ids)).toBe(true);
            // The orphan is kept but hidden until paging brings its parent.
            expect(buildCommentTree(feed.getComments()).roots.length).toBe(0);

            // Simulate "load older" delivering the parent; a recompute adopts it.
            await feed.addItems([commentItem('c1', 'She is so pretty!', 'juliet@capulet.lit')]);
            const { roots, by_id } = buildCommentTree(feed.getComments());
            expect(ids(roots)).toEqual(['c1']);
            expect(ids(by_id.get('c1').replies)).toEqual(['r1']);
        }),
    );

    it(
        'stops re-requesting a retracted ancestor (absent-set) on a non-RSM node',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            const service = post.getCommentsService();
            const node = post.getCommentsNode();

            // The reply's parent is gone (a retracted comment): the id fetch returns
            // nothing, so it must not be asked for again.
            const getSpy = vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, _node, opts) => {
                if (opts?.item_ids) return Promise.resolve({ items: [] });
                return Promise.resolve({
                    items: [replyItem('r1', 'orphan', 'benvolio@montague.lit', { service, node, parent: 'gone' })],
                });
            });

            const feed = await api.microblog.comments.feed(post);
            await feed.fetchComments();
            const idFetches = () => getSpy.mock.calls.filter((c) => c[2]?.item_ids).length;
            expect(idFetches()).toBe(1); // asked once

            await feed.fetchComments();
            expect(idFetches()).toBe(1); // absent-set prevents a re-request

            // The orphan stays kept-but-hidden.
            expect(buildCommentTree(feed.getComments()).roots.length).toBe(0);
            expect(feed.messages.get('r1')).toBeDefined();
        }),
    );
});
