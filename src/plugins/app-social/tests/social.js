import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, stx, u } = converse.env;

const ATOM = 'http://www.w3.org/2005/Atom';
const PUBSUB_EVENT = `${Strophe.NS.PUBSUB}#event`;
const MICROBLOG_NODE = 'urn:xmpp:microblog:0';

/**
 * Build a headline PEP event carrying a single plain-text microblog post, as the
 * server would push it: addressed to the logged-in user, from the publisher.
 * @param {string} to - The recipient's bare JID (the logged-in user).
 * @param {string} from - The publisher's bare JID (also the feed JID).
 * @param {string} id - The PubSub item id.
 * @param {string} body - The post body.
 * @param {string} published - ISO-8601 publication time (drives ordering).
 */
function makePost(to, from, id, body, published) {
    return stx`
        <message xmlns="jabber:client" from="${from}" to="${to}" type="headline">
          <event xmlns="${PUBSUB_EVENT}">
            <items node="${MICROBLOG_NODE}">
              <item id="${id}" publisher="${from}">
                <entry xmlns="${ATOM}">
                  <title type="text">${body}</title>
                  <id>tag:montague.lit,2024-01-01:posts-${id}</id>
                  <published>${published}</published>
                  <updated>${published}</updated>
                </entry>
              </item>
            </items>
          </event>
        </message>`;
}

describe('The social feed', function () {
    it(
        'renders incoming posts and publishes via the compose box',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            // Mount the feed component directly.
            const el = document.createElement('converse-social-feed');
            document.querySelector('#conversejs').appendChild(el);

            // It resolves the own feed and renders the compose box.
            const textarea = await u.waitUntil(() => el.querySelector('.social-compose__textarea'));
            expect(el.querySelector('.social-feed__empty')).not.toBe(null);

            // A post arrives via PEP and is rendered (SignalWatcher + collectionSignal).
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="post-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title type="text">Hello social world</title>
                          <id>tag:montague.lit,2024-01-01:posts-post-1</id>
                          <published>2024-01-01T18:30:02Z</published>
                          <updated>2024-01-01T18:30:02Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
                ),
            );

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

            const el = document.createElement('converse-social-feed');
            document.querySelector('#conversejs').appendChild(el);
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="post-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title type="text">a doomed post</title>
                          <id>tag:montague.lit,2024-01-01:posts-post-1</id>
                          <published>2024-01-01T18:30:02Z</published>
                          <updated>2024-01-01T18:30:02Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
                ),
            );

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

            const el = document.createElement('converse-social-feed');
            document.querySelector('#conversejs').appendChild(el);
            await u.waitUntil(() => el.querySelector('.social-compose__textarea'));

            // Follow a contact: this creates their feed in the aggregated timeline.
            await api.microblog.follow(contact_jid);

            // An older own post and a newer post from the followed contact. These
            // arrive immediately after follow — before the followed feed's empty
            // cache has hydrated — exercising the hydration-race guard in addItems.
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(_converse, makePost(bare_jid, bare_jid, 'mine-1', 'My own post', '2024-01-01T09:00:00Z')),
            );
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(_converse, makePost(bare_jid, contact_jid, 'theirs-1', 'Juliet says hi', '2024-01-02T09:00:00Z')),
            );

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
});

const ONBOARDING_DISMISSED = 'social_onboarding_dismissed';

describe('The social onboarding card', function () {
    it(
        'suggests followable contacts and bulk-follows the selected ones',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            vi.spyOn(api.microblog, 'discoverFollowable').mockResolvedValue([
                { jid: 'juliet@capulet.lit', name: 'Juliet' },
            ]);
            const follow = vi.spyOn(api.microblog, 'follow').mockResolvedValue(/** @type {any} */ ({}));

            const el = document.createElement('converse-social-feed');
            document.querySelector('#conversejs').appendChild(el);

            // The card appears with the candidate, pre-checked.
            const card = await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding'));
            expect(card.textContent).toContain('Juliet');
            const checkbox = /** @type {HTMLInputElement} */ (card.querySelector('input[type="checkbox"]'));
            expect(checkbox.checked).toBe(true);

            // "Follow selected" follows every checked candidate via followMany.
            /** @type {HTMLButtonElement} */ (card.querySelector('.social-onboarding__actions button')).click();
            await u.waitUntil(() => follow.mock.calls.length === 1);
            expect(follow).toHaveBeenCalledWith('juliet@capulet.lit');

            // The card hides itself once onboarding is done.
            await u.waitUntil(() => el.querySelector('converse-social-onboarding .social-onboarding') === null);
        }),
    );

    it(
        'can be dismissed, and the dismissal is persisted',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            vi.spyOn(api.microblog, 'discoverFollowable').mockResolvedValue([
                { jid: 'juliet@capulet.lit', name: 'Juliet' },
            ]);

            const el = document.createElement('converse-social-feed');
            document.querySelector('#conversejs').appendChild(el);

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
            const discover = vi.spyOn(api.microblog, 'discoverFollowable').mockResolvedValue([
                { jid: 'juliet@capulet.lit', name: 'Juliet' },
            ]);

            const el = document.createElement('converse-social-feed');
            document.querySelector('#conversejs').appendChild(el);

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

            const discover = vi.spyOn(api.microblog, 'discoverFollowable').mockResolvedValue([
                { jid: 'mercutio@montague.lit', name: 'Mercutio' },
            ]);

            const el = document.createElement('converse-social-feed');
            document.querySelector('#conversejs').appendChild(el);

            const onboarding = await u.waitUntil(() => el.querySelector('converse-social-onboarding'));
            await u.waitUntil(() => discover.mock.calls.length >= 1);
            await onboarding.updateComplete;
            expect(onboarding.querySelector('.social-onboarding')).toBe(null);
        }),
    );
});
