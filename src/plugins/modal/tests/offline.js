import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('A modal that needs a connection', function () {
    it(
        'says so while there is none, and does nothing until then',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const modal = await mock.openAddMUCModal(_converse);
            expect(modal.querySelector('.modal-body .alert')).toBeNull();

            const reconnect = mock.dropConnection(_converse);
            const alert = await u.waitUntil(() => modal.querySelector('.modal-body .alert-warning'));
            expect(alert.textContent).toBe(
                'You are offline. This needs a connection, so it has to wait until you are connected again.',
            );

            modal.querySelector('input[name="chatroom"]').value = 'lounge@muc.montague.lit';
            modal.querySelector('form input[type="submit"]').click();
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(_converse.state.chatboxes.get('lounge@muc.montague.lit')).toBeUndefined();
            expect(u.isVisible(modal)).toBe(true);

            await reconnect();
            await u.waitUntil(() => !modal.querySelector('.modal-body .alert-warning'));
        }),
    );

    it(
        'only says so for what needs one',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.openControlBox(_converse);
            mock.dropConnection(_converse);
            _converse.chatboxviews.get('controlbox').querySelector('.change-status').click();
            const modal = _converse.api.modal.get('converse-profile-modal');
            await u.waitUntil(() => u.isVisible(modal));

            // The status is sent once connected.
            modal.querySelector('label[for="radio-busy"]').click();
            modal.querySelector('[type="submit"]').click();
            await u.waitUntil(() => _converse.state.profile.get('show') === 'dnd');
            expect(modal.querySelector('.modal-body .alert-warning')).toBeNull();

            modal.querySelector('#profile-tab').click();
            await u.waitUntil(() => modal.querySelector('.modal-body .alert-warning'));
        }),
    );
});
