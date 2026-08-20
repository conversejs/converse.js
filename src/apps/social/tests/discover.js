import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { mountSocialFeed, openDiscover } from './utils.js';

const { u } = converse.env;

describe('The Discover modal (follow a feed by address)', function () {
    it(
        'follows a feed by address, passing the parsed address and optional name',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            const el = mountSocialFeed();
            const modal = await openDiscover(el, api);
            const address = modal.querySelector('input[name="address"]');

            // The follow button stays disabled until the address parses.
            const submit = modal.querySelector('.converse-form button[type="submit"]');
            expect(submit.disabled).toBe(true);

            const spy = vi.spyOn(api.microblog, 'followByAddress').mockResolvedValue(/** @type {any} */ ({}));

            address.value = 'xmpp:pubsub.montague.lit?;node=news';
            address.dispatchEvent(new Event('input'));
            await u.waitUntil(() => !modal.querySelector('.converse-form button[type="submit"]').disabled);

            modal.querySelector('input[name="title"]').value = 'Town News';
            modal.querySelector('.converse-form button[type="submit"]').click();

            await u.waitUntil(() => spy.mock.calls.length === 1);
            expect(spy).toHaveBeenCalledWith('xmpp:pubsub.montague.lit?;node=news', {
                node: undefined,
                title: 'Town News',
            });
        }),
    );

    it(
        'shows an inline error and does not close when the feed is unreadable',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 0);
            const { api } = _converse;

            const el = mountSocialFeed();
            const modal = await openDiscover(el, api);
            const address = modal.querySelector('input[name="address"]');

            // followByAddress rejects with the `FeedNotFound` code for a node with
            // no readable feed.
            vi.spyOn(api.microblog, 'followByAddress').mockRejectedValue(
                Object.assign(new Error('nope'), { name: 'FeedNotFound' }),
            );

            address.value = 'pubsub.montague.lit';
            address.dispatchEvent(new Event('input'));
            await u.waitUntil(() => !modal.querySelector('.converse-form button[type="submit"]').disabled);
            modal.querySelector('.converse-form button[type="submit"]').click();

            const alert = await u.waitUntil(() => modal.querySelector('.alert-danger'));
            expect(alert.textContent).toMatch(/no feed found/i);
        }),
    );
});
