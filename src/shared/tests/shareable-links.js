import { vi } from 'vitest';
import mock from './mock.js';
import converse from '../../../dist/converse.js';

const { u } = converse.env;

async function openProfileModal(_converse) {
    await mock.openControlBox(_converse);
    _converse.chatboxviews.get('controlbox').querySelector('.change-status').click();
    const modal = _converse.api.modal.get('converse-profile-modal');
    await u.waitUntil(() => u.isVisible(modal), 1000);
    return modal;
}

describe('Shareable invitation links', function () {
    it(
        'are offered for our own address in the profile modal',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const modal = await openProfileModal(_converse);
            const el = await u.waitUntil(() => modal.querySelector('.shareable-link'));
            expect(el.textContent.trim()).toBe('https://chat.conversejs.org/#romeo@montague.lit');
            const a = el.querySelector('a');
            expect(a.href).toBe('https://chat.conversejs.org/#romeo@montague.lit');
            expect(a.target).toBe('_blank');
            expect(el.querySelector('converse-copy-button').text).toBe(
                'https://chat.conversejs.org/#romeo@montague.lit',
            );
        }),
    );

    it(
        'point at the page set in shareable_link_url',
        mock.initConverse(
            converse,
            [],
            { shareable_link_url: 'https://chat.example.org/converse/' },
            async function (_converse) {
                const modal = await openProfileModal(_converse);
                const el = await u.waitUntil(() => modal.querySelector('.shareable-link'));
                expect(el.textContent.trim()).toBe('https://chat.example.org/converse/#romeo@montague.lit');
            },
        ),
    );

    it(
        "are offered for a contact's address in the user details modal",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            view.querySelector('.show-msg-author-modal').click();
            const modal = _converse.api.modal.get('converse-user-details-modal');
            await u.waitUntil(() => u.isVisible(modal));

            const el = await u.waitUntil(() => modal.querySelector('.shareable-link'));
            expect(el.querySelector('converse-copy-button').text).toBe(`https://chat.conversejs.org/#${contact_jid}`);
        }),
    );

    it(
        'can be handed to the OS share sheet where the browser supports it',
        mock.initConverse(converse, [], {}, async function (_converse) {
            const share = vi.fn().mockResolvedValue(undefined);
            vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { share }));

            const modal = await openProfileModal(_converse);
            const button = await u.waitUntil(() => modal.querySelector('.shareable-link .share-button'));
            button.click();
            expect(share).toHaveBeenCalledWith({ url: 'https://chat.conversejs.org/#romeo@montague.lit' });
            vi.unstubAllGlobals();
        }),
    );

    it(
        'offer no share button where the browser has no Web Share API',
        mock.initConverse(converse, [], {}, async function (_converse) {
            vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { share: undefined }));
            const modal = await openProfileModal(_converse);
            await u.waitUntil(() => modal.querySelector('.shareable-link'));
            expect(modal.querySelector('.shareable-link .share-button')).toBeNull();
            vi.unstubAllGlobals();
        }),
    );

    it(
        'are not offered when shareable_link_url is empty',
        mock.initConverse(converse, [], { shareable_link_url: '' }, async function (_converse) {
            const modal = await openProfileModal(_converse);
            await u.waitUntil(() => modal.querySelector('.profile-property converse-copy-button'));
            expect(modal.querySelector('.shareable-link')).toBeNull();
        }),
    );
});
