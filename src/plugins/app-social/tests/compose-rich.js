import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

describe('The rich Social composer', function () {
    it(
        'uploads pasted files like a paperclip pick and lets text pastes through',
        mock.initConverse(converse, [], {}, async function () {
            await customElements.whenDefined('converse-social-compose-rich');
            const el = /** @type {any} */ (document.createElement('converse-social-compose-rich'));
            // Route uploads to a spy so the test never touches the network.
            const onAttach = vi.spyOn(el, 'onAttach').mockResolvedValue(undefined);

            // A file paste (e.g. a screenshot) is intercepted and routed to the upload flow,
            // and kept away from Lexical (preventDefault).
            const dt = new DataTransfer();
            dt.items.add(new File(['x'], 'shot.png', { type: 'image/png' }));
            const filePaste = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
            el.onPaste(filePaste);
            expect(filePaste.defaultPrevented).toBe(true);
            expect(onAttach).toHaveBeenCalledTimes(1);
            expect(onAttach.mock.calls[0][0]).toBe(dt.files);

            // A text-only paste carries no files, so it falls through to the editor untouched.
            onAttach.mockClear();
            const dt2 = new DataTransfer();
            dt2.setData('text/plain', 'hello');
            const textPaste = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt2 });
            el.onPaste(textPaste);
            expect(textPaste.defaultPrevented).toBe(false);
            expect(onAttach).not.toHaveBeenCalled();
        }),
    );
});
