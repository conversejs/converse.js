import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { stx, u } = converse.env;

const settings = { 'view_mode': 'fullscreen', 'visible_toolbar_buttons': { 'location': true } };

/**
 * The server answers disco without an upload service, so location is the only attachment.
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
    await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], [], 'items');
}

describe('The location attachment', function () {
    it(
        'shows a confirmation prompt and sends the geo URI as a message in a MUC',
        mock.initConverse(converse, ['discoInitialized'], settings, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success) => {
                success({ coords: { latitude: 51.5074, longitude: -0.1278 } });
            });

            await confirmDisco(_converse);
            await mock.openAndEnterMUC(_converse, muc_jid, nick);
            const view = _converse.chatboxviews.get(muc_jid);

            await mock.openAttachmentMenu(view);
            expect(mock.attachmentMenuItems(view)).toEqual(['Share your location']);
            view.querySelector('.attachment-menu__item[data-name="location"]').click();

            await u.waitUntil(() => _converse.api.confirm.calls.count() === 1);
            expect(_converse.api.confirm).toHaveBeenCalledWith('Confirm', [
                "Are you sure you'd like to share your location in the chat?",
            ]);

            await u.waitUntil(
                () => _converse.api.connection.get().sent_stanzas.filter((s) => s.nodeName === 'message').length,
            );

            const sent = _converse.api.connection
                .get()
                .sent_stanzas.filter((s) => s.nodeName === 'message')
                .pop();
            expect(sent.querySelector('body').textContent).toBe('geo:51.507400,-0.127800');
        }),
    );

    it(
        'shows a confirmation prompt and sends the geo URI in a MUC private message',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const muc_jid = 'coven@chat.shakespeare.lit';
            const nick = 'romeo';

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success) => {
                success({ coords: { latitude: 40.7128, longitude: -74.006 } });
            });

            await confirmDisco(_converse);
            await mock.openAndEnterMUC(_converse, muc_jid, nick);
            const view = _converse.chatboxviews.get(muc_jid);

            // Simulate another occupant joining
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                    <presence
                        from="${muc_jid}/firstwitch"
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
                // Happens in headless chrme
                view.model.save('hidden_occupants', false);
            }
            await u.waitUntil(() => view.querySelectorAll('.occupant-list converse-avatar').length === 2);

            // Click the occupant avatar to open the PM panel in the sidebar
            view.querySelector('.occupant-list converse-avatar[name="firstwitch"]').click();

            // The occupant panel has a composer of its own, with its own attachment menu.
            const occupant_view = await u.waitUntil(() => view.querySelector('converse-muc-occupant'));
            await mock.openAttachmentMenu(occupant_view);
            expect(mock.attachmentMenuItems(occupant_view)).toEqual(['Share your location']);
            occupant_view.querySelector('.attachment-menu__item[data-name="location"]').click();

            await u.waitUntil(() => _converse.api.confirm.calls.count() === 1);
            expect(_converse.api.confirm).toHaveBeenCalledWith('Confirm', [
                "Are you sure you'd like to share your location in the chat?",
            ]);

            await u.waitUntil(
                () => _converse.api.connection.get().sent_stanzas.filter((s) => s.nodeName === 'message').length,
            );

            const sent = _converse.api.connection
                .get()
                .sent_stanzas.filter((s) => s.nodeName === 'message')
                .pop();
            expect(sent.querySelector('body').textContent).toBe('geo:40.712800,-74.006000');
        }),
    );
});
