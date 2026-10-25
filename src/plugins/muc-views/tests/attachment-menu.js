import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, stx, u } = converse.env;

const muc_jid = 'lounge@montague.lit';

/**
 * Answer the server's disco queries, advertising an HTTP File Upload service.
 */
async function confirmDisco(_converse) {
    const domain = _converse.session.get('domain');
    await mock.waitUntilDiscoConfirmed(
        _converse,
        domain,
        [{ category: 'server', type: 'IM' }],
        ['http://jabber.org/protocol/disco#items'],
        [],
        'info',
    );
    await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], ['upload.montague.tld'], 'items');
    await mock.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
}

describe('The attachment menu in a groupchat', function () {
    it(
        'opens from a paperclip in the groupchat colour and lists the same items as a one-to-one chat',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { visible_toolbar_buttons: { location: true } },
            async function (_converse) {
                await confirmDisco(_converse);
                await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                const view = _converse.chatboxviews.get(muc_jid);

                const menu = await mock.openAttachmentMenu(view);
                expect(mock.attachmentMenuItems(view)).toEqual(['Send a file', 'Send an image', 'Share your location']);

                const glyphs = Array.from(menu.querySelectorAll('converse-icon'));
                expect(glyphs.length).toBe(4);
                expect(glyphs.every((el) => el.getAttribute('color') === 'var(--muc-color)')).toBe(true);
            },
        ),
    );

    it(
        'sends a chosen file to the groupchat',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await confirmDisco(_converse);
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await mock.openAttachmentMenu(view);

            const input = view.querySelector('converse-attachment-menu input.fileupload');
            vi.spyOn(input, 'click').mockImplementation(() => {});
            view.querySelector('.attachment-menu__item[data-name="file"]').click();

            const data = new DataTransfer();
            data.items.add(new File(['hello'], 'hello.txt', { type: 'text/plain' }));
            input.files = data.files;
            input.dispatchEvent(new Event('change'));

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const iq = await u.waitUntil(() =>
                IQ_stanzas.find((iq) => iq.querySelector('iq[to="upload.montague.tld"] request')),
            );
            expect(iq.querySelector('request').getAttribute('filename')).toBe('hello.txt');
        }),
    );

    it(
        'is not offered to a visitor in a moderated room, who has no composer at all',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            await confirmDisco(_converse);
            const features = ['muc_moderated'];
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features, [], true, {}, 'member', 'visitor');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('.muc-bottom-panel--muted'));
            expect(view.querySelector('converse-attachment-menu')).toBeNull();
        }),
    );

    it(
        'lists an item added through the getAttachmentMenuItems hook, and runs its handler when picked',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const handler = vi.fn();
            _converse.api.listen.on('getAttachmentMenuItems', (menu, items) => {
                items.push({
                    name: 'test-item',
                    order: 150,
                    icon: 'fa-star',
                    label: 'Share a star',
                    handler: () => handler(menu.model.get('jid')),
                });
                return items;
            });
            await confirmDisco(_converse);
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);

            await mock.openAttachmentMenu(view);
            expect(mock.attachmentMenuItems(view)).toEqual(['Send a file', 'Share a star', 'Send an image']);
            view.querySelector('.attachment-menu__item[data-name="test-item"]').click();
            expect(handler).toHaveBeenCalledWith(muc_jid);
        }),
    );

    it(
        "is in the occupant sidebar's private message composer too, with the items that apply there",
        mock.initConverse(converse, ['chatBoxesFetched'], { view_mode: 'fullscreen' }, async function (_converse) {
            const room_jid = 'coven@chat.shakespeare.lit';
            await confirmDisco(_converse);
            await mock.openAndEnterMUC(_converse, room_jid, 'romeo');
            const view = _converse.chatboxviews.get(room_jid);

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<presence from="${room_jid}/firstwitch"
                            id="${u.getUniqueId()}"
                            to="${_converse.jid}"
                            xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <item affiliation="owner" role="moderator"/>
                        </x>
                    </presence>`,
                ),
            );
            if (view.model.get('hidden_occupants')) {
                view.model.save('hidden_occupants', false);
            }
            await u.waitUntil(() => view.querySelectorAll('.occupant-list converse-avatar').length === 2);
            view.querySelector('.occupant-list converse-avatar[name="firstwitch"]').click();

            const occupant_view = await u.waitUntil(() => view.querySelector('converse-muc-occupant'));
            await mock.openAttachmentMenu(occupant_view);
            expect(mock.attachmentMenuItems(occupant_view)).toEqual(['Send a file', 'Send an image']);

            const input = occupant_view.querySelector('converse-attachment-menu input.fileupload');
            vi.spyOn(input, 'click').mockImplementation(() => {});
            occupant_view.querySelector('.attachment-menu__item[data-name="file"]').click();

            const data = new DataTransfer();
            data.items.add(new File(['hello'], 'secret.txt', { type: 'text/plain' }));
            input.files = data.files;
            input.dispatchEvent(new Event('change'));

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const iq = await u.waitUntil(() =>
                IQ_stanzas.find((iq) => iq.querySelector('iq[to="upload.montague.tld"] request')),
            );
            expect(iq.querySelector('request').getAttribute('filename')).toBe('secret.txt');
        }),
    );
});
