import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

describe('A modal', function () {
    it(
        'no longer reacts to the Escape key once it has been removed',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const modal = await mock.openAddMUCModal(_converse);
            const close = vi.spyOn(modal, 'close');

            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(close).toHaveBeenCalledOnce();

            // Removed while still open, so it never got to mark itself as hidden.
            modal.ariaHidden = 'false';
            _converse.api.modal.remove('converse-add-muc-modal');
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(close).toHaveBeenCalledOnce();
        }),
    );
});
