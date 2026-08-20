/**
 * Threaded-comment behaviour against the built bundle: parsing RFC 4685
 * thr:in-reply-to onto a model, the stanza a reply publishes, and the per-target
 * count partitioning on a CommentFeed (a ♥ on a comment must not inflate the
 * post's like count).
 */
import { describe, it, expect, vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';
import { commentItem, makeCommentEvent, receive, replyItem, seedPost } from './utils.js';

const { u } = converse.env;
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

    it(
        'comments.add with a parent publishes a threaded reply and bumps the parent count',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            const feed = await api.microblog.comments.feed(post);
            await feed.addItems([commentItem('c1', 'She is so pretty!', 'juliet@capulet.lit')]);
            const parent = feed.messages.get('c1');

            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            const reply = await api.microblog.comments.add(post, 'Agreed!', { parent });

            // Published to the post's one comments node, carrying the pointer.
            expect(publish).toHaveBeenCalledTimes(1);
            const [, node, item] = publish.mock.calls[0];
            expect(node).toBe(post.getCommentsNode());
            const ptr = Array.from(item.tree().querySelector('entry').children).find(
                (el) => el.localName === 'in-reply-to' && el.namespaceURI === NS_THREAD,
            );
            expect(ptr.getAttribute('href')).toContain('item=c1');

            // Optimistically threaded, and the parent's reply count is bumped.
            expect(reply.get('in_reply_to')).toBe('c1');
            expect(parent.get('reply_count')).toBe(1);
        }),
    );

    it(
        'like/unlike on a comment updates the comment, not the post',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const { post } = await seedPost(api);
            post.set({ like_count: 0, liked_by_me: false });
            const feed = await api.microblog.comments.feed(post);
            await feed.addItems([commentItem('c1', 'She is so pretty!', 'juliet@capulet.lit')]);
            const comment = feed.messages.get('c1');

            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            const retract = vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);

            await api.microblog.like(comment);
            expect(comment.get('liked_by_me')).toBe(true);
            expect(comment.get('like_count')).toBe(1);
            // The ♥ rode the comments node pointing at the comment.
            const like = feed.getMyLikes('c1');
            expect(like.length).toBe(1);
            expect(like[0].get('in_reply_to')).toBe('c1');
            // The post's like count is untouched (the latent bug).
            expect(post.get('like_count')).toBe(0);
            expect(post.get('liked_by_me')).toBe(false);

            await api.microblog.unlike(comment);
            expect(retract).toHaveBeenCalled();
            expect(comment.get('liked_by_me')).toBe(false);
            expect(comment.get('like_count')).toBe(0);
        }),
    );

    it(
        'notifies a live reply to our own comment on someone else\'s post',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            // A stranger's post whose thread we've opened, with our own comment in it.
            const { post: theirs } = await seedPost(api, { author: 'juliet@capulet.lit', id: 'p9' });
            const service = theirs.getCommentsService();
            const node = theirs.getCommentsNode();
            _converse.state.commentfeeds.getFeed(service, node, true);

            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            const mine = await api.microblog.comments.add(theirs, 'my two cents');
            expect(mine.get('is_mine')).toBe(true);

            const events = [];
            api.listen.on('microblogNotification', (d) => events.push(d));

            // A foreign reply pointing at OUR comment → one notification.
            receive(
                _converse,
                makeCommentEvent(service, node, 'r1', 'good point', 'bob@montague.lit', 'Bob', '2024-01-01T20:00:00Z', {
                    parent: mine.get('id'),
                }),
            );
            await u.waitUntil(() => events.length === 1);
            expect(events[0].type).toBe('comment');
            expect(events[0].comment.get('in_reply_to')).toBe(mine.get('id'));
            expect(events[0].ref).toEqual({ feedJid: 'juliet@capulet.lit', node: 'urn:xmpp:microblog:0', itemId: 'p9' });
        }),
    );
});
