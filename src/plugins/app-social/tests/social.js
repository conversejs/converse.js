import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import {
    MICROBLOG_NODE,
    ONBOARDING_DISMISSED,
    makePost,
    makeRepost,
    mountSocialFeed,
    receive,
    stubDiscoverFollowable,
} from './utils.js';

const { u } = converse.env;

describe('The social feed', function () {
    it(
        'renders incoming posts and publishes via the compose box',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();

            // It resolves the own feed and renders the compose box.
            const textarea = await u.waitUntil(() => el.querySelector('.social-compose__textarea'));
            expect(el.querySelector('.social-feed__empty')).not.toBe(null);

            // A post arrives via PEP and is rendered (SignalWatcher + collectionSignal).
            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Hello social world'));

            const body = await u.waitUntil(() => el.querySelector('.social-post__body'));
            expect(body.textContent.trim()).toBe('Hello social world');

            // Publishing via the compose box builds + publishes, then optimistically renders.
            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            textarea.value = 'My first microblog post';
            el.querySelector('.social-compose__toolbar button').click();

            await u.waitUntil(() => publish.mock.calls.length === 1);
            const [jid, node] = publish.mock.calls[0];
            expect(jid).toBe(bare_jid);
            expect(node).toBe(MICROBLOG_NODE);

            await u.waitUntil(() =>
                Array.from(el.querySelectorAll('.social-post__body')).some((n) =>
                    n.textContent.includes('My first microblog post'),
                ),
            );
            // The textarea is cleared after a successful publish.
            expect(textarea.value).toBe('');
        }),
    );

    it(
        'deletes an own post via the delete button',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'a doomed post'));

            const delete_button = await u.waitUntil(() => el.querySelector('.social-post__action'));
            vi.spyOn(api, 'confirm').mockResolvedValue(true);
            const retract = vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);

            delete_button.click();

            await u.waitUntil(() => retract.mock.calls.length === 1);
            expect(retract).toHaveBeenCalledWith(bare_jid, MICROBLOG_NODE, 'post-1');
            await u.waitUntil(() => el.querySelector('.social-post') === null);
        }),
    );

    it(
        'merges a followed contact\'s posts into the timeline, newest-first',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            const contact_jid = 'juliet@capulet.lit';

            // Stub the PEP network so the follow flow resolves without a server.
            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            // Follow a contact: this creates their feed in the aggregated timeline.
            await api.microblog.follow(contact_jid);

            // An older own post and a newer post from the followed contact. These
            // arrive immediately after follow — before the followed feed's empty
            // cache has hydrated — exercising the hydration-race guard in addItems.
            receive(_converse, makePost(bare_jid, bare_jid, 'mine-1', 'My own post', '2024-01-01T09:00:00Z'));
            receive(_converse, makePost(bare_jid, contact_jid, 'theirs-1', 'Juliet says hi', '2024-01-02T09:00:00Z'));

            // Both posts show in one timeline, the newer (contact's) first.
            await u.waitUntil(() => el.querySelectorAll('.social-post').length === 2);
            const articles = Array.from(el.querySelectorAll('.social-post'));
            const bodies = articles.map((a) => a.querySelector('.social-post__body').textContent.trim());
            expect(bodies).toEqual(['Juliet says hi', 'My own post']);

            // The followed contact's post is not ours → no delete button; ours has one.
            expect(articles[0].querySelector('.social-post__action')).toBe(null);
            expect(articles[1].querySelector('.social-post__action')).not.toBe(null);
        }),
    );

    it(
        'links the avatar to a profile only for contacts and own posts',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;
            const stranger = 'stranger@shakespeare.lit';

            // Read a non-contact author's feed (e.g. a followed community node).
            await _converse.api.microblog.feeds.get(stranger, MICROBLOG_NODE, true);

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            receive(_converse, makePost(bare_jid, bare_jid, 'mine-1', 'My own post', '2024-01-01T09:00:00Z'));
            receive(_converse, makePost(bare_jid, stranger, 'theirs-1', 'A stranger speaks', '2024-01-02T09:00:00Z'));

            await u.waitUntil(() => el.querySelectorAll('.social-post').length === 2);

            const articleFor = (body) =>
                Array.from(el.querySelectorAll('.social-post')).find((a) =>
                    a.querySelector('.social-post__body').textContent.includes(body),
                );

            // Our own post resolves to our profile → its avatar links out.
            await u.waitUntil(() => articleFor('My own post')?.querySelector('a.social-post__avatar'));
            // The non-contact author's avatar is a plain, non-linked element.
            expect(articleFor('A stranger speaks').querySelector('a.social-post__avatar')).toBe(null);
            expect(articleFor('A stranger speaks').querySelector('.social-post__avatar')).not.toBe(null);
        }),
    );

    it(
        'attributes a repost to the reposter, distinct from the original author',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;
            const reposter = 'alice@wonderland.lit';
            const author = 'bob@builder.lit';

            // Follow Alice's feed (a community node), and seed her name so the
            // attribution resolves deterministically from the vCard cache.
            await _converse.api.microblog.feeds.get(reposter, MICROBLOG_NODE, true);
            _converse.state.vcards.create({ jid: reposter, nickname: 'Alice' });

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            // A plain own post and a repost: Alice repeats Bob's original post.
            receive(_converse, makePost(bare_jid, bare_jid, 'mine-1', 'A plain post', '2024-01-01T09:00:00Z'));
            receive(_converse, makeRepost(bare_jid, reposter, 'rp-1', 'Can we fix it?', author, 'Bob the Builder'));

            await u.waitUntil(() => el.querySelectorAll('.social-post').length === 2);

            const articleFor = (body) =>
                Array.from(el.querySelectorAll('.social-post')).find((a) =>
                    a.querySelector('.social-post__body').textContent.includes(body),
                );

            const repost = articleFor('Can we fix it?');

            // The repost shows an attribution eyebrow naming the reposter (Alice),
            // while the main author shown is the *original* poster (Bob).
            await u.waitUntil(() => repost.querySelector('.social-post__repost')?.textContent.includes('Alice'));
            const eyebrow = repost.querySelector('.social-post__repost');
            expect(eyebrow.textContent.toLowerCase()).toContain('reposted');
            expect(repost.querySelector('.social-post__author').textContent.trim()).toBe('Bob the Builder');

            // A plain (non-repost) post carries no attribution eyebrow.
            expect(articleFor('A plain post').querySelector('.social-post__repost')).toBe(null);
        }),
    );
});

describe('The social onboarding card', function () {
    it(
        'suggests followable contacts and bulk-follows the selected ones',
        mock.initConverse(converse, [], {}, async function (_converse) {
            // Load the roster so the candidate resolves to a real contact whose
            // avatar and name the card renders via api.contacts.get().
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;

            stubDiscoverFollowable(api, ['juliet.capulet@montague.lit']);
            const follow = vi.spyOn(api.microblog, 'follow').mockResolvedValue(/** @type {any} */ ({}));

            const el = mountSocialFeed();

            // The card appears with the candidate, pre-checked. The contact name
            // is rendered asynchronously, so wait for it to appear.
            const card = await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding'));
            await u.waitUntil(() => card.textContent.includes('Juliet'));
            const checkbox = /** @type {HTMLInputElement} */ (card.querySelector('input[type="checkbox"]'));
            expect(checkbox.checked).toBe(true);

            // "Follow selected" follows every checked candidate via followMany.
            /** @type {HTMLButtonElement} */ (card.querySelector('.social-onboarding__actions button')).click();
            await u.waitUntil(() => follow.mock.calls.length === 1);
            expect(follow).toHaveBeenCalledWith('juliet.capulet@montague.lit');

            // The card hides itself once onboarding is done.
            await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding') === null);
        }),
    );

    it(
        'can be dismissed, and the dismissal is persisted',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            stubDiscoverFollowable(api, ['juliet@capulet.lit']);

            const el = mountSocialFeed();

            const card = await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding'));
            /** @type {HTMLButtonElement} */ (card.querySelector('.social-onboarding__dismiss')).click();

            await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding') === null);
            expect(await api.user.settings.get(ONBOARDING_DISMISSED)).toBe(true);
        }),
    );

    it(
        'stays hidden when onboarding was previously dismissed',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            await api.user.settings.set(ONBOARDING_DISMISSED, true);
            const discover = stubDiscoverFollowable(api, ['juliet@capulet.lit']);

            const el = mountSocialFeed();

            const onboarding = await u.waitUntil(() => el.querySelector('converse-social-onboarding'));
            await u.waitUntil(() => discover.mock.calls.length >= 1);
            await onboarding.updateComplete;
            // Candidate exists, but the card renders nothing because it was dismissed.
            expect(onboarding.querySelector('.social-onboarding')).toBe(null);
        }),
    );

    it(
        'stays hidden when the user already follows someone',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            // A followed (non-own) feed already exists — e.g. a follow synced from
            // another device via the XEP-0330 list — so the nudge shouldn't show.
            await api.waitUntil('pubsubFeedsInitialized');
            _converse.state.pubsubfeeds.getFeed('juliet@capulet.lit', MICROBLOG_NODE, true);

            const discover = stubDiscoverFollowable(api, ['mercutio@montague.lit']);

            const el = mountSocialFeed();

            const onboarding = await u.waitUntil(() => el.querySelector('converse-social-onboarding'));
            await u.waitUntil(() => discover.mock.calls.length >= 1);
            await onboarding.updateComplete;
            expect(onboarding.querySelector('.social-onboarding')).toBe(null);
        }),
    );

    it(
        'rescans when a feed-bearing resource comes online on an already-online contact',
        mock.initConverse(converse, [], {}, async function (_converse) {
            // Load the roster so the candidate resolves to a real contact whose
            // name the card renders via api.contacts.get().
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            const jid = 'juliet.capulet@montague.lit';

            // A known contact, already online via a feed-less resource. A second
            // resource appearing won't change the contact's aggregate presence,
            // so only a resource-level event fires — never a `presences` change.
            await api.waitUntil('pubsubFeedsInitialized');
            const presences = _converse.state.presences;
            const presence = presences.get(jid) ?? presences.create({ jid });
            presence.resources.create({ name: 'desktop', presence: 'online' });

            let has_feed = false;
            const discover = vi
                .spyOn(api.microblog, 'discoverFollowable')
                .mockImplementation(() => Promise.resolve(has_feed ? [jid] : []));

            const el = mountSocialFeed();

            // Initially nothing to suggest → no card.
            const onboarding = await u.waitUntil(() => el.querySelector('converse-social-onboarding'));
            await u.waitUntil(() => discover.mock.calls.length >= 1);
            await onboarding.updateComplete;
            expect(onboarding.querySelector('.social-onboarding')).toBe(null);

            // A second, feed-bearing resource comes online. The card watches each
            // contact's resources, so this resource add triggers a (debounced)
            // rescan even though the aggregate presence is unchanged.
            has_feed = true;
            presence.resources.create({ name: 'phone', presence: 'online' });

            const card = await u.waitUntil(() => onboarding.querySelector('.social-onboarding'));
            await u.waitUntil(() => card.textContent.includes('Juliet'));
        }),
    );
});
