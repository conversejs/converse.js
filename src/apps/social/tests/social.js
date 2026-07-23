import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import {
    ATOM,
    MICROBLOG_NODE,
    PUBSUB_EVENT,
    makePost,
    makeRepost,
    makeRichPost,
    mountSocialApp,
    mountSocialFeed,
    openDiscover,
    publishViaComposer,
    receive,
    stubDiscoverFollowable,
} from './utils.js';
import { buildSocialRoute } from '../routing.js';

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
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));
            expect(el.querySelector('.social-feed__empty')).not.toBe(null);

            // A post arrives via PEP and is rendered (SignalWatcher + collectionSignal).
            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Hello social world'));

            const body = await u.waitUntil(() => el.querySelector('.social-post__body'));
            expect(body.textContent.trim()).toBe('Hello social world');

            // Publishing via the compose box builds + publishes, then optimistically renders.
            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            const compose = await publishViaComposer(el, 'My first microblog post');

            await u.waitUntil(() => publish.mock.calls.length === 1);
            const [jid, node] = publish.mock.calls[0];
            expect(jid).toBe(bare_jid);
            expect(node).toBe(MICROBLOG_NODE);

            await u.waitUntil(() =>
                Array.from(el.querySelectorAll('.social-post__body')).some((n) =>
                    n.textContent.includes('My first microblog post'),
                ),
            );
            // The composer is cleared after a successful publish.
            await u.waitUntil(() => compose._handle.isEmpty());
        }),
    );

    it(
        'renders the Atom title, summary and content as distinct styled blocks',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

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
        'renders rich Atom content (html/xhtml/text-html) as real HTML, with a Read more source link',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

            // Two posts through the template's sanitize-and-render path. `rich-ui-1`:
            // an entity-escaped `type="html"` <summary> and a Movim-style duplicated
            // <content> (rich XHTML + trailing Markdown), plus a `rel="alternate"`
            // whose URL the body already links to (so no duplicate "Read more").
            // `news-ui-1`: a Phoronix-style MIME `type="text/html"` teaser whose only
            // link to the article is the `rel="alternate"` permalink → a "Read more".
            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="http://jabber.org/protocol/pubsub#event">
                    <items node="${MICROBLOG_NODE}">
                      <item id="rich-ui-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title>Patch release</title>
                          <summary type="html">&lt;p&gt;A short &lt;em&gt;excerpt&lt;/em&gt;.&lt;/p&gt;</summary>
                          <content type="xhtml">
                            <div xmlns="http://www.w3.org/1999/xhtml">
                              <p>A small <a href="https://mov.im/x">patch</a> release.</p>
                              <h2>Notifications</h2>
                            </div>
                          </content>
                          <content type="text">A small [patch](https://mov.im/x) release.## Notifications</content>
                          <link href="https://mov.im/x" type="text/html" rel="alternate"/>
                          <published>2026-06-28T16:39:45Z</published>
                          <updated>2026-06-28T16:39:45Z</updated>
                        </entry>
                      </item>
                      <item id="news-ui-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title>Debian 13.6 Released</title>
                          <content type="text/html">&lt;body&gt;Debian 13.6 is out...&lt;/body&gt;</content>
                          <link href="https://www.phoronix.com/news/Debian-13.6-Released" type="text/html" rel="alternate"/>
                          <published>2026-07-11T14:31:23Z</published>
                          <updated>2026-07-11T14:31:23Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            const post = await u.waitUntil(() =>
                Array.from(el.querySelectorAll('.social-post')).find((a) => a.textContent.includes('patch release')),
            );

            // XHTML content: real link + heading elements, no Markdown tokens leaked.
            const content = post.querySelector('.social-post__content');
            expect(content.querySelector('a[href="https://mov.im/x"]')).not.toBe(null);
            expect(content.querySelector('h2').textContent).toBe('Notifications');
            expect(content.textContent).not.toContain('##');
            expect(content.textContent).not.toContain('](');

            // Entity-escaped `type="html"` summary: real emphasis, never literal tags.
            const summary = post.querySelector('.social-post__summary');
            expect(summary.querySelector('em').textContent).toBe('excerpt');
            expect(summary.textContent).not.toContain('<p>');
            expect(summary.textContent).not.toContain('&lt;');

            // The body already links to the alternate URL, so we don't add a second one.
            expect(post.querySelector('.social-post__source')).toBe(null);

            // The Phoronix-style teaser: `type="text/html"` renders as real HTML (no
            // literal tags), and its permalink surfaces as a "Read more" link.
            const news = await u.waitUntil(() =>
                Array.from(el.querySelectorAll('.social-post')).find((a) => a.textContent.includes('Debian 13.6')),
            );
            expect(news.textContent).toContain('Debian 13.6 is out...');
            expect(news.textContent).not.toContain('&lt;');
            const source = news.querySelector(
                '.social-post__source a[href="https://www.phoronix.com/news/Debian-13.6-Released"]',
            );
            expect(source).not.toBe(null);
            expect(source.textContent).toContain('Read more');
        }),
    );

    it(
        'renders an image `<link rel="enclosure">`, degrading to a link if it fails to load',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

            // A Movim meme post: the picture lives only in the enclosure link, the
            // body is hashtags. The parser must surface the enclosure and the
            // template must render it as a real <img>.
            const src = 'https://media.discordapp.net/attachments/1/2/image.png';
            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="http://jabber.org/protocol/pubsub#event">
                    <items node="${MICROBLOG_NODE}">
                      <item id="meme-ui-1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title>On comprend mieux !</title>
                          <link type="image/png" href="${src}" title="${src}" rel="enclosure"/>
                          <content type="text">#Humour, #meme</content>
                          <published>2026-06-28T16:39:45Z</published>
                          <updated>2026-06-28T16:39:45Z</updated>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            const post = await u.waitUntil(() =>
                Array.from(el.querySelectorAll('.social-post')).find((a) =>
                    a.textContent.includes('On comprend mieux'),
                ),
            );
            const img = await u.waitUntil(() => post.querySelector('.social-post__media img'));
            expect(img.getAttribute('src')).toBe(src);

            // We pass the URL as the image's href, so a failed load (e.g. an expired
            // CDN link) degrades to a link rather than the browser's broken-image icon.
            img.dispatchEvent(new Event('error'));
            const link = await u.waitUntil(() => post.querySelector(`.social-post__enclosure a[href="${src}"]`));
            expect(link).not.toBe(null);
            expect(post.querySelector('.social-post__media img')).toBe(null);
        }),
    );

    it(
        'deletes an own post via the delete button',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

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
        'edits an own post in place, republishing to the same item id',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'original text', '2024-01-01T18:30:02Z'));

            const body = await u.waitUntil(() => el.querySelector('.social-post__body'));
            expect(body.textContent.trim()).toBe('original text');

            // Clicking Edit swaps the body for an inline composer prefilled with the post.
            /** @type {HTMLButtonElement} */ (
                await u.waitUntil(() => el.querySelector('.social-post__action--edit'))
            ).click();

            const compose = await u.waitUntil(() => el.querySelector('converse-social-compose-rich.social-post__edit'));
            const editable = await u.waitUntil(() => compose.querySelector('.social-rich__editable'));
            const handle = await compose.ensureEditor();
            await u.waitUntil(() => handle.getMarkdown() === 'original text');

            // Append to the prefilled text, then Save.
            /** @type {HTMLElement} */ (editable).focus();
            handle.insertText(' (edited)');

            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            const save = await u.waitUntil(() => {
                const btn = /** @type {HTMLButtonElement} */ (compose.querySelector('.social-rich__post'));
                return btn && !btn.disabled ? btn : null;
            });
            save.click();

            await u.waitUntil(() => publish.mock.calls.length === 1);
            const [jid, node, item] = publish.mock.calls[0];
            expect(jid).toBe(bare_jid);
            expect(node).toBe(MICROBLOG_NODE);

            // Republished to the SAME item id: `published` preserved, `updated` bumped,
            // the edited text carried as `<content type="text">`.
            const tree = item.tree();
            const entry = tree.getElementsByTagName('entry')[0];
            const tagText = (/** @type {string} */ name) =>
                Array.from(entry.getElementsByTagName(name)).map((n) => n.textContent);
            expect(tree.getAttribute('id')).toBe('post-1');
            expect(tagText('published')).toEqual(['2024-01-01T18:30:02Z']);
            expect(tagText('updated')[0]).not.toBe('2024-01-01T18:30:02Z');
            expect(tagText('content').join(' ')).toContain('original text (edited)');

            // Edit mode exits and the post body shows the edited text.
            await u.waitUntil(() => el.querySelector('.social-post__edit') === null);
            await u.waitUntil(() =>
                el.querySelector('.social-post__body')?.textContent.includes('original text (edited)'),
            );
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
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

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
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

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
        'routes xmpp: links in a post body to the in-app profile view',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;
            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

            // A post whose XHTML body mentions Bob via an xmpp: link (the shape the
            // rich composer's mention typeahead publishes), with an RFC 5122 query
            // part to prove it gets stripped from the profile JID.
            receive(
                _converse,
                stx`<message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                    <event xmlns="${PUBSUB_EVENT}">
                        <items node="${MICROBLOG_NODE}">
                            <item id="mention-1" publisher="${bare_jid}">
                                <entry xmlns="${ATOM}">
                                    <title type="text">Hello [@Bob](xmpp:bob@shakespeare.lit)</title>
                                    <content type="xhtml">
                                        <div xmlns="http://www.w3.org/1999/xhtml"><p>Hello <a href="xmpp:bob@shakespeare.lit?message">@Bob</a> and <a href="https://example.org/">a plain link</a></p></div>
                                    </content>
                                    <id>tag:shakespeare.lit,2024:posts-mention-1</id>
                                    <published>2024-01-03T09:00:00Z</published>
                                    <updated>2024-01-03T09:00:00Z</updated>
                                </entry>
                            </item>
                        </items>
                    </event>
                </message>`,
            );

            // Clicking the mention opens Bob's profile in-app (no OS protocol handler).
            const anchor = await u.waitUntil(() => el.querySelector('.social-post__body a[href^="xmpp:"]'));
            let detail = null;
            el.addEventListener('profileselected', (ev) => (detail = ev.detail));
            anchor.click();
            await u.waitUntil(() => detail !== null);
            expect(detail.jid).toBe('bob@shakespeare.lit');

            // A regular https link is not intercepted. (A document-level guard
            // records whether anything below prevented the default, then prevents
            // it itself so the test page doesn't actually navigate away.)
            detail = null;
            const plain = el.querySelector('.social-post__body a[href^="https:"]');
            let was_prevented = null;
            const guard = (/** @type {MouseEvent} */ ev) => {
                was_prevented = ev.defaultPrevented;
                ev.preventDefault();
            };
            document.addEventListener('click', guard, { once: true });
            plain.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            expect(detail).toBe(null);
            expect(was_prevented).toBe(false);
        }),
    );

    it(
        'attributes a community-feed post to its source node and its bare publisher',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);

            // A news node (Phoronix on news.movim.eu) republished by a gateway,
            // whose item publisher is a *full* JID (Movim: `…/atomtopubsub`).
            const feed = await _converse.api.microblog.feeds.get('news.movim.eu', 'Phoronix', true);

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

            await feed.addItems([
                stx`
                <item id="p1" publisher="edhelas@movim.eu/atomtopubsub">
                  <entry xmlns="${ATOM}">
                    <title type="text">OpenCL 3.1 on Asahi</title>
                    <id>tag:news.movim.eu,2026:p1</id>
                    <published>2026-07-15T01:00:00Z</published>
                  </entry>
                </item>`.tree(),
            ]);

            await u.waitUntil(() => el.querySelector('.social-post'));

            // A quiet "via <node> on <service>" line links to the node's feed.
            const via = await u.waitUntil(() => el.querySelector('.social-post__via'));
            expect(via.textContent.trim()).toMatch(/via Phoronix on news\.movim\.eu/);

            const events = [];
            el.addEventListener('profileselected', (ev) => events.push(ev.detail));

            // Clicking the "via" line opens the pubsub node's feed profile.
            via.click();
            await u.waitUntil(() => events.length === 1);
            expect(events[0]).toEqual({ jid: 'news.movim.eu', node: 'Phoronix' });

            // Clicking the author opens the *bare* publisher's profile: the
            // `/atomtopubsub` resource is dropped so it matches a bare follow.
            el.querySelector('a.social-post__author').click();
            await u.waitUntil(() => events.length === 2);
            expect(events[1].jid).toBe('edhelas@movim.eu');
        }),
    );

    it(
        'renders URLs and hashtags in a post body as rich elements',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

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

            // The hashtag filter is owned by the Social app (so it's routable), so
            // mount the whole app rather than a standalone feed.
            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

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
            expect(el.querySelector('.social-rich__editable')).toBe(null);

            // Clearing restores the full timeline and the compose box.
            el.querySelector('.social-feed__filter-clear').click();
            await u.waitUntil(() => el.querySelectorAll('.social-post').length === 2);
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));
        }),
    );

    it(
        'publishes inline #hashtags as machine-readable Atom <category> terms',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

            const publish = vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            await publishViaComposer(el, 'Loving #XMPP and #xmpp today');

            await u.waitUntil(() => publish.mock.calls.length === 1);
            const entry = publish.mock.calls[0][2].tree().getElementsByTagName('entry')[0];
            const terms = Array.from(entry.getElementsByTagName('category')).map((c) => c.getAttribute('term'));
            // De-duplicated and lower-cased.
            expect(terms).toEqual(['xmpp']);
        }),
    );

    it(
        "surfaces a post's category-only tags as clickable chips",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

            // A post carrying a structured <category> tag, with no inline #hashtag.
            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="p1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title type="text">A tidy little post</title>
                          <category term="Rust"/>
                          <id>tag:montague.lit,2026:p1</id>
                          <published>2026-07-15T01:00:00Z</published>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            // The tag surfaces as a clickable chip (lower-cased), not present inline.
            const chip = await u.waitUntil(() => el.querySelector('.social-post__tags .social-post__hashtag'));
            expect(chip.textContent.trim()).toBe('#rust');

            // Clicking it requests a filter on that tag.
            let selected = null;
            el.addEventListener('hashtagselected', (ev) => (selected = ev.detail.tag));
            /** @type {HTMLElement} */ (chip).click();
            expect(selected).toBe('rust');
        }),
    );

    it(
        'renders a geotagged post as a location line linking to a map',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const bare_jid = _converse.bare_jid;

            const el = mountSocialFeed();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

            receive(
                _converse,
                stx`
                <message xmlns="jabber:client" from="${bare_jid}" to="${bare_jid}" type="headline">
                  <event xmlns="${PUBSUB_EVENT}">
                    <items node="${MICROBLOG_NODE}">
                      <item id="p1" publisher="${bare_jid}">
                        <entry xmlns="${ATOM}">
                          <title type="text">Lost in the forest</title>
                          <geoloc xmlns="http://jabber.org/protocol/geoloc">
                            <lat>48.171761</lat>
                            <lon>-3.3667986</lon>
                            <locality>Rennes</locality>
                            <country>France</country>
                          </geoloc>
                          <id>tag:montague.lit,2026:p1</id>
                          <published>2026-07-15T01:00:00Z</published>
                        </entry>
                      </item>
                    </items>
                  </event>
                </message>`,
            );

            // A location line with the place name, linking to the OpenStreetMap
            // coordinates (via the default geouri_replacement).
            const loc = await u.waitUntil(() => el.querySelector('.social-post__location a'));
            expect(loc.textContent.trim()).toBe('Rennes, France');
            const href = loc.getAttribute('href');
            expect(href).toContain('openstreetmap.org');
            expect(href).toContain('mlat=48.171761');
            expect(href).toContain('mlon=-3.3667986');
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
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

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
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

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

describe('The Discover modal suggestions', function () {
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
            const modal = await openDiscover(el, api);

            // The card appears with the candidate, pre-checked. The contact name
            // is rendered asynchronously, so wait for it to appear.
            const card = await u.waitUntil(() => modal.querySelector('converse-social-onboarding .social-onboarding'));
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
            const modal = await openDiscover(el, api);
            const card = await u.waitUntil(() => modal.querySelector('converse-social-onboarding .social-onboarding'));
            await u.waitUntil(() => card.textContent.includes('Juliet'));

            // Dismiss snoozes the shown candidate: the suggestions card empties and
            // the snooze is persisted on the cache (not a permanent global flag).
            /** @type {HTMLButtonElement} */ (card.querySelector('.social-onboarding__dismiss')).click();
            await u.waitUntil(() => modal.querySelector('converse-social-onboarding .social-onboarding') === null);
            expect(cache.get(jid).get('snoozed')).toBe(true);
            // The "Discover" control (in the compose toolbar) remains as the
            // re-entry point to discovery.
            expect(el.querySelector('.social-discover__btn')).not.toBe(null);
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
            const modal = await openDiscover(el, api);
            // The scan control is present, but no suggestions card — the one known
            // followable contact has been snoozed.
            const onboarding = await u.waitUntil(() => modal.querySelector('converse-social-onboarding'));
            await onboarding.updateComplete;
            expect(onboarding.querySelector('.social-onboarding')).toBe(null);
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
            const modal = await openDiscover(el, api);
            const card = await u.waitUntil(() => modal.querySelector('converse-social-onboarding .social-onboarding'));
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
            // The scan control now lives in the Discover modal.
            const modal = await openDiscover(el, api);
            const scan = await u.waitUntil(() => modal.querySelector('.social-scan__btn'));
            /** @type {HTMLButtonElement} */ (scan).click();

            // The sweep finds Juliet and the modal's suggestions render her.
            const card = await u.waitUntil(() => modal.querySelector('converse-social-onboarding .social-onboarding'));
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
            const modal = await openDiscover(el, api);
            const scanBtn = await u.waitUntil(() => modal.querySelector('.social-scan__btn'));
            /** @type {HTMLButtonElement} */ (scanBtn).click();

            // It enters the scanning state and starts probing.
            const cancel = await u.waitUntil(() => modal.querySelector('.social-scan--scanning button'));
            const probes_before_cancel = probes;
            expect(probes_before_cancel).toBeGreaterThan(0);

            /** @type {HTMLButtonElement} */ (cancel).click();

            // The control leaves the scanning state immediately, without waiting for
            // the in-flight probes to settle.
            await u.waitUntil(() => modal.querySelector('.social-scan--scanning') === null);

            // Scanning again starts a fresh sweep (more probes are issued).
            const scanAgain = await u.waitUntil(() => modal.querySelector('.social-scan__btn'));
            /** @type {HTMLButtonElement} */ (scanAgain).click();
            await u.waitUntil(() => modal.querySelector('.social-scan--scanning'));
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
            const modal = await openDiscover(el, api);

            // Initially nothing to suggest → no card.
            const onboarding = await u.waitUntil(() => modal.querySelector('converse-social-onboarding'));
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
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

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
                await u.waitUntil(() => el.querySelector('.social-rich__editable'));

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
                await u.waitUntil(() => el.querySelector('.social-rich__editable'));

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
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));
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
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));
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
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));
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
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

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
        'renders an XEP-0472 gallery node as an image grid',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const service = 'pubsub.montague.lit';
            const feed = await api.microblog.feeds.get(service, 'photos', true);
            // Mark it a gallery so discoverType() short-circuits (no disco round-trip).
            feed.set({ type: 'urn:xmpp:pubsub-social-feed:gallery:1' });
            await feed.addItems([
                stx`
                <item id="g1" publisher="${service}">
                  <entry xmlns="${ATOM}">
                    <title type="text">Sunset</title>
                    <link rel="enclosure" href="https://montague.lit/img/sunset.jpg" type="image/jpeg" title="Sunset"/>
                    <id>tag:${service},2026:g1</id>
                    <published>2026-07-15T01:00:00Z</published>
                  </entry>
                </item>`.tree(),
            ]);

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            // Open the gallery feed's own profile via its "via" link in the timeline.
            const via = await u.waitUntil(() => el.querySelector('converse-social-feed .social-post__via'));
            /** @type {HTMLElement} */ (via).click();

            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));

            // The posts render as a grid of image tiles, not as text rows.
            const tile = await u.waitUntil(() => profile.querySelector('.social-gallery .social-gallery__tile img'));
            expect(tile.getAttribute('src')).toBe('https://montague.lit/img/sunset.jpg');
            expect(profile.querySelector('.social-post__body')).toBe(null);

            // Clicking a tile opens the shared lightbox with that image.
            const modal_show = vi.spyOn(api.modal, 'show').mockReturnValue(undefined);
            /** @type {HTMLElement} */ (profile.querySelector('.social-gallery__tile')).click();
            expect(modal_show).toHaveBeenCalledWith(
                'converse-image-modal',
                expect.objectContaining({ src: 'https://montague.lit/img/sunset.jpg' }),
                expect.anything(),
            );
        }),
    );

    it(
        'suppresses the "via" attribution inside a feed’s own profile',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            // A community feed with one post; it also surfaces in the timeline.
            const feed = await api.microblog.feeds.get('news.movim.eu', 'Phoronix', true);
            await feed.addItems([
                stx`
                <item id="p1" publisher="edhelas@movim.eu/atomtopubsub">
                  <entry xmlns="${ATOM}">
                    <title type="text">OpenCL 3.1 on Asahi</title>
                    <id>tag:news.movim.eu,2026:p1</id>
                    <published>2026-07-15T01:00:00Z</published>
                  </entry>
                </item>`.tree(),
            ]);

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            // In the aggregated timeline the post names its source feed.
            const via = await u.waitUntil(() => el.querySelector('converse-social-feed .social-post__via'));
            expect(via.textContent.trim()).toMatch(/via Phoronix on news\.movim\.eu/);

            // Follow the "via" link into that feed's own profile.
            via.click();
            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));
            await u.waitUntil(() =>
                Array.from(profile.querySelectorAll('.social-profile__posts .social-post__body')).some((n) =>
                    n.textContent.includes('OpenCL 3.1 on Asahi'),
                ),
            );

            // The post is listed, but the now-redundant "via" line is suppressed.
            expect(profile.querySelector('.social-post__via')).toBe(null);
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
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

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
        'browses a non-followed author without polluting the timeline, then follows without the list blanking',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            const stranger = 'yorick@denmark.lit';

            // The detached browse feed serves one post on its first backfill; every
            // later fetch (the shared feed created on follow, and its re-fetch)
            // returns empty. So the stranger's post only ever reaches the shared
            // feed by being *seeded* from the browse feed on follow, not re-fetched.
            const postItem = stx`
                <item id="y-1" publisher="${stranger}">
                  <entry xmlns="${ATOM}">
                    <title type="text">Poor Yorick</title>
                    <id>tag:denmark.lit,2024:posts-y-1</id>
                    <published>2024-01-03T10:00:00Z</published>
                    <updated>2024-01-03T10:00:00Z</updated>
                  </entry>
                </item>`.tree();
            let served = false;
            vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
            vi.spyOn(api.pubsub.items, 'get').mockImplementation((jid, node) => {
                // Only the browse feed's first microblog-node backfill serves the
                // post (not the repost's comment-summary fetch on the same JID).
                if (jid === stranger && node === MICROBLOG_NODE && !served) {
                    served = true;
                    return Promise.resolve({ items: [postItem] });
                }
                return Promise.resolve({ items: [] });
            });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

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

            // The browse feed's backfilled post is shown.
            const hasPost = () =>
                Array.from(profile.querySelectorAll('.social-profile__posts .social-post__body')).some((n) =>
                    n.textContent.includes('Poor Yorick'),
                );
            await u.waitUntil(hasPost);

            // A Follow button is shown; clicking it follows (creating their feed),
            // and the toggle flips to Unfollow.
            const follow_btn = await u.waitUntil(() => {
                const b = profile.querySelector('.social-profile__follow');
                return b && b.textContent.trim() === 'Follow' ? b : null;
            });
            follow_btn.click();
            // Wait until the follow settled (button re-enabled after setupFeed).
            await u.waitUntil(() => {
                const b = profile.querySelector('.social-profile__follow');
                return b && b.textContent.trim() === 'Unfollow' && !b.hasAttribute('disabled');
            });
            expect(api.microblog.isFollowing(stranger)).toBe(true);

            // Following swaps the browse feed for the shared (live) one; its posts
            // must stay visible (seeded) rather than the list blanking to re-fetch.
            expect(hasPost()).toBe(true);
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
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

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

    it(
        "renders an author's banner image in the profile header",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            const banner_url = 'https://uploads.example.org/banner.jpg';

            // The banner node yields a Movim-style avatar-metadata item; the feed
            // node stays empty.
            vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, node) => {
                if (node === 'urn:xmpp:movim-banner:0') {
                    return Promise.resolve({
                        items: [
                            stx`
                            <item id="b-1">
                              <metadata xmlns="urn:xmpp:avatar:metadata">
                                <info url="${banner_url}" width="1280" height="320" type="image/jpeg"/>
                              </metadata>
                            </item>`.tree(),
                        ],
                    });
                }
                return Promise.resolve({ items: [] });
            });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            // Open our own profile from a post.
            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Hello world'));
            const author = await u.waitUntil(() => el.querySelector('.social-post__author.show-msg-author-modal'));
            author.click();

            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));
            const img = await u.waitUntil(() => profile.querySelector('.social-profile__banner img'));
            expect(img.getAttribute('src')).toBe(banner_url);
            // The avatar overlaps the banner (the header gets the modifier class).
            expect(profile.querySelector('.social-profile__header--with-banner')).not.toBe(null);
        }),
    );

    it(
        'shows a logo watermark when the author has no banner',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            // Every node (banner + feed) is empty, so there's no banner image.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Hello world'));
            const author = await u.waitUntil(() => el.querySelector('.social-post__author.show-msg-author-modal'));
            author.click();

            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));
            // The banner still renders, as a Converse logo fallback, not an <img>.
            const banner = await u.waitUntil(() => profile.querySelector('.social-profile__banner--fallback'));
            expect(banner.querySelector('converse-logo')).not.toBe(null);
            expect(profile.querySelector('.social-profile__banner img')).toBe(null);
        }),
    );

    it(
        'falls back to the logo when the banner image fails to load',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;

            // The banner node advertises a URL that will 404 (dead link).
            vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, node) => {
                if (node === 'urn:xmpp:movim-banner:0') {
                    return Promise.resolve({
                        items: [
                            stx`
                            <item id="b-1">
                              <metadata xmlns="urn:xmpp:avatar:metadata">
                                <info url="http://127.0.0.1:1/missing.jpg" type="image/jpeg"/>
                              </metadata>
                            </item>`.tree(),
                        ],
                    });
                }
                return Promise.resolve({ items: [] });
            });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            receive(_converse, makePost(bare_jid, bare_jid, 'post-1', 'Hello world'));
            const author = await u.waitUntil(() => el.querySelector('.social-post__author.show-msg-author-modal'));
            author.click();

            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));
            const img = await u.waitUntil(() => profile.querySelector('.social-profile__banner img'));

            // Simulate the browser's load failure; the header swaps to the logo.
            img.dispatchEvent(new Event('error'));
            const fallback = await u.waitUntil(
                () => profile.querySelector('.social-profile__banner--fallback converse-logo'),
            );
            expect(fallback).not.toBe(null);
            expect(profile.querySelector('.social-profile__banner img')).toBe(null);
        }),
    );

    it(
        'remounts the profile when navigating from one author to another',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            const stranger = 'yorick@denmark.lit';
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            // An own plain post and an own repost of a stranger, both in our feed.
            receive(_converse, makePost(bare_jid, bare_jid, 'p-1', 'My own note', '2024-01-02T09:00:00Z'));
            receive(
                _converse,
                makeRepost(bare_jid, bare_jid, 'r-1', 'Alas', stranger, 'Yorick', '2024-01-01T09:00:00Z'),
            );
            await u.waitUntil(() => el.querySelectorAll('.social-post').length === 2);

            // Open our own profile via our plain post's author.
            const mine = Array.from(el.querySelectorAll('.social-post')).find((a) =>
                a.querySelector('.social-post__body').textContent.includes('My own note'),
            );
            mine.querySelector('a.social-post__author').click();

            // Generous timeout: a profile setup on the shared test page can exceed
            // the 2s default under intra-file load.
            const T = 5000;
            const profileA = await u.waitUntil(() => el.querySelector('converse-social-profile'), T);
            expect(profileA.jid).toBe(bare_jid);

            // Within our profile, the repost shows the stranger as author; click it.
            const repost = await u.waitUntil(
                () =>
                    Array.from(profileA.querySelectorAll('.social-profile__posts .social-post')).find((a) =>
                        a.querySelector('.social-post__body').textContent.includes('Alas'),
                    ),
                T,
            );
            repost.querySelector('a.social-post__author').click();

            // The profile is keyed on the JID, so navigating remounts it: a *new*
            // element for the stranger, not the previous author's element reused
            // (which would leave `this.profile`/`this.feed` stale on us).
            const profileB = await u.waitUntil(() => {
                const p = el.querySelector('converse-social-profile');
                return p && p !== profileA ? p : null;
            }, T);
            expect(profileB).not.toBe(profileA);
            expect(profileB.jid).toBe(stranger);
        }),
    );

    it(
        'opens a browse-only community feed asked for over the event bus',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            // The browse-only feed backfills via a pubsub items fetch; answer it
            // empty so the view settles.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            // The Discover modal renders in the modal portal (outside the app), so
            // a feed picked there reaches the app over the event bus, not by DOM
            // bubbling. We don't follow it, so it opens read-only.
            const service = 'pubsub.montague.lit';
            const node = 'news';
            expect(api.microblog.isFollowing(service, node)).toBe(false);
            api.trigger('openSocialFeed', { jid: service, node });

            const profile = await u.waitUntil(() => {
                const p = el.querySelector('converse-social-profile');
                return p && p.node === node ? p : null;
            });
            expect(profile.jid).toBe(service);
            // A non-microblog node opens in feed mode (no person-only chrome).
            expect(profile.isFeed).toBe(true);
        }),
    );

    it(
        "the profile 'more' menu messages and adds a non-contact author",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const stranger = 'yorick@denmark.lit';
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
            const open = vi.spyOn(api.chats, 'open').mockResolvedValue(undefined);
            const switchApp = vi.spyOn(api.apps, 'switch').mockImplementation(() => null);
            const modalShow = vi.spyOn(api.modal, 'show').mockResolvedValue(undefined);

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));
            el.onProfileSelected(stranger);
            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));

            // Message opens a 1:1 chat and switches to the Chat app.
            const msg = await u.waitUntil(() => profile.querySelector('.social-profile__message'));
            msg.click();
            await u.waitUntil(() => open.mock.calls.length > 0);
            expect(open).toHaveBeenCalledWith(stranger, {}, true);
            expect(switchApp).toHaveBeenCalledWith('chat');

            // A non-contact shows "Add to contacts", which opens the add modal.
            const add = profile.querySelector('.social-profile__add-contact');
            expect(add).not.toBe(null);
            add.click();
            expect(modalShow).toHaveBeenCalledWith(
                'converse-add-contact-modal',
                expect.objectContaining({ contact: expect.anything() }),
                expect.anything(),
            );
        }),
    );

    it(
        'hides "Add to contacts" for an author already in the roster',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));
            el.onProfileSelected('mercutio@montague.lit');
            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));

            // Message is still offered, but not "Add to contacts" (already a contact).
            await u.waitUntil(() => profile.querySelector('.social-profile__message'));
            expect(profile.querySelector('.social-profile__add-contact')).toBe(null);
        }),
    );

    it(
        'offers "Edit profile" (and no follow/message) on your own profile',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
            const modalShow = vi.spyOn(api.modal, 'show').mockResolvedValue(undefined);

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));
            el.onProfileSelected(bare_jid);
            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));

            const edit = await u.waitUntil(() => profile.querySelector('.social-profile__edit'));
            expect(profile.querySelector('.social-profile__follow')).toBe(null);
            expect(profile.querySelector('.social-profile__message')).toBe(null);

            edit.click();
            expect(modalShow).toHaveBeenCalledWith(
                'converse-profile-modal',
                expect.objectContaining({ tab: 'profile' }),
                expect.anything(),
            );
        }),
    );
});

describe('The Social app with URL routing enabled', function () {
    // Strip any fragment left by a prior test, without firing hashchange.
    const clearHash = () => history.replaceState(null, '', location.pathname + location.search);
    const stubNetwork = (api) => {
        vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
        vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
        vi.spyOn(api.pubsub, 'unsubscribe').mockResolvedValue(undefined);
    };

    it(
        'derives the view from the hash and updates it on hashchange',
        mock.initConverse(converse, [], { enable_url_routing: true }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            clearHash();
            stubNetwork(api);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            // Deep-link: the app mounts with a profile hash already set.
            location.hash = buildSocialRoute({ view: 'profile', jid: 'juliet@capulet.lit' });
            const el = mountSocialApp();
            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));
            expect(profile.getAttribute('jid')).toBe('juliet@capulet.lit');

            // hashchange back to the timeline.
            location.hash = buildSocialRoute({ view: 'timeline' });
            await u.waitUntil(() => el.querySelector('converse-social-feed'));

            // hashchange to a hashtag filter.
            location.hash = buildSocialRoute({ view: 'tag', tag: 'xmpp' });
            await u.waitUntil(() => el.querySelector('.social-feed__filter'));
            expect(el.textContent).toContain('xmpp');

            clearHash();
        }),
    );

    it(
        'writes the hash on forward navigation, and the back button returns to the timeline',
        mock.initConverse(converse, [], { enable_url_routing: true }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            const stranger = 'yorick@denmark.lit';
            clearHash();
            stubNetwork(api);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            location.hash = buildSocialRoute({ view: 'timeline' });
            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

            // A reposted post: clicking its author opens the (stranger) author's profile.
            receive(_converse, makeRepost(bare_jid, bare_jid, 'r1', 'Alas', stranger, 'Yorick'));
            const author = await u.waitUntil(() => el.querySelector('.social-post__author.show-msg-author-modal'));
            author.click();

            // The navigation is reflected in the hash and the profile view opens.
            await u.waitUntil(() => location.hash === buildSocialRoute({ view: 'profile', jid: stranger }));
            await u.waitUntil(() => el.querySelector('converse-social-profile'));

            // The profile's back button (history.back) returns to the timeline.
            el.querySelector('converse-social-profile').dispatchEvent(
                new CustomEvent('closeprofile', { bubbles: true, composed: true }),
            );
            await u.waitUntil(() => el.querySelector('converse-social-feed'));
            await u.waitUntil(() => location.hash === buildSocialRoute({ view: 'timeline' }));

            clearHash();
        }),
    );

    it(
        'resolves a deep-linked post from the URL via a targeted item fetch',
        mock.initConverse(converse, [], { enable_url_routing: true }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const feedJid = 'juliet@capulet.lit';
            const itemId = 'post-42';
            clearHash();
            stubNetwork(api);

            const itemsGet = vi.spyOn(api.pubsub.items, 'get').mockImplementation((_jid, _node, opts) => {
                if (opts?.item_ids?.includes(itemId)) {
                    return Promise.resolve({
                        items: [
                            stx`<item id="${itemId}" publisher="${feedJid}">
                                    <entry xmlns="${ATOM}">
                                        <title type="text">Deep linked post</title>
                                        <id>tag:capulet.lit,2024:posts-${itemId}</id>
                                        <published>2024-01-01T18:30:02Z</published>
                                    </entry>
                                </item>`.tree(),
                        ],
                    });
                }
                return Promise.resolve({ items: [] });
            });

            location.hash = buildSocialRoute({ view: 'post', feedJid, itemId });
            const el = mountSocialApp();

            const post = await u.waitUntil(() => el.querySelector('converse-social-post'));
            expect(post.textContent).toContain('Deep linked post');
            // The exact item was requested (not a newest-page fetch).
            expect(itemsGet).toHaveBeenCalledWith(feedJid, MICROBLOG_NODE, { item_ids: [itemId] });

            clearHash();
        }),
    );

    it(
        'falls back to the timeline when a deep-linked post cannot be resolved',
        mock.initConverse(converse, [], { enable_url_routing: true }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            clearHash();
            stubNetwork(api);
            // The item is never returned, so resolution misses.
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            location.hash = buildSocialRoute({ view: 'post', feedJid: 'juliet@capulet.lit', itemId: 'ghost' });
            const el = mountSocialApp();

            await u.waitUntil(() => el.querySelector('converse-social-feed'));
            // The dead entry is replaced with the timeline route.
            await u.waitUntil(() => location.hash === buildSocialRoute({ view: 'timeline' }));

            clearHash();
        }),
    );

    it(
        'does not touch the URL when routing is disabled (the default)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const bare_jid = _converse.bare_jid;
            const stranger = 'yorick@denmark.lit';
            clearHash();
            stubNetwork(api);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('.social-rich__editable'));

            receive(_converse, makeRepost(bare_jid, bare_jid, 'r1', 'Alas', stranger, 'Yorick'));
            const author = await u.waitUntil(() => el.querySelector('.social-post__author.show-msg-author-modal'));
            author.click();

            // In-memory navigation still works, but the URL stays untouched.
            await u.waitUntil(() => el.querySelector('converse-social-profile'));
            expect(location.hash).toBe('');
        }),
    );

    it(
        'routes app switches through the hash in fullscreen mode',
        mock.initConverse(
            converse,
            [],
            { enable_url_routing: true, view_mode: 'fullscreen' },
            async function (_converse) {
                await mock.waitForRoster(_converse, 'current', 0);
                const { api } = _converse;
                clearHash();

                expect(api.apps.get('chat')).toBeTruthy();
                expect(api.apps.get('social')).toBeTruthy();

                // Setting the social hash switches the active app to social.
                location.hash = '#converse/social';
                await u.waitUntil(() => api.apps.getActive().name === 'social');

                // A programmatic switch reflects back into the hash (replaceState),
                // and does not bounce back to social.
                api.apps.switch('chat');
                await u.waitUntil(() => location.hash === '#converse/chat');
                expect(api.apps.getActive().name).toBe('chat');

                clearHash();
            },
        ),
    );
});

describe('The profile Following tab', function () {
    /**
     * Stub the pubsub layer so `follow`/`unfollow` are no-ops that still mutate
     * the XEP-0330 mirror (`_converse.state.following`) and `pubsubfeeds`.
     * @param {any} api
     */
    function stubFollowPlumbing(api) {
        vi.spyOn(api.pubsub, 'publish').mockResolvedValue(undefined);
        vi.spyOn(api.pubsub, 'subscribe').mockResolvedValue(undefined);
        vi.spyOn(api.pubsub, 'unsubscribe').mockResolvedValue(undefined);
        vi.spyOn(api.pubsub, 'retract').mockResolvedValue(undefined);
        vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });
    }

    /**
     * Find a profile tab button by its label.
     * @param {Element} profile
     * @param {string} label
     * @returns {HTMLElement}
     */
    function tab(profile, label) {
        return /** @type {HTMLElement} */ (
            Array.from(profile.querySelectorAll('.social-profile__tab')).find((t) => t.textContent.includes(label))
        );
    }

    it(
        "opens your own profile's Following tab from the timeline, listing followed authors",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            stubDiscoverFollowable(api, []);
            stubFollowPlumbing(api);

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            // Following nobody: no entry point on the timeline.
            expect(el.querySelector('.social-feed__following-btn')).toBe(null);

            await api.microblog.follow('mercutio@montague.lit');
            await api.microblog.follow('juliet@capulet.lit');

            // The entry appears with a live count and opens your own profile on
            // the Following tab.
            const btn = await u.waitUntil(() => el.querySelector('.social-feed__following-btn'));
            expect(btn.querySelector('.social-feed__following-count').textContent.trim()).toBe('2');
            btn.click();

            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));
            expect(profile.getAttribute('jid')).toBe(_converse.bare_jid);
            const list = await u.waitUntil(() => profile.querySelector('converse-social-following'));
            await u.waitUntil(() => list.querySelectorAll('.social-following__item').length === 2);
            const jids = Array.from(list.querySelectorAll('.social-following__jid')).map((n) => n.textContent.trim());
            expect(jids).toContain('mercutio@montague.lit');
            expect(jids).toContain('juliet@capulet.lit');
            expect(tab(profile, 'Following').classList.contains('social-profile__tab--active')).toBe(true);
        }),
    );

    it(
        'switches between the Posts and Following tabs on a profile',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            stubDiscoverFollowable(api, []);
            stubFollowPlumbing(api);

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));
            await api.microblog.follow('mercutio@montague.lit');

            // Open your own profile (posts tab by default).
            /** @type {any} */ (el).onProfileSelected(_converse.bare_jid);
            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));
            expect(profile.querySelector('.social-profile__posts')).not.toBe(null);
            expect(profile.querySelector('converse-social-following')).toBe(null);

            // Switch to Following -> the list appears, posts area goes away.
            tab(profile, 'Following').click();
            await u.waitUntil(() => profile.querySelector('converse-social-following .social-following__item'));
            expect(profile.querySelector('.social-profile__posts')).toBe(null);

            // Switch back to Posts.
            tab(profile, 'Posts').click();
            await u.waitUntil(() => profile.querySelector('.social-profile__posts'));
            expect(profile.querySelector('converse-social-following')).toBe(null);
        }),
    );

    it(
        'unfollows an author from your profile Following tab',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            stubDiscoverFollowable(api, []);
            stubFollowPlumbing(api);

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));
            await api.microblog.follow('mercutio@montague.lit');

            const btn = await u.waitUntil(() => el.querySelector('.social-feed__following-btn'));
            btn.click();
            const list = await u.waitUntil(() => el.querySelector('converse-social-following'));
            const row = await u.waitUntil(() => list.querySelector('.social-following__item'));

            // Clicking Unfollow drops the row and clears the follow.
            row.querySelector('.social-following__unfollow').click();
            await u.waitUntil(() => list.querySelector('.social-following__item') === null);
            expect(api.microblog.isFollowing('mercutio@montague.lit')).toBe(false);
            expect(list.querySelector('.social-feed__empty')).not.toBe(null);
        }),
    );

    it(
        "opens a followed author's profile from the Following tab",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            stubDiscoverFollowable(api, []);
            stubFollowPlumbing(api);

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));
            await api.microblog.follow('mercutio@montague.lit');

            const btn = await u.waitUntil(() => el.querySelector('.social-feed__following-btn'));
            btn.click();
            const list = await u.waitUntil(() => el.querySelector('converse-social-following'));
            const row = await u.waitUntil(() => list.querySelector('.social-following__item'));

            // Clicking a row navigates to that author's profile on its Posts tab.
            row.click();
            await u.waitUntil(() => el.querySelector('converse-social-profile')?.getAttribute('jid') === 'mercutio@montague.lit');
            const profile = el.querySelector('converse-social-profile');
            expect(profile.querySelector('converse-social-following')).toBe(null);
            expect(profile.querySelector('.social-profile__posts')).not.toBe(null);
        }),
    );

    it(
        'shows an empty state when you follow nobody',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            stubDiscoverFollowable(api, []);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            // No timeline entry point; open your own profile Following tab directly.
            expect(el.querySelector('.social-feed__following-btn')).toBe(null);
            /** @type {any} */ (el).onProfileSelected(_converse.bare_jid, undefined, 'following');

            const list = await u.waitUntil(() => el.querySelector('converse-social-following'));
            const empty = await u.waitUntil(() => list.querySelector('.social-feed__empty'));
            expect(empty.textContent).toContain("aren't following anyone");
        }),
    );

    it(
        "browses who another account follows from their profile's Following tab",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;
            const contact = 'mercutio@montague.lit';

            // The contact follows two accounts; their list is readable.
            vi.spyOn(api.microblog, 'following').mockResolvedValue([
                { server: 'romeo@montague.lit', node: MICROBLOG_NODE },
                { server: 'juliet@capulet.lit', node: MICROBLOG_NODE },
            ]);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            /** @type {any} */ (el).onProfileSelected(contact);
            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile'));

            // The Following tab shows a count of 2; opening it lists them.
            const following_tab = await u.waitUntil(() => {
                const t = tab(profile, 'Following');
                return t?.querySelector('.social-profile__tab-count')?.textContent.trim() === '2' ? t : null;
            });
            following_tab.click();

            const list = await u.waitUntil(() => profile.querySelector('converse-social-following'));
            await u.waitUntil(() => list.querySelectorAll('.social-following__item').length === 2);
            // Another account's list is read-only (no Unfollow).
            expect(list.querySelector('.social-following__unfollow')).toBe(null);
            const jids = Array.from(list.querySelectorAll('.social-following__jid')).map((n) => n.textContent.trim());
            expect(jids).toContain('romeo@montague.lit');
            expect(jids).toContain('juliet@capulet.lit');
        }),
    );

    it(
        "shows a graceful notice when an author's follow list is refused",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;
            const forbidden = Object.assign(new Error('forbidden'), { name: 'forbidden' });
            vi.spyOn(api.microblog, 'following').mockRejectedValue(forbidden);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            // Open a stranger's profile Following tab directly; the read is refused.
            /** @type {any} */ (el).onProfileSelected('yorick@denmark.lit', undefined, 'following');
            const list = await u.waitUntil(() => el.querySelector('converse-social-following'));
            const notice = await u.waitUntil(() => list.querySelector('.social-following__unavailable'));
            expect(notice.textContent).toContain("can't see");
        }),
    );

    it(
        'labels a community feed by its title or node name, not the service JID',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            // Two feeds on one service: one with a title, one where the node name
            // is the human label (Movim leaves the title empty).
            vi.spyOn(api.microblog, 'following').mockResolvedValue([
                { server: 'alt.movim.eu', node: 'Fakir', title: undefined },
                { server: 'pubsub.movim.eu', node: 'comics', title: 'Comics' },
            ]);
            vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            /** @type {any} */ (el).onProfileSelected('somebody@movim.eu', undefined, 'following');
            const list = await u.waitUntil(() => el.querySelector('converse-social-following'));
            await u.waitUntil(() => list.querySelectorAll('.social-following__item').length === 2);

            // The main label is the title (else the node name), and the subtitle
            // is the service JID.
            const names = Array.from(list.querySelectorAll('.social-following__name')).map((n) => n.textContent.trim());
            expect(names).toContain('Fakir'); // node name, since the title is empty
            expect(names).toContain('Comics'); // the title
            const addresses = Array.from(list.querySelectorAll('.social-following__jid')).map((n) =>
                n.textContent.trim(),
            );
            expect(addresses).toContain('alt.movim.eu');
            expect(addresses).toContain('pubsub.movim.eu');
        }),
    );

    it(
        'opens a followed community feed in feed mode (its node, no person chrome)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const { api } = _converse;

            vi.spyOn(api.microblog, 'following').mockResolvedValue([
                { server: 'alt.movim.eu', node: 'Fakir', title: undefined },
            ]);
            const itemsGet = vi.spyOn(api.pubsub.items, 'get').mockResolvedValue({ items: [] });

            const el = mountSocialApp();
            await u.waitUntil(() => el.querySelector('converse-social-feed .social-rich__editable'));

            // Open an account's Following tab, then click the community feed row.
            /** @type {any} */ (el).onProfileSelected('somebody@movim.eu', undefined, 'following');
            const following = await u.waitUntil(() => el.querySelector('converse-social-following'));
            const row = await u.waitUntil(() => following.querySelector('.social-following__item'));
            row.click();

            // A feed-mode profile opens for the node itself, named by the node.
            const profile = await u.waitUntil(() => el.querySelector('converse-social-profile[node="Fakir"]'));
            expect(profile.getAttribute('jid')).toBe('alt.movim.eu');
            await u.waitUntil(() => profile.querySelector('.social-profile__name')?.textContent.trim() === 'Fakir');
            // No person chrome: no Posts/Following tabs, no message/add-contact menu.
            expect(profile.querySelector('.social-profile__tabs')).toBe(null);
            expect(profile.querySelector('.social-profile__menu')).toBe(null);
            // A Follow toggle is present and the feed is read from the Fakir node.
            expect(profile.querySelector('.social-profile__follow')).not.toBe(null);
            expect(itemsGet.mock.calls.some((c) => c[0] === 'alt.movim.eu' && c[1] === 'Fakir')).toBe(true);
        }),
    );
});
