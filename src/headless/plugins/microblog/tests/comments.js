/**
 * Threaded-comment behaviour against the built bundle: parsing RFC 4685
 * thr:in-reply-to onto a model, the stanza a reply publishes, and the per-target
 * count partitioning on a CommentFeed (a ♥ on a comment must not inflate the
 * post's like count).
 */
import { describe, it, expect } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';
import { commentItem, replyItem, seedPost } from './utils.js';

const NS_THREAD = 'http://purl.org/syndication/thread/1.0';

describe('Threaded comments', function () {
    it(
        'parses thr:in-reply-to on an incoming comment into the model',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            const service = post.getCommentsService();
            const node = post.getCommentsNode();

            const feed = await api.microblog.comments.feed(post);
            await feed.addItems([
                commentItem('c1', 'She is so pretty!', 'juliet@capulet.lit'),
                replyItem('r1', 'Agreed!', 'benvolio@montague.lit', { service, node, parent: 'c1' }),
            ]);

            const reply = feed.messages.get('r1');
            expect(reply.get('in_reply_to')).toBe('c1');
            expect(reply.get('in_reply_to_node')).toBe(node);
            expect(reply.get('in_reply_to_jid')).toBe(service);
            // A direct comment has no pointer.
            expect(feed.messages.get('c1').get('in_reply_to')).toBeUndefined();
        }),
    );

    it(
        'createCommentStanza emits a thr:in-reply-to that re-parses in-namespace',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            const node = post.getCommentsNode();
            const feed = await api.microblog.comments.feed(post);

            const item = feed.createCommentStanza({
                body: 'Agreed!',
                author_jid: 'benvolio@montague.lit',
                in_reply_to: 'c1',
            });
            const entry = item.tree().querySelector('entry');
            const ptr = Array.from(entry.children).find(
                (el) => el.localName === 'in-reply-to' && el.namespaceURI === NS_THREAD,
            );
            expect(ptr).toBeDefined();
            expect(ptr.getAttribute('href')).toContain('item=c1');
            expect(ptr.getAttribute('href')).toContain(encodeURIComponent(node));
        }),
    );

    it(
        'partitions counts so a ♥ on a comment updates the comment, not the post',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            const service = post.getCommentsService();
            const node = post.getCommentsNode();
            const feed = await api.microblog.comments.feed(post);

            await feed.addItems([
                commentItem('c1', 'She is so pretty!', 'juliet@capulet.lit'),
                replyItem('r1', 'Agreed!', 'benvolio@montague.lit', { service, node, parent: 'c1' }),
                // A ♥ on comment c1 (not on the post).
                replyItem('L1', '♥', 'romeo@montague.lit', { service, node, parent: 'c1' }),
            ]);

            // Post summary: 2 real comments (c1, r1), no *post* likes.
            const summary = feed.summarize();
            expect(summary.comment_count).toBe(2);
            expect(summary.like_count).toBe(0);

            // Comment c1: one direct reply (r1), one like (L1).
            const c1 = feed.summarize('c1');
            expect(c1.reply_count).toBe(1);
            expect(c1.like_count).toBe(1);
        }),
    );
});
