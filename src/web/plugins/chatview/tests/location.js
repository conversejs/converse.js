import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

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
        'shows a confirmation prompt and sends the geo URI in a one-on-one chat',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            await confirmDisco(_converse);
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);

            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success) => {
                success({ coords: { latitude: 51.5074, longitude: -0.1278 } });
            });

            await mock.openAttachmentMenu(view);
            expect(mock.attachmentMenuItems(view)).toEqual(['Share your location']);
            view.querySelector('.attachment-menu__item[data-name="location"]').click();

            await u.waitUntil(() => _converse.api.confirm.calls.count() === 1);
            expect(_converse.api.confirm).toHaveBeenCalledWith('Confirm', [
                "Are you sure you'd like to share your location in the chat?",
            ]);

            await u.waitUntil(
                () =>
                    _converse.api.connection
                        .get()
                        .sent_stanzas.filter((s) => s.nodeName === 'message' && s.querySelector('body')).length,
            );

            const sent = _converse.api.connection
                .get()
                .sent_stanzas.filter((s) => s.nodeName === 'message' && s.querySelector('body'))
                .pop();
            expect(sent.querySelector('body').textContent).toBe('geo:51.507400,-0.127800');
        }),
    );

    it(
        'sends nothing when the confirmation is declined',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            await confirmDisco(_converse);
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(false));
            spyOn(navigator.geolocation, 'getCurrentPosition');

            await mock.openAttachmentMenu(view);
            view.querySelector('.attachment-menu__item[data-name="location"]').click();

            await u.waitUntil(() => _converse.api.confirm.calls.count() === 1);
            expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
        }),
    );

    it(
        'ignores a second pick while the position is still being fetched',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            await confirmDisco(_converse);
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            // The position request hangs until the test answers it.
            let answer;
            spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success) => {
                answer = () => success({ coords: { latitude: 51.5074, longitude: -0.1278 } });
            });

            const pickLocation = async () => {
                await mock.openAttachmentMenu(view);
                view.querySelector('.attachment-menu__item[data-name="location"]').click();
            };
            const sentBodies = () =>
                _converse.api.connection
                    .get()
                    .sent_stanzas.filter((s) => s.nodeName === 'message' && s.querySelector('body'));

            await pickLocation();
            await u.waitUntil(() => navigator.geolocation.getCurrentPosition.calls.count() === 1);

            // Picked again while the first request is still running: nothing happens.
            await pickLocation();
            expect(_converse.api.confirm.calls.count()).toBe(1);
            expect(navigator.geolocation.getCurrentPosition.calls.count()).toBe(1);

            answer();
            await u.waitUntil(() => sentBodies().length === 1);
            expect(sentBodies()[0].querySelector('body').textContent).toBe('geo:51.507400,-0.127800');

            // Once the first request is answered, the next pick asks again.
            await pickLocation();
            await u.waitUntil(() => _converse.api.confirm.calls.count() === 2);
            expect(navigator.geolocation.getCurrentPosition.calls.count()).toBe(2);
        }),
    );

    it(
        'shows an error when the position cannot be determined',
        mock.initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            await confirmDisco(_converse);
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            spyOn(_converse.api, 'alert');
            spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((_success, error) => {
                error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
            });

            await mock.openAttachmentMenu(view);
            view.querySelector('.attachment-menu__item[data-name="location"]').click();

            await u.waitUntil(() => _converse.api.alert.calls.count() === 1);
            expect(_converse.api.alert).toHaveBeenCalledWith('error', 'Location Error', [
                'Location access was denied. Please allow location permissions in your browser settings and try again.',
            ]);
        }),
    );
});
