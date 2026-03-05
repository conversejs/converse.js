/*global mock, converse */

const { stx, u } = converse.env;

describe('The Location Button', function () {
    it(
        'shows a confirmation prompt and sends the geo URI as a message in a MUC',
        mock.initConverse(['discoInitialized'], { 'view_mode': 'fullscreen' }, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success) => {
                success({ coords: { latitude: 51.5074, longitude: -0.1278 } });
            });

            await mock.openAndEnterMUC(_converse, muc_jid, nick);
            const view = _converse.chatboxviews.get(muc_jid);
            const toolbar = view.querySelector('.chat-toolbar');

            const location_button = toolbar.querySelector('converse-location-button');
            expect(location_button).not.toBeNull();

            const button = location_button.querySelector('.toggle-location');
            button.click();

            await u.waitUntil(() => _converse.api.confirm.calls.count() === 1);
            expect(_converse.api.confirm).toHaveBeenCalledWith('Confirm', [
                "Are you sure you'd like to share your location in the chat?",
            ]);

            await u.waitUntil(
                () => _converse.api.connection.get().sent_stanzas.filter((s) => s.nodeName === 'message').length
            );

            const sent = _converse.api.connection
                .get()
                .sent_stanzas.filter((s) => s.nodeName === 'message')
                .pop();
            expect(sent.querySelector('body').textContent).toBe('geo:51.507400,-0.127800');
        })
    );

    it(
        'shows a confirmation prompt and sends the geo URI in a MUC private message',
        mock.initConverse(['chatBoxesFetched'], { 'view_mode': 'fullscreen' }, async function (_converse) {
            const muc_jid = 'coven@chat.shakespeare.lit';
            const nick = 'romeo';

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success) => {
                success({ coords: { latitude: 40.7128, longitude: -74.006 } });
            });

            await mock.openAndEnterMUC(_converse, muc_jid, nick);
            const view = _converse.chatboxviews.get(muc_jid);

            // Simulate another occupant joining
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
                    <presence
                        from="${muc_jid}/firstwitch"
                        id="${u.getUniqueId()}"
                        to="${_converse.jid}"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="owner" role="moderator"/>
                    </x>
                    </presence>`)
            );
            await u.waitUntil(() => view.querySelectorAll('.occupant-list converse-avatar').length === 2);

            // Click the occupant avatar to open the PM panel in the sidebar
            view.querySelector('.occupant-list converse-avatar[name="firstwitch"]').click();

            // Wait for the occupant panel to render with toolbar
            const location_button = await u.waitUntil(() =>
                view.querySelector('converse-muc-occupant converse-location-button')
            );
            expect(location_button).not.toBeNull();

            const button = location_button.querySelector('.toggle-location');
            button.click();

            await u.waitUntil(() => _converse.api.confirm.calls.count() === 1);
            expect(_converse.api.confirm).toHaveBeenCalledWith('Confirm', [
                "Are you sure you'd like to share your location in the chat?",
            ]);

            await u.waitUntil(
                () => _converse.api.connection.get().sent_stanzas.filter((s) => s.nodeName === 'message').length
            );

            const sent = _converse.api.connection
                .get()
                .sent_stanzas.filter((s) => s.nodeName === 'message')
                .pop();
            expect(sent.querySelector('body').textContent).toBe('geo:40.712800,-74.006000');
        })
    );
});
