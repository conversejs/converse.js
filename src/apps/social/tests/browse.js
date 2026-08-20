import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { buildSocialRoute } from '../routing.js';
import { mountSocialFeed, openDiscover } from './utils.js';

const { u } = converse.env;
const ATOM = 'http://www.w3.org/2005/Atom';
const SERVICE = 'pubsub.montague.lit';

const feed = (node, extra = {}) => ({ jid: SERVICE, node, type: ATOM, is_feed: true, probed: true, ...extra });

/** One page of two Atom feeds and one non-feed node, with no further pages. */
const ONE_PAGE = {
    feeds: [
        feed('news', { name: 'News', title: 'Town News', num_subscribers: 5 }),
        feed('weather', { title: 'Weather' }),
        { jid: SERVICE, node: 'avatars', is_feed: false, probed: true },
    ],
    cursor: null,
    has_more: false,
};

/**
 * Drive the browse control: type a service JID and click Browse (the caller has
 * stubbed `browseFeeds`), then wait for the list to render.
 * @param {Element} modal
 */
async function runBrowse(modal) {
    const browse = modal.querySelector('converse-social-browse');
    const input = browse.querySelector('input[name="service"]');
    input.value = SERVICE;
    input.dispatchEvent(new Event('input'));
    await u.waitUntil(() => !browse.querySelector('button[type="submit"]').disabled);
    browse.querySelector('button[type="submit"]').click();
    await u.waitUntil(() => browse.querySelector('.social-browse__list'));
    return browse;
}

describe('The Discover modal (browse a service)', function () {
    it(
        'lists the Atom feeds on a service and follows one by row',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            vi.spyOn(api.microblog, 'browseFeeds').mockResolvedValue(ONE_PAGE);
            const follow = vi.spyOn(api.microblog, 'follow').mockResolvedValue(/** @type {any} */ ({}));

            const el = mountSocialFeed();
            const modal = await openDiscover(el, api);
            const browse = await runBrowse(modal);

            // Only the two feeds show by default (the avatars node is hidden).
            const rows = browse.querySelectorAll('.social-browse__item');
            expect(rows.length).toBe(2);
            expect(browse.textContent).toMatch(/Town News/);
            expect(browse.textContent).toMatch(/Weather/);
            expect(browse.textContent).not.toMatch(/avatars/);
            // A single page, so no "Load more".
            expect(browse.querySelector('.social-browse__more')).toBe(null);

            // Follow the first feed → follow(jid, { node, title }).
            rows[0].querySelector('button').click();
            await u.waitUntil(() => follow.mock.calls.length === 1);
            expect(follow).toHaveBeenCalledWith(SERVICE, { node: 'news', title: 'Town News' });
        }),
    );

    it(
        'reveals the service’s non-feed nodes on demand',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            vi.spyOn(api.microblog, 'browseFeeds').mockResolvedValue(ONE_PAGE);

            const el = mountSocialFeed();
            const modal = await openDiscover(el, api);
            const browse = await runBrowse(modal);

            const toggle = browse.querySelector('.social-browse__toggle');
            expect(toggle.textContent).toMatch(/1 other node/i);
            toggle.click();

            await u.waitUntil(() => browse.querySelectorAll('.social-browse__item').length === 3);
            expect(browse.textContent).toMatch(/avatars/);
        }),
    );

    it(
        'pages the result set with a "Load more" button',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            // Page 1 has more; page 2 (fetched with the cursor) ends the set.
            vi.spyOn(api.microblog, 'browseFeeds').mockImplementation((_jid, opts) => {
                if (!opts?.after) {
                    return Promise.resolve({ feeds: [feed('news', { title: 'News' })], cursor: 'c1', has_more: true });
                }
                return Promise.resolve({ feeds: [feed('sport', { title: 'Sport' })], cursor: 'c2', has_more: false });
            });

            const el = mountSocialFeed();
            const modal = await openDiscover(el, api);
            const browse = await runBrowse(modal);

            expect(browse.querySelectorAll('.social-browse__item').length).toBe(1);
            const more = browse.querySelector('.social-browse__more');
            expect(more).not.toBe(null);

            more.click();
            await u.waitUntil(() => browse.querySelectorAll('.social-browse__item').length === 2);
            expect(browse.textContent).toMatch(/Sport/);
            // The set is exhausted, so the button is gone.
            expect(browse.querySelector('.social-browse__more')).toBe(null);
        }),
    );

    it(
        'skips past feed-less pages so a browse click surfaces feeds',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            // The first page is all comment nodes (no feeds) but the set continues;
            // the component should page through to the feed-bearing page on one click.
            const browseFeeds = vi.spyOn(api.microblog, 'browseFeeds').mockImplementation((_jid, opts) => {
                if (!opts?.after) return Promise.resolve({ feeds: [], cursor: 'c1', has_more: true });
                return Promise.resolve({ feeds: [feed('news', { title: 'News' })], cursor: 'c2', has_more: false });
            });

            const el = mountSocialFeed();
            const modal = await openDiscover(el, api);
            const browse = await runBrowse(modal);

            expect(browse.querySelectorAll('.social-browse__item').length).toBe(1);
            expect(browse.textContent).toMatch(/News/);
            expect(browseFeeds).toHaveBeenCalledTimes(2); // skipped the empty page
            expect(browse.querySelector('.social-browse__more')).toBe(null);
        }),
    );

    it(
        'shows an error when the service can’t be browsed',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            vi.spyOn(api.microblog, 'browseFeeds').mockRejectedValue(
                Object.assign(new Error('nope'), { name: 'InvalidFeedAddress' }),
            );

            const el = mountSocialFeed();
            const modal = await openDiscover(el, api);
            const browse = modal.querySelector('converse-social-browse');
            const input = browse.querySelector('input[name="service"]');
            input.value = 'notajid';
            input.dispatchEvent(new Event('input'));
            await u.waitUntil(() => !browse.querySelector('button[type="submit"]').disabled);
            browse.querySelector('button[type="submit"]').click();

            const err = await u.waitUntil(() => browse.querySelector('.social-browse__error'));
            expect(err.textContent).toMatch(/valid service address/i);
        }),
    );

    it(
        'opens a browsed feed in a read-only view when its row is clicked',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            vi.spyOn(api.microblog, 'browseFeeds').mockResolvedValue(ONE_PAGE);
            vi.spyOn(api.microblog, 'follow').mockResolvedValue(/** @type {any} */ ({}));

            const el = mountSocialFeed();
            const modal = await openDiscover(el, api);
            const browse = await runBrowse(modal);

            // The Social app (mounted elsewhere) picks the choice up over the
            // event bus, since the modal renders in the modal portal outside it.
            const opened = [];
            const handler = (/** @type {any} */ d) => opened.push(d);
            api.listen.on('openSocialFeed', handler);
            const hide = vi.spyOn(modal.modal, 'hide').mockImplementation(() => {});

            const item = browse.querySelector('.social-browse__item');

            // Clicking the Follow button follows the feed; it is not navigation.
            item.querySelector('button').click();
            expect(opened).toEqual([]);

            // Clicking the info area opens the feed's browse-only view and closes
            // the modal, without following it.
            item.querySelector('.social-browse__info').click();
            await u.waitUntil(() => opened.length === 1);
            expect(opened[0]).toEqual({ jid: SERVICE, node: 'news' });
            expect(hide).toHaveBeenCalled();

            api.listen.not('openSocialFeed', handler);
        }),
    );

    it(
        'renders each row as a link so it can be opened in a new tab (URL routing on)',
        mock.initConverse(converse, [], { enable_url_routing: true }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            vi.spyOn(api.microblog, 'browseFeeds').mockResolvedValue(ONE_PAGE);

            const el = mountSocialFeed();
            const modal = await openDiscover(el, api);
            const browse = await runBrowse(modal);

            // Each row is a real link to the feed's deep-link route, so the browser
            // can middle-/⌘-click it into a new tab (which restores the feed).
            const link = browse.querySelector('.social-browse__item .social-browse__info');
            expect(link.tagName).toBe('A');
            expect(link.getAttribute('href')).toBe(
                buildSocialRoute({ view: 'profile', jid: SERVICE, node: 'news' }),
            );

            // A modifier/middle click is left for the browser (new tab); it must not
            // navigate in place (no `feedselected` dispatched).
            let dispatched = 0;
            browse.addEventListener('feedselected', () => (dispatched += 1));
            const target = { jid: SERVICE, node: 'news' };
            browse.openFeed(target, /** @type {any} */ ({ metaKey: true, preventDefault() {} }));
            browse.openFeed(target, /** @type {any} */ ({ ctrlKey: true, preventDefault() {} }));
            browse.openFeed(target, /** @type {any} */ ({ button: 1, preventDefault() {} }));
            expect(dispatched).toBe(0);

            // A plain click still opens the feed in place, bridged over the bus.
            const opened = [];
            const handler = (/** @type {any} */ d) => opened.push(d);
            api.listen.on('openSocialFeed', handler);
            vi.spyOn(modal.modal, 'hide').mockImplementation(() => {});
            link.click();
            await u.waitUntil(() => opened.length === 1);
            expect(opened[0]).toEqual({ jid: SERVICE, node: 'news' });

            api.listen.not('openSocialFeed', handler);
        }),
    );
});
