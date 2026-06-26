import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/**
 * The roster JID for one of the standard "current" mock contacts.
 * @param {number} i
 */
const contactJID = (i) => mock.cur_names[i].replace(/ /g, '.').toLowerCase() + '@montague.lit';

describe('The roster Follow toggle', function () {
    it(
        'is shown only for contacts that advertise a social feed (XEP-0472)',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;
            const followable = contactJID(0);
            const plain = contactJID(1);

            // Resolve "has a social feed" before the contact views initialize.
            vi.spyOn(api.microblog, 'canFollow').mockImplementation(async (jid) => jid === followable);
            vi.spyOn(api.microblog, 'isFollowing').mockReturnValue(false);

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');
            const roster_el = document.querySelector('converse-roster');

            // The followable contact gets a Follow toggle (appears once canFollow resolves).
            const follow_btn = await u.waitUntil(() =>
                roster_el.querySelector(`[data-jid="${followable}"]`)?.closest('li')?.querySelector('.follow-xmpp-contact'),
            );
            expect(follow_btn.textContent.trim()).toBe('Follow');

            // ...by which point every contact view's updateFollowable has run, so the
            // contact without a social feed has no toggle.
            const plain_li = roster_el.querySelector(`[data-jid="${plain}"]`)?.closest('li');
            expect(plain_li.querySelector('.follow-xmpp-contact')).toBe(null);
        }),
    );

    it(
        'follows on click and reflects the unfollow state',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const { api } = _converse;
            const jid = contactJID(0);

            vi.spyOn(api.microblog, 'canFollow').mockResolvedValue(true);
            const is_following = vi.spyOn(api.microblog, 'isFollowing').mockReturnValue(false);
            const follow = vi.spyOn(api.microblog, 'follow').mockResolvedValue(undefined);
            const unfollow = vi.spyOn(api.microblog, 'unfollow').mockResolvedValue(undefined);

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');
            const roster_el = document.querySelector('converse-roster');

            const li = () => roster_el.querySelector(`[data-jid="${jid}"]`).closest('li');
            const follow_btn = await u.waitUntil(() => li().querySelector('.follow-xmpp-contact'));
            expect(follow_btn.textContent.trim()).toBe('Follow');

            // Clicking follows the contact.
            follow_btn.click();
            await u.waitUntil(() => follow.mock.calls.length === 1);
            expect(follow).toHaveBeenCalledWith(jid);

            // Once following, the toggle re-renders as Unfollow and calls unfollow.
            is_following.mockReturnValue(true);
            const unfollow_btn = await u.waitUntil(() => {
                const b = li().querySelector('.follow-xmpp-contact');
                return b?.textContent.trim() === 'Unfollow' ? b : null;
            });
            unfollow_btn.click();
            await u.waitUntil(() => unfollow.mock.calls.length === 1);
            expect(unfollow).toHaveBeenCalledWith(jid);
        }),
    );
});
