import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import {
    ATOM,
    MICROBLOG_NODE,
    makePost,
    makeRepost,
    mountSocialFeed,
    receive,
    stubDiscoverFollowable,
} from './utils.js';

const { stx, u } = converse.env;

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
            el.querySelector('.social-compose__toolbar button[type="submit"]').click();

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
        'renders URLs and hashtags in a post body as rich elements',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            receive(
                _converse,
                makePost(bare_jid, bare_jid, 'p1', 'reading https://conversejs.org about #xmpp today'),
            );

            const body = await u.waitUntil(() => el.querySelector('.social-post__body'));

            // The URL becomes a hyperlink (texture pipeline), not plain text.
            const link = await u.waitUntil(() =>
                Array.from(body.querySelectorAll('a:not(.social-post__hashtag)')).find((a) =>
                    a.href.includes('conversejs.org'),
                ),
            );
            expect(link).toBeTruthy();

            // The hashtag becomes a social-only rich element labelled "#xmpp".
            const tag = await u.waitUntil(() => body.querySelector('.social-post__hashtag'));
            expect(tag.textContent).toBe('#xmpp');
        }),
    );

    it(
        'filters the timeline to a hashtag when one is clicked, and clears it',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            receive(_converse, makePost(bare_jid, bare_jid, 'p1', 'learning #xmpp today', '2024-01-02T09:00:00Z'));
            receive(_converse, makePost(bare_jid, bare_jid, 'p2', 'just #coffee', '2024-01-01T09:00:00Z'));

            await u.waitUntil(() => el.querySelectorAll('.social-post').length === 2);

            // Click the "#xmpp" hashtag in the first post.
            const tag = await u.waitUntil(() =>
                Array.from(el.querySelectorAll('.social-post__hashtag')).find((a) => a.textContent === '#xmpp'),
            );
            tag.click();

            // The timeline filters to the single #xmpp post; a filter bar appears
            // and the compose box is hidden.
            await u.waitUntil(() => el.querySelector('.social-feed__filter'));
            await u.waitUntil(() => el.querySelectorAll('.social-post').length === 1);
            expect(el.querySelector('.social-post__body').textContent).toContain('#xmpp');
            expect(el.querySelector('.social-compose__textarea')).toBe(null);

            // Clearing restores the full timeline and the compose box.
            el.querySelector('.social-feed__filter-clear').click();
            await u.waitUntil(() => el.querySelectorAll('.social-post').length === 2);
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));
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
        'suggests followable contacts and lets you bulk-follow them',
        mock.initConverse(converse, [], {}, async function (_converse) {
            // Load the roster so the candidate resolves to a real contact whose
            // avatar and name the card renders via api.contacts.get().
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;

            stubDiscoverFollowable(api, ['juliet.capulet@montague.lit']);
            const followMany = vi.spyOn(api.microblog, 'followMany').mockResolvedValue([]);

            const el = mountSocialFeed();

            // The card appears with the candidate, pre-checked. The contact name
            // is rendered asynchronously, so wait for it to appear.
            const card = await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding'));
            await u.waitUntil(() => card.textContent.includes('Juliet'));
            const checkbox = /** @type {HTMLInputElement} */ (card.querySelector('input[type="checkbox"]'));
            expect(checkbox.checked).toBe(true);

            // "Follow selected" bulk-follows every checked candidate.
            /** @type {HTMLButtonElement} */ (card.querySelector('.btn-primary')).click();
            await u.waitUntil(() => followMany.mock.calls.length === 1);
            expect(followMany).toHaveBeenCalledWith(['juliet.capulet@montague.lit']);
        }),
    );

    it(
        'snoozes the current suggestions when dismissed, leaving a re-entry point',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');
            const cache = _converse.state.followablecache;
            const jid = 'juliet.capulet@montague.lit';

            // A contact known followable from a prior sweep (no online caps needed).
            cache.record(jid, { followable: true });

            const el = mountSocialFeed();
            const card = await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding'));
            await u.waitUntil(() => card.textContent.includes('Juliet'));

            // Dismiss snoozes the shown candidate: the suggestions card empties and
            // the snooze is persisted on the cache (not a permanent global flag).
            /** @type {HTMLButtonElement} */ (card.querySelector('.social-onboarding__dismiss')).click();
            await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding') === null);
            expect(cache.get(jid).get('snoozed')).toBe(true);
            // The "Find people to follow" control (in the compose toolbar) remains
            // as the re-entry point to discovery.
            expect(el.querySelector('.social-scan__btn')).not.toBe(null);
        }),
    );

    it(
        'does not suggest contacts that were snoozed',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');
            const cache = _converse.state.followablecache;
            const jid = 'juliet.capulet@montague.lit';

            cache.record(jid, { followable: true });
            cache.snooze([jid]);

            const el = mountSocialFeed();
            // The scan control appears (compose toolbar), but no suggestions card —
            // the one known followable contact has been snoozed.
            await u.waitUntil(() => el.querySelector('.social-scan__btn'));
            expect(el.querySelector('converse-social-onboarding .social-onboarding')).toBe(null);
        }),
    );

    it(
        'keeps suggesting accounts after the user already follows someone',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');
            const cache = _converse.state.followablecache;

            // The user already follows one contact (a feed exists) — the card must
            // still recur (this used to permanently hide it).
            _converse.state.pubsubfeeds.getFeed('romeo@montague.lit', MICROBLOG_NODE, true);
            const jid = 'juliet.capulet@montague.lit';
            cache.record(jid, { followable: true });

            const el = mountSocialFeed();
            const card = await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding'));
            await u.waitUntil(() => card.textContent.includes('Juliet'));
        }),
    );

    it(
        'finds and renders people to follow when the scan button is clicked',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');
            const jid = 'juliet.capulet@montague.lit';

            // The sweep probes each subscribed contact's microblog node; only
            // Juliet's resolves with a post → only she is followable.
            vi.spyOn(api.pubsub.items, 'get').mockImplementation((j) =>
                j === jid
                    ? Promise.resolve({
                          items: [
                              stx`<item id="p1" publisher="${jid}"><entry xmlns="${ATOM}">
                                      <title type="text">hi</title>
                                      <id>tag:montague.lit,2024-01-01:p1</id>
                                      <published>2024-01-01T00:00:00Z</published>
                                  </entry></item>`.tree(),
                          ],
                      })
                    : Promise.reject(new Error('item-not-found')),
            );

            const el = mountSocialFeed();
            // The scan control lives in the compose toolbar.
            const scan = await u.waitUntil(() => el.querySelector('.social-scan__btn'));
            /** @type {HTMLButtonElement} */ (scan).click();

            // The sweep finds Juliet and the suggestions card renders her.
            const card = await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding'));
            await u.waitUntil(() => card.textContent.includes('Juliet'));
        }),
    );

    it(
        'cancelling a sweep frees the widget immediately and lets you scan again',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            await api.waitUntil('pubsubFeedsInitialized');

            // Probes that never settle, so the sweep stays in-flight until aborted
            // — mimicking unresponsive servers (which otherwise hold it ~10s).
            let probes = 0;
            vi.spyOn(api.pubsub.items, 'get').mockImplementation(() => {
                probes++;
                return new Promise(() => {});
            });

            const el = mountSocialFeed();
            const scanBtn = await u.waitUntil(() => el.querySelector('.social-scan__btn'));
            /** @type {HTMLButtonElement} */ (scanBtn).click();

            // It enters the scanning state and starts probing.
            const cancel = await u.waitUntil(() => el.querySelector('.social-scan--scanning button'));
            const probes_before_cancel = probes;
            expect(probes_before_cancel).toBeGreaterThan(0);

            /** @type {HTMLButtonElement} */ (cancel).click();

            // The control leaves the scanning state immediately, without waiting for
            // the in-flight probes to settle.
            await u.waitUntil(() => el.querySelector('.social-scan--scanning') === null);

            // Scanning again starts a fresh sweep (more probes are issued).
            const scanAgain = await u.waitUntil(() => el.querySelector('.social-scan__btn'));
            /** @type {HTMLButtonElement} */ (scanAgain).click();
            await u.waitUntil(() => el.querySelector('.social-scan--scanning'));
            await u.waitUntil(() => probes > probes_before_cancel);
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
