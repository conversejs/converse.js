/**
 * Pure unit tests for the comment reply-tree builder (`utils/thread.js`).
 * Imported straight from source (no built bundle), driven by lightweight fake
 * models, so they exercise the tree logic in isolation from PubSub/DOM.
 */
import { describe, it, expect } from 'vitest';
import { buildCommentTree, computeThreadCounts, getAncestors } from '../utils/thread.js';

const NODE = 'urn:xmpp:microblog:0:comments/p1';
const JID = 'romeo@example.org';

/**
 * A stand-in for a PostComment: only `.get(key)` is used by the tree builder.
 * Defaults place every item in the same thread node/jid so pointers nest unless
 * a test overrides `in_reply_to_node` / `in_reply_to_jid`.
 * @param {object} attrs
 */
function fakeComment(attrs) {
    const data = { node: NODE, from: JID, ...attrs };
    return { get: (/** @type {string} */ k) => data[k] };
}

/**
 * A stand-in for a PostComment that also answers isLike()/getAuthorJID(), as the
 * count partitioning needs. `like:true` marks a ♥; `author` sets the liker/author.
 * @param {object} attrs
 */
function fakeItem(attrs) {
    const { like = false, author, ...rest } = attrs;
    const data = { node: NODE, from: JID, ...rest };
    return {
        get: (/** @type {string} */ k) => data[k],
        isLike: () => like,
        getAuthorJID: () => author,
    };
}

/** The item ids of a node list, in order. */
const ids = (/** @type {any[]} */ nodes) => nodes.map((n) => n.comment.get('id'));

describe('buildCommentTree', () => {
    it('returns direct comments (no in_reply_to) as roots, oldest-first', () => {
        const comments = [
            fakeComment({ id: 'c2', published: '2026-07-24T10:02:00Z' }),
            fakeComment({ id: 'c1', published: '2026-07-24T10:01:00Z' }),
            fakeComment({ id: 'c3', published: '2026-07-24T10:03:00Z' }),
        ];
        const { roots } = buildCommentTree(comments);
        expect(ids(roots)).toEqual(['c1', 'c2', 'c3']);
        expect(roots.every((r) => r.replies.length === 0)).toBe(true);
    });

    it('nests a reply under its parent via in_reply_to (item id)', () => {
        const comments = [
            fakeComment({ id: 'c1', published: '2026-07-24T10:01:00Z' }),
            fakeComment({ id: 'r1', in_reply_to: 'c1', in_reply_to_node: NODE, published: '2026-07-24T10:02:00Z' }),
        ];
        const { roots, by_id } = buildCommentTree(comments);
        expect(ids(roots)).toEqual(['c1']);
        expect(ids(by_id.get('c1').replies)).toEqual(['r1']);
        expect(by_id.get('r1').parent).toBe(by_id.get('c1'));
    });

    it('resolves a ref-only pointer against the parent atom:id', () => {
        const comments = [
            fakeComment({ id: 'c1', atom_id: 'tag:example.org,2026:posts-c1', published: '2026-07-24T10:01:00Z' }),
            // href carried no item id, so only in_reply_to_ref is set.
            fakeComment({ id: 'r1', in_reply_to_ref: 'tag:example.org,2026:posts-c1', published: '2026-07-24T10:02:00Z' }),
        ];
        const { roots, by_id } = buildCommentTree(comments);
        expect(ids(roots)).toEqual(['c1']);
        expect(ids(by_id.get('c1').replies)).toEqual(['r1']);
    });

    it('keeps an orphan (parent not loaded) but does not surface it', () => {
        const comments = [
            fakeComment({ id: 'c1', published: '2026-07-24T10:01:00Z' }),
            fakeComment({ id: 'r9', in_reply_to: 'missing', in_reply_to_node: NODE, published: '2026-07-24T10:05:00Z' }),
        ];
        const { roots, by_id } = buildCommentTree(comments);
        expect(ids(roots)).toEqual(['c1']); // orphan r9 not a root
        expect(by_id.has('r9')).toBe(true); // but kept in the index
        expect(by_id.get('r9').orphan).toBe(true);
        // No node lists r9 as a reply.
        expect([...by_id.values()].some((n) => ids(n.replies).includes('r9'))).toBe(false);
    });

    it('adopts a former orphan once its parent is loaded (recompute)', () => {
        const orphan = fakeComment({ id: 'r9', in_reply_to: 'c1', in_reply_to_node: NODE, published: '2026-07-24T10:05:00Z' });
        expect(buildCommentTree([orphan]).roots.length).toBe(0); // hidden while parent absent

        const parent = fakeComment({ id: 'c1', published: '2026-07-24T10:01:00Z' });
        const { roots, by_id } = buildCommentTree([parent, orphan]);
        expect(ids(roots)).toEqual(['c1']);
        expect(ids(by_id.get('c1').replies)).toEqual(['r9']);
    });

    it('treats a cross-node pointer (a post-reply) as a root, not a nesting reply', () => {
        const comments = [
            // Points at a post in the author's microblog node, not this comments node.
            fakeComment({
                id: 'x1',
                in_reply_to: 'p0',
                in_reply_to_node: 'urn:xmpp:microblog:0',
                in_reply_to_jid: JID,
                published: '2026-07-24T10:01:00Z',
            }),
        ];
        const { roots } = buildCommentTree(comments);
        expect(ids(roots)).toEqual(['x1']);
    });

    it('breaks a reference cycle instead of looping, keeping both nodes', () => {
        const comments = [
            fakeComment({ id: 'a', in_reply_to: 'b', in_reply_to_node: NODE, published: '2026-07-24T10:01:00Z' }),
            fakeComment({ id: 'b', in_reply_to: 'a', in_reply_to_node: NODE, published: '2026-07-24T10:02:00Z' }),
        ];
        const { roots, by_id } = buildCommentTree(comments);
        expect(by_id.size).toBe(2);
        // Exactly one of the two is promoted to a root; the tree is finite.
        expect(roots.length).toBe(1);
    });

    it('sorts sibling replies oldest-first', () => {
        const comments = [
            fakeComment({ id: 'c1', published: '2026-07-24T10:00:00Z' }),
            fakeComment({ id: 'rB', in_reply_to: 'c1', in_reply_to_node: NODE, published: '2026-07-24T10:20:00Z' }),
            fakeComment({ id: 'rA', in_reply_to: 'c1', in_reply_to_node: NODE, published: '2026-07-24T10:10:00Z' }),
        ];
        const { by_id } = buildCommentTree(comments);
        expect(ids(by_id.get('c1').replies)).toEqual(['rA', 'rB']);
    });
});

describe('computeThreadCounts', () => {
    const at = (/** @type {string} */ jid) => `${jid}@example.org`;

    it('counts a post like on the post and not on any comment', () => {
        const items = [
            fakeItem({ id: 'c1', author: at('juliet') }),
            fakeItem({ id: 'L1', like: true, author: at('bob') }), // no in_reply_to → post like
        ];
        const { post, byComment } = computeThreadCounts(items);
        expect(post.comment_count).toBe(1);
        expect(post.like_count).toBe(1);
        expect(byComment.get('c1')).toMatchObject({ reply_count: 0, like_count: 0 });
    });

    it('does NOT count a ♥ aimed at a comment as a post like (the latent bug)', () => {
        const items = [
            fakeItem({ id: 'c1', author: at('juliet') }),
            fakeItem({ id: 'L1', like: true, author: at('bob'), in_reply_to: 'c1', in_reply_to_node: NODE }),
        ];
        const { post, byComment } = computeThreadCounts(items);
        expect(post.like_count).toBe(0); // <- the fix
        expect(byComment.get('c1').like_count).toBe(1);
    });

    it('counts direct replies per comment, and the whole thread on the post', () => {
        const items = [
            fakeItem({ id: 'c1', author: at('juliet') }),
            fakeItem({ id: 'r1', author: at('bob'), in_reply_to: 'c1', in_reply_to_node: NODE }),
            fakeItem({ id: 'r2', author: at('eve'), in_reply_to: 'r1', in_reply_to_node: NODE }),
        ];
        const { post, byComment } = computeThreadCounts(items);
        expect(post.comment_count).toBe(3); // whole thread
        expect(byComment.get('c1').reply_count).toBe(1); // direct only
        expect(byComment.get('r1').reply_count).toBe(1);
        expect(byComment.get('r2').reply_count).toBe(0);
    });

    it('dedupes a comment\'s likes by distinct liker and flags liked_by_me', () => {
        const items = [
            fakeItem({ id: 'c1', author: at('juliet') }),
            fakeItem({ id: 'L1', like: true, author: at('bob'), in_reply_to: 'c1', in_reply_to_node: NODE }),
            // Bob liked again from a second device: still one liker.
            fakeItem({ id: 'L2', like: true, author: at('bob'), in_reply_to: 'c1', in_reply_to_node: NODE }),
            // Our own like.
            fakeItem({ id: 'L3', like: true, author: at('me'), is_mine: true, in_reply_to: 'c1', in_reply_to_node: NODE }),
        ];
        const c1 = computeThreadCounts(items).byComment.get('c1');
        expect(c1.like_count).toBe(2); // bob + me
        expect(c1.liked_by_me).toBe(true);
        expect(c1.my_like_id).toBe('L3');
    });

    it('ignores an orphan reply for per-comment counts but keeps it in the thread total', () => {
        const items = [
            fakeItem({ id: 'c1', author: at('juliet') }),
            fakeItem({ id: 'r9', author: at('eve'), in_reply_to: 'missing', in_reply_to_node: NODE }),
        ];
        const { post, byComment } = computeThreadCounts(items);
        expect(post.comment_count).toBe(2); // orphan still a comment in the thread
        expect(byComment.get('c1').reply_count).toBe(0);
        expect(byComment.has('r9')).toBe(true); // seeded with zeros
    });
});

describe('getAncestors', () => {
    it('returns the chain root-first, excluding the focused item', () => {
        const comments = [
            fakeComment({ id: 'c1', published: '2026-07-24T10:01:00Z' }),
            fakeComment({ id: 'r1', in_reply_to: 'c1', in_reply_to_node: NODE, published: '2026-07-24T10:02:00Z' }),
            fakeComment({ id: 'r2', in_reply_to: 'r1', in_reply_to_node: NODE, published: '2026-07-24T10:03:00Z' }),
        ];
        const { by_id } = buildCommentTree(comments);
        expect(ids(getAncestors(by_id, 'r2'))).toEqual(['c1', 'r1']);
    });

    it('returns an empty chain for a root and for an unknown id', () => {
        const { by_id } = buildCommentTree([fakeComment({ id: 'c1' })]);
        expect(getAncestors(by_id, 'c1')).toEqual([]);
        expect(getAncestors(by_id, 'nope')).toEqual([]);
    });
});
