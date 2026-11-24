import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('A modal', function () {
    it(
        'no longer reacts to the Escape key once it has been removed',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const modal = await mock.openAddMUCModal(_converse);
            const close = vi.spyOn(modal, 'close');

            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(close).toHaveBeenCalledOnce();

            // Closing it removed it. Mark it as shown again, so that a listener
            // left behind would call close() a second time.
            expect(modal.isConnected).toBe(false);
            modal.ariaHidden = 'false';
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(close).toHaveBeenCalledOnce();
        }),
    );

    it(
        'is closed and removed when the user logs out',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const modal = await mock.openAddMUCModal(_converse);
            await _converse.api.user.logout();
            await u.waitUntil(() => !modal.isConnected);
            expect(document.body.classList.contains('modal-open')).toBe(false);
        }),
    );
});

describe('A confirm modal', function () {
    it(
        'is not confirmed by an Enter key outside of it',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const result = _converse.api.confirm('Are you sure?');
            const modal = await u.waitUntil(() => document.querySelector('converse-confirm-modal'));
            await u.waitUntil(() => modal.ariaHidden === 'false');

            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(await result).toBe(false);
        }),
    );
});
