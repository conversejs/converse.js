import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import {
    ATOM,
    MICROBLOG_NODE,
    makePost,
    makeRepost,
    makeRichPost,
    mountSocialApp,
    mountSocialFeed,
    receive,
    stubDiscoverFollowable,
} from './utils.js';

const { stx, u } = converse.env;

/**
 * Override the read-only `document.visibilityState` and fire a
 * `visibilitychange` event, so focus-dependent behaviour (a post's
 * `observableRequireFocus` summary fetch) can be driven deterministically.
 * @param {DocumentVisibilityState} state
 */
function setVisibilityState(state) {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
}

function restoreVisibilityState() {
    delete (/** @type {any} */ (document).visibilityState);
}

/**
 * Replace the real IntersectionObserver with an inert stub so a post's
 * visibility is driven manually (via `handleIntersectionCallback`) rather than
 * firing on real browser layout. Returns a restore function to call when done
 * (a plain global swap, since `vi.spyOn` can't mock a `new`-invoked constructor).
 * @returns {() => void}
 */
function stubIntersectionObserver() {
    const Real = window.IntersectionObserver;
    window.IntersectionObserver = /** @type {any} */ (
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        }
    );
    return () => {
        window.IntersectionObserver = Real;
    };
}

// Build the comment items a mocked comments-node fetch returns: `comments`
// plain comments plus `likes` ♥-comments (XEP-0277 likes ride the same node).
function makeCommentItems({ comments = 0, likes = 0 } = {}) {
    const items = [];
    for (let i = 0; i < comments; i++) {
        items.push(
            stx`<item id="c-${i}" publisher="benvolio@montague.lit"><entry xmlns="${ATOM}">
                <author><name>Benvolio</name><uri>xmpp:benvolio@montague.lit</uri></author>
                <title type="text">Comment ${i}</title>
                <id>tag:montague.lit,2024:comments-c-${i}</id>
                <published>2024-01-01T19:0${i}:00Z</published>
            </entry></item>`.tree(),
        );
    }
    for (let i = 0; i < likes; i++) {
        items.push(
            stx`<item id="like-${i}" publisher="romeo@montague.lit"><entry xmlns="${ATOM}">
                <author><name>Romeo</name><uri>xmpp:romeo@montague.lit</uri></author>
                <title type="text">♥</title>
                <id>tag:montague.lit,2024:comments-like-${i}</id>
                <published>2024-01-01T19:1${i}:00Z</published>
            </entry></item>`.tree(),
        );
    }
    return items;
}

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
        'renders the Atom title, summary and content as distinct styled blocks',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            // All three constructs: a bold-heading title, an italic-excerpt
            // summary, and normal-weight content — three distinct blocks.
            receive(
                _converse,
                makeRichPost(bare_jid, bare_jid, 'rich-1', {
                    title: 'The headline',
                    summary: 'A short excerpt',
                    content: 'The full body of the post.',
                }),
            );

            const post = await u.waitUntil(() =>
                Array.from(el.querySelectorAll('.social-post')).find((a) =>
                    a.textContent.includes('The full body of the post.'),
                ),
            );
            const title = post.querySelector('.social-post__title');
            const summary = post.querySelector('.social-post__summary');
            const content = post.querySelector('.social-post__content');
            expect(title.textContent.trim()).toBe('The headline');
            expect(title.classList.contains('social-post__title--heading')).toBe(true);
            expect(summary.textContent.trim()).toBe('A short excerpt');
            expect(summary.classList.contains('social-post__summary--excerpt')).toBe(true);
            expect(content.textContent.trim()).toBe('The full body of the post.');

            // A lone construct is plain: a title-only post has no heading style,
            // and no summary/content blocks.
            receive(
                _converse,
                makeRichPost(bare_jid, bare_jid, 'plain-1', { title: 'Just a note' }, '2024-01-02T09:00:00Z'),
            );
            const plain = await u.waitUntil(() =>
                Array.from(el.querySelectorAll('.social-post')).find((a) => a.textContent.includes('Just a note')),
            );
            expect(plain.querySelector('.social-post__title').classList.contains('social-post__title--heading')).toBe(
                false,
            );
            expect(plain.querySelector('.social-post__summary')).toBe(null);
            expect(plain.querySelector('.social-post__content')).toBe(null);
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

            const delete_button = await u.waitUntil(() => el.querySelector('.social-post__action--delete'));
            vi.spyOn(api, 'confirm').mockResolvedValue(true);
            const retract = vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);

            delete_button.click();

            await u.waitUntil(() => retract.mock.calls.length === 1);
            expect(retract).toHaveBeenCalledWith(bare_jid, MICROBLOG_NODE, 'post-1');
            await u.waitUntil(() => el.querySelector('.social-post') === null);
        }),
    );

    it(
        "merges a followed contact's posts into the timeline, newest-first",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            // A roster contact, so the post's author resolves to a contact.
            const contact_jid = 'mercutio@montague.lit';

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
            receive(_converse, makePost(bare_jid, contact_jid, 'theirs-1', 'Mercutio says hi', '2024-01-02T09:00:00Z'));

            // Both posts show in one timeline, the newer (contact's) first.
            await u.waitUntil(() => el.querySelectorAll('.social-post').length === 2);
            const articles = Array.from(el.querySelectorAll('.social-post'));
            const bodies = articles.map((a) => a.querySelector('.social-post__body').textContent.trim());
            expect(bodies).toEqual(['Mercutio says hi', 'My own post']);

            // The contact's post isn't ours → a repost button, no delete; ours is
            // the reverse.
            expect(articles[0].querySelector('.social-post__action--delete')).toBe(null);
            expect(articles[0].querySelector('.social-post__action--repost')).not.toBe(null);
            expect(articles[1].querySelector('.social-post__action--delete')).not.toBe(null);
            expect(articles[1].querySelector('.social-post__action--repost')).toBe(null);

            // Each post's author name is a per-author-coloured, clickable link that
            // opens that author's profile (a `profileselected` event bubbles up to
            // the Social app). Click the contact's post (the newest, first).
            const author = await u.waitUntil(() => {
                const a = articles[0].querySelector('a.social-post__author.show-msg-author-modal');
                return a && (/color:/).test(a.getAttribute('style') || '') ? a : null;
            });
            let selected = null;
            el.addEventListener('profileselected', (ev) => (selected = ev.detail.jid));
            author.click();
            await u.waitUntil(() => selected !== null);
            expect(selected).toBe(contact_jid);
        }),
    );

    it(
        "links every post author's avatar and name to their profile",
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

            // Both avatar and name are clickable profile links
            for (const body of ['My own post', 'A stranger speaks']) {
                const article = await u.waitUntil(() => articleFor(body));
                expect(article.querySelector('a.social-post__avatar')).not.toBe(null);
                expect(article.querySelector('a.social-post__author')).not.toBe(null);
            }

            // Clicking a non-contact author's avatar opens *their* profile.
            let selected = null;
            el.addEventListener('profileselected', (ev) => (selected = ev.detail.jid));
            articleFor('A stranger speaks').querySelector('a.social-post__avatar').click();
            await u.waitUntil(() => selected !== null);
            expect(selected).toBe(stranger);
        }),
    );

    it(
        'renders URLs and hashtags in a post body as rich elements',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            receive(_converse, makePost(bare_jid, bare_jid, 'p1', 'reading https://conversejs.org about #xmpp today'));

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

    it(
        'reposts a post into your own feed via the repost button, guarding while in flight and alerting on failure',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            const contact_jid = 'juliet@capulet.lit';

            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
            const toast = vi.spyOn(api.toast, 'show');

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            // Follow a contact and receive one of their posts. Clear the follow's
            // own publish (the XEP-0330 list item) so we assert only reposts.
            await api.microblog.follow(contact_jid);
            receive(_converse, makePost(bare_jid, contact_jid, 'theirs-1', 'Repeat me'));
            const repost_btn = await u.waitUntil(() => el.querySelector('.social-post__action--repost'));

            // First attempt: keep the repost's publish pending, then fail it.
            let reject_publish;
            publish.mockImplementation(() => new Promise((_, reject) => (reject_publish = reject)));
            publish.mockClear();

            repost_btn.click();
            await u.waitUntil(() => publish.mock.calls.length === 1);

            // While the repost is in flight the button is disabled, so a second
            // click can't publish a duplicate.
            await u.waitUntil(() => repost_btn.disabled);
            repost_btn.click();
            expect(publish.mock.calls.length).toBe(1);

            // The publish fails: the user gets a toast and no phantom repost is
            // rendered.
            reject_publish(new Error('not-acceptable'));
            await u.waitUntil(() => toast.mock.calls.length === 1);
            expect(toast.mock.calls[0][1].type).toBe('danger');
            expect(el.querySelector('.social-post__repost')).toBe(null);

            // Retrying proves the button re-enabled after the failure. This time
            // the publish succeeds: the post goes to our own node (the stanza's
            // shape — <author> + the rel="via" link — is covered by the headless
            // microblog tests) and renders with the "reposted by you" eyebrow.
            publish.mockResolvedValue(undefined);
            await u.waitUntil(() => !repost_btn.disabled);
            repost_btn.click();
            await u.waitUntil(() => publish.mock.calls.length === 2);
            const [jid, node] = publish.mock.calls[1];
            expect(jid).toBe(bare_jid);
            expect(node).toBe(MICROBLOG_NODE);

            const reposted = await u.waitUntil(() =>
                Array.from(el.querySelectorAll('.social-post')).find((a) => a.querySelector('.social-post__repost')),
            );
            expect(reposted.querySelector('.social-post__repost').textContent).toContain('You');
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

describe('The social post detail view', function () {
    it(
        "opens a post's comment thread, renders comments, posts one, and returns to the timeline",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            // Only a comments-node fetch returns items; the timeline feeds' own
            // fetchPosts (same api) must stay empty so comments don't leak in.
            vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, node) => {
                if (node.startsWith('urn:xmpp:microblog:0:comments/')) {
                    return Promise.resolve({
                        items: [
                            stx`
                            <item id="c-1" publisher="benvolio@montague.lit">
                              <entry xmlns="${ATOM}">
                                <author><name>Benvolio</name><uri>xmpp:benvolio@montague.lit</uri></author>
                                <title type="text">Nice one!</title>
                                <id>tag:montague.lit,2024:comments-c-1</id>
                                <published>2024-01-01T19:00:00Z</published>
                              </entry>
                            </item>`.tree(),
                        ],
                    });
                }
                return Promise.resolve({ items: [] });
            });

            const el = mountSocialApp();
            // The app mounts the feed once connected.
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-compose__textarea'));

            // An own post arrives; open its thread via the Comments button.
            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Hello world'));
            const comment_btn = await u.waitUntil(() => el.querySelector('.social-post__action--comment'));
            comment_btn.click();

            // The detail view takes over, showing the post + the fetched comment.
            const detail = await u.waitUntil(() => el.querySelector('converse-social-post'));
            expect(el.querySelector('converse-social-feed')).toBe(null);
            await u.waitUntil(() =>
                Array.from(detail.querySelectorAll('.social-comment .social-post__body')).some((n) =>
                    n.textContent.includes('Nice one!'),
                ),
            );

            // Posting a comment publishes to the post's comments node + renders.
            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            const textarea = detail.querySelector('.social-comment-compose__textarea');
            textarea.value = 'Thanks!';
            detail.querySelector('.social-comment-compose button[type="submit"]').click();

            await u.waitUntil(() => publish.mock.calls.length === 1);
            const [jid, node, item] = publish.mock.calls[0];
            expect(jid).toBe(bare_jid);
            expect(node).toBe('urn:xmpp:microblog:0:comments/post-1');
            expect(item.tree().querySelector('title').textContent).toBe('Thanks!');
            expect(item.tree().querySelector('author uri').textContent).toBe(`xmpp:${bare_jid}`);

            await u.waitUntil(() =>
                Array.from(detail.querySelectorAll('.social-comment .social-post__body')).some((n) =>
                    n.textContent.includes('Thanks!'),
                ),
            );

            // The back button returns to the timeline.
            detail.querySelector('.social-post-detail__back').click();
            await u.waitUntil(
                () => el.querySelector('converse-social-feed') && !el.querySelector('converse-social-post'),
            );
        }),
    );
});

describe('The social timeline comment counts', function () {
    it(
        "fetches a post's comment count once when it scrolls into view, and renders it",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            // Drive visibility deterministically: stub the IntersectionObserver so
            // it doesn't auto-fire on real layout, and control document focus.
            const restoreIO = stubIntersectionObserver();
            setVisibilityState('visible');

            // The comments node has 2 comments and 1 ♥ like; every other node
            // (the timeline feeds) stays empty so comments don't leak in.
            const getSpy = vi
                .spyOn(api.pubsub.items, 'get')
                .mockImplementation((_jid, node) =>
                    String(node).startsWith('urn:xmpp:microblog:0:comments/')
                        ? Promise.resolve({ items: makeCommentItems({ comments: 2, likes: 1 }) })
                        : Promise.resolve({ items: [] }),
                );
            const commentFetches = () =>
                getSpy.mock.calls.filter((c) => String(c[1]).startsWith('urn:xmpp:microblog:0:comments/')).length;

            try {
                const el = mountSocialFeed();
                await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

                receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Count my comments'));
                const msg = /** @type {any} */ (await u.waitUntil(() => el.querySelector('converse-social-message')));
                await msg.updateComplete;

                // Nothing is fetched until the post is actually seen.
                expect(commentFetches()).toBe(0);

                // Scrolls into view → exactly one summary fetch for its comments node.
                msg.handleIntersectionCallback([{ intersectionRatio: 1 }]);
                await u.waitUntil(() => commentFetches() === 1);

                // The comment count renders next to the Comments button. It counts
                // the 2 comments; the ♥ like is partitioned out (likes UI is a later
                // slice), so the badge shows 2, not 3.
                const count = await u.waitUntil(() => el.querySelector('.social-post__count'));
                expect(count.textContent.trim()).toBe('2');

                // Re-entering the viewport doesn't refetch (observable: 'once').
                msg.handleIntersectionCallback([{ intersectionRatio: 0 }]);
                msg.handleIntersectionCallback([{ intersectionRatio: 1 }]);
                expect(commentFetches()).toBe(1);
            } finally {
                restoreVisibilityState();
                restoreIO();
            }
        }),
    );

    it(
        "defers a post's summary fetch while the tab is backgrounded",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            const restoreIO = stubIntersectionObserver();
            // Start on a backgrounded tab.
            setVisibilityState('hidden');

            const getSpy = vi
                .spyOn(api.pubsub.items, 'get')
                .mockImplementation((_jid, node) =>
                    String(node).startsWith('urn:xmpp:microblog:0:comments/')
                        ? Promise.resolve({ items: makeCommentItems({ comments: 1 }) })
                        : Promise.resolve({ items: [] }),
                );
            const commentFetches = () =>
                getSpy.mock.calls.filter((c) => String(c[1]).startsWith('urn:xmpp:microblog:0:comments/')).length;

            try {
                const el = mountSocialFeed();
                await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

                receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Later'));
                const msg = /** @type {any} */ (await u.waitUntil(() => el.querySelector('converse-social-message')));
                await msg.updateComplete;

                // In view, but the tab is in the background: the fetch is deferred.
                msg.handleIntersectionCallback([{ intersectionRatio: 1 }]);
                expect(commentFetches()).toBe(0);

                // Returning to the tab fires the deferred fetch and the count shows.
                setVisibilityState('visible');
                await u.waitUntil(() => commentFetches() === 1);
                const count = await u.waitUntil(() => el.querySelector('.social-post__count'));
                expect(count.textContent.trim()).toBe('1');
            } finally {
                restoreVisibilityState();
                restoreIO();
            }
        }),
    );
});

describe('Liking a post', function () {
    it(
        'toggles a ♥ on a timeline post, publishing then retracting',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            // The on-visibility summary fetch (real IntersectionObserver) finds an
            // empty thread; the ♥ publish is what we assert on.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));
            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Like me'));

            const like = await u.waitUntil(() => el.querySelector('.social-post__action--like'));
            expect(like.classList.contains('social-post__action--liked')).toBe(false);

            // Click likes it: the ♥ fills optimistically and a ♥ comment is published.
            like.click();
            await u.waitUntil(() => el.querySelector('.social-post__action--liked'));
            const call = await u.waitUntil(() =>
                publish.mock.calls.find((c) => String(c[1]).startsWith('urn:xmpp:microblog:0:comments/')),
            );
            expect(call[2].tree().querySelector('title').textContent).toBe('♥');
            await u.waitUntil(
                () => el.querySelector('.social-post__action--like .social-post__count')?.textContent.trim() === '1',
            );

            // Click again un-likes it: the ♥ is retracted and the button un-fills.
            const retract = vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);
            el.querySelector('.social-post__action--like').click();
            await u.waitUntil(() => retract.mock.calls.length === 1);
            await u.waitUntil(() => !el.querySelector('.social-post__action--liked'));
        }),
    );

    it(
        'rolls back and toasts when the server refuses an un-like',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));
            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Like me'));

            // Like it first.
            const like = await u.waitUntil(() => el.querySelector('.social-post__action--like'));
            like.click();
            await u.waitUntil(() => el.querySelector('.social-post__action--liked'));

            // The retract is refused (as Prosody does on a foreign post).
            vi.spyOn(api.pubsub, 'retract').mockRejectedValue(new Error('forbidden'));
            const toast = vi.spyOn(api.toast, 'show');

            el.querySelector('.social-post__action--like').click();

            // A danger toast explains it, and the optimistic un-like rolls back so
            // the ♥ stays filled.
            await u.waitUntil(() => toast.mock.calls.some((c) => c[0] === 'like-failed'));
            expect(toast.mock.calls.find((c) => c[0] === 'like-failed')[1].type).toBe('danger');
            await u.waitUntil(() => el.querySelector('.social-post__action--liked'));
        }),
    );

    it(
        'excludes ♥ likes from the detail thread and shows a like count',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            // The comments node holds one real comment and one ♥ like.
            vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, node) =>
                String(node).startsWith('urn:xmpp:microblog:0:comments/')
                    ? Promise.resolve({ items: makeCommentItems({ comments: 1, likes: 1 }) })
                    : Promise.resolve({ items: [] }),
            );

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-compose__textarea'));
            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Hello'));

            const comment_btn = await u.waitUntil(() => el.querySelector('.social-post__action--comment'));
            comment_btn.click();
            const detail = await u.waitUntil(() => el.querySelector('converse-social-post'));

            // The real comment renders in the thread...
            await u.waitUntil(() =>
                Array.from(detail.querySelectorAll('.social-comment .social-post__body')).some((n) =>
                    n.textContent.includes('Comment 0'),
                ),
            );
            // ...but the ♥ like never appears as a comment.
            const bodies = Array.from(detail.querySelectorAll('.social-comment .social-post__body')).map(
                (n) => n.textContent,
            );
            expect(bodies.some((b) => b.includes('♥'))).toBe(false);

            // A like count is shown, and the comments heading counts only the
            // real comment (the ♥ is partitioned out of both).
            const likes = await u.waitUntil(() => detail.querySelector('.social-post-detail__likes'));
            expect(likes.textContent).toContain('1 like');
            expect(detail.querySelector('.social-comments__heading').textContent).toContain('1 comment');
        }),
    );
});

describe('The social profile view', function () {
    it(
        "opens an author's profile from a post and returns to the timeline",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            // Keep the network quiet (nothing backfilled).
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-compose__textarea'));

            // An own post; clicking our name opens our own profile.
            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Hello world'));
            const author = await u.waitUntil(() => el.querySelector('.social-post__author.show-msg-author-modal'));
            author.click();

            // The profile view takes over; the timeline is gone.
            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));
            expect(el.querySelector('converse-social-feed')).toBe(null);

            // The header shows our JID; our own profile has no follow toggle.
            await u.waitUntil(() => profile.querySelector('.social-profile__jid')?.textContent.includes(bare_jid));
            expect(profile.querySelector('.social-profile__follow')).toBe(null);

            // Our own post is listed (from the shared own feed).
            await u.waitUntil(() =>
                Array.from(profile.querySelectorAll('.social-profile__posts .social-post__body')).some((n) =>
                    n.textContent.includes('Hello world'),
                ),
            );

            // Back returns to the timeline.
            profile.querySelector('.social-post-detail__back').click();
            await u.waitUntil(
                () => el.querySelector('converse-social-feed') && !el.querySelector('converse-social-profile'),
            );
        }),
    );

    it(
        'shows an Unfollow toggle on a followed author profile and unfollows',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            const contact_jid = 'mercutio@montague.lit';

            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'unsubscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-compose__textarea'));

            // Follow the contact, then a post from them arrives in the timeline.
            await api.microblog.follow(contact_jid);
            receive(_converse, makePost(bare_jid, contact_jid, 'p-1', 'Mercutio speaks'));
            await u.waitUntil(() => el.querySelector('.social-post'));

            // Open their profile from the post.
            el.querySelector('.social-post__author.show-msg-author-modal').click();
            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));

            // A followed author shows an Unfollow button and their post is listed.
            const follow_btn = await u.waitUntil(() => {
                const b = profile.querySelector('.social-profile__follow');
                return b && b.textContent.trim() === 'Unfollow' ? b : null;
            });
            await u.waitUntil(() =>
                Array.from(profile.querySelectorAll('.social-profile__posts .social-post__body')).some((n) =>
                    n.textContent.includes('Mercutio speaks'),
                ),
            );

            // Clicking it unfollows; the button flips to Follow.
            follow_btn.click();
            await u.waitUntil(() => {
                const b = profile.querySelector('.social-profile__follow');
                return b && b.textContent.trim() === 'Follow';
            });
            expect(api.microblog.isFollowing(contact_jid)).toBe(false);
        }),
    );

    it(
        'browses a non-followed author without polluting the timeline, then follows',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            const stranger = 'yorick@denmark.lit';

            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-compose__textarea'));

            // We repost a stranger's post into our own feed; the author header is
            // the *original* author (the stranger), so clicking it opens theirs.
            receive(_converse, makeRepost(bare_jid, bare_jid, 'r-1', 'Alas', stranger, 'Yorick'));
            const author = await u.waitUntil(() => el.querySelector('.social-post__author.show-msg-author-modal'));
            expect(api.microblog.isFollowing(stranger)).toBe(false);
            author.click();

            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));

            // Browsing a non-followed author must NOT add their feed to the
            // aggregated collection (else their posts would enter the timeline).
            expect(_converse.state.pubsubfeeds.getFeed(stranger, MICROBLOG_NODE, false)).toBeUndefined();

            // A Follow button is shown; clicking it follows (creating their feed),
            // and the toggle flips to Unfollow.
            const follow_btn = await u.waitUntil(() => {
                const b = profile.querySelector('.social-profile__follow');
                return b && b.textContent.trim() === 'Follow' ? b : null;
            });
            follow_btn.click();
            await u.waitUntil(() => {
                const b = profile.querySelector('.social-profile__follow');
                return b && b.textContent.trim() === 'Unfollow';
            });
            expect(api.microblog.isFollowing(stranger)).toBe(true);
        }),
    );

    it(
        "explains that an access-restricted feed isn't public, rather than 'No posts yet'",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            const stranger = 'yorick@denmark.lit';

            // Their microblog is presence/roster-access: reading it is refused.
            const forbidden = Object.assign(new Error('forbidden'), { name: 'forbidden' });
            vi.spyOn(api.pubsub.items, 'get').mockRejectedValue(forbidden);

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-compose__textarea'));

            // Reach the stranger's profile via a repost of theirs.
            receive(_converse, makeRepost(bare_jid, bare_jid, 'r-1', 'Alas', stranger, 'Yorick'));
            const author = await u.waitUntil(() => el.querySelector('.social-post__author.show-msg-author-modal'));
            author.click();

            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));

            // The empty state names the restriction (a lock + "not public"), not
            // the misleading "No posts yet".
            const empty = await u.waitUntil(() => profile.querySelector('.social-profile__restricted'));
            expect(empty.textContent).toContain("aren't public");
            expect(profile.querySelector('.social-feed__empty').textContent).not.toContain('No posts yet');
            expect(profile.querySelector('.social-profile__restricted converse-icon')).not.toBe(null);
        }),
    );
});
