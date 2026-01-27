/*global mock, converse */

const { u } = converse.env;

describe('The Location Button', function () {
    it(
        'shows a confirmation prompt and sends the geo URI in a one-on-one chat',
        mock.initConverse(['chatBoxesFetched'], { 'view_mode': 'fullscreen' }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success) => {
                success({ coords: { latitude: 51.5074, longitude: -0.1278 } });
            });

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
                () =>
                    _converse.api.connection
                        .get()
                        .sent_stanzas.filter((s) => s.nodeName === 'message' && s.querySelector('body')).length
            );

            const sent = _converse.api.connection
                .get()
                .sent_stanzas.filter((s) => s.nodeName === 'message' && s.querySelector('body'))
                .pop();
            expect(sent.querySelector('body').textContent).toBe('geo:51.507400,-0.127800');
        })
    );
});
