import { describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

/** A minimal fake KeyboardEvent carrying the spies onEditorKeyDown asserts on. */
function keyEvent(key) {
    return { key, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
}

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

    it(
        'builds a ranked emoji shortname menu from the caret trigger query',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await _converse.api.emojis.initialize();
            await customElements.whenDefined('converse-social-compose-rich');
            const el = /** @type {any} */ (document.createElement('converse-social-compose-rich'));

            // Stub the editor handle to report a `:smile` trigger under the caret.
            el._handle = { getEmojiQuery: () => 'smile', replaceEmojiTrigger: vi.fn(), focus: vi.fn() };

            await el.updateEmojiTypeahead();

            expect(el._emoji_suggestions.length).toBeGreaterThan(0);
            expect(el._emoji_suggestions.length).toBeLessThanOrEqual(8);
            // Every suggestion matches the query and carries a resolved glyph (not the shortname).
            for (const s of el._emoji_suggestions) {
                expect(s.sn.includes('smile')).toBe(true);
                expect(s.glyph).toBeTruthy();
                expect(s.glyph).not.toBe(s.sn);
            }
            // The exact prefix match ranks first.
            expect(el._emoji_suggestions[0].sn).toBe(':smile:');

            // When the caret moves off any trigger, the menu closes.
            el._handle.getEmojiQuery = () => null;
            await el.updateEmojiTypeahead();
            expect(el._emoji_suggestions.length).toBe(0);
        }),
    );

    it(
        'navigates the emoji menu by keyboard and inserts the chosen glyph',
        mock.initConverse(converse, [], {}, async function () {
            await customElements.whenDefined('converse-social-compose-rich');
            const el = /** @type {any} */ (document.createElement('converse-social-compose-rich'));
            const replaceEmojiTrigger = vi.fn();
            el._handle = { replaceEmojiTrigger, focus: vi.fn() };
            el._emoji_query = 'smile';
            el._emoji_suggestions = [
                { sn: ':smile:', glyph: '😄' },
                { sn: ':smiley:', glyph: '😃' },
                { sn: ':smirk:', glyph: '😏' },
            ];
            el._emoji_index = 0;

            // Arrow keys move the active row (and wrap), stopping Lexical from seeing them.
            const down = keyEvent('ArrowDown');
            el.onEditorKeyDown(down);
            expect(el._emoji_index).toBe(1);
            expect(down.preventDefault).toHaveBeenCalled();
            expect(down.stopImmediatePropagation).toHaveBeenCalled();

            const up = keyEvent('ArrowUp');
            el.onEditorKeyDown(up); // 1 -> 0
            el.onEditorKeyDown(keyEvent('ArrowUp')); // 0 -> wraps to 2
            expect(el._emoji_index).toBe(2);

            // Enter inserts the active suggestion's glyph in place of the trigger, closes the menu.
            const enter = keyEvent('Enter');
            el.onEditorKeyDown(enter);
            expect(enter.preventDefault).toHaveBeenCalled();
            expect(replaceEmojiTrigger).toHaveBeenCalledWith('smile', '😏');
            expect(el._emoji_suggestions.length).toBe(0);
        }),
    );

    it(
        'keeps the emoji menu closed after Escape until the query changes',
        mock.initConverse(converse, [], {}, async function (_converse) {
            await _converse.api.emojis.initialize();
            await customElements.whenDefined('converse-social-compose-rich');
            const el = /** @type {any} */ (document.createElement('converse-social-compose-rich'));
            let query = 'smile';
            el._handle = { getEmojiQuery: () => query, replaceEmojiTrigger: vi.fn(), focus: vi.fn() };

            // Open the menu, then dismiss it with Escape.
            await el.updateEmojiTypeahead();
            expect(el._emoji_suggestions.length).toBeGreaterThan(0);
            el.onEditorKeyDown(keyEvent('Escape'));
            expect(el._emoji_suggestions.length).toBe(0);

            // A later editor update for the SAME trigger (e.g. a selection change) must
            // not re-open the menu.
            await el.updateEmojiTypeahead();
            expect(el._emoji_suggestions.length).toBe(0);

            // Changing the query re-opens it.
            query = 'smiley';
            await el.updateEmojiTypeahead();
            expect(el._emoji_suggestions.length).toBeGreaterThan(0);

            // Moving the caret off the trigger entirely clears the dismissal memory.
            query = null;
            await el.updateEmojiTypeahead();
            expect(el._emoji_suggestions.length).toBe(0);
            expect(el._emoji_dismissed_query).toBe(null);
        }),
    );

    it(
        'closes the emoji menu when focus leaves the editor',
        mock.initConverse(converse, [], {}, async function () {
            await customElements.whenDefined('converse-social-compose-rich');
            const el = /** @type {any} */ (document.createElement('converse-social-compose-rich'));

            // Any focus move away from the editable closes the menu: without editor
            // focus its keyboard handling is unreachable, so it must never linger.
            el._emoji_suggestions = [{ sn: ':smile:', glyph: '😄' }];
            el.onEditorFocusOut();
            expect(el._emoji_suggestions.length).toBe(0);
        }),
    );

    it(
        'reclaims focus when a fully swallowed Escape only manifests as a blur (Vimium)',
        mock.initConverse(converse, [], {}, async function () {
            await customElements.whenDefined('converse-social-compose-rich');
            const el = /** @type {any} */ (document.createElement('converse-social-compose-rich'));
            const focus = vi.fn();
            el._handle = { replaceEmojiTrigger: vi.fn(), focus };
            el._emoji_query = 'smile';
            el._emoji_suggestions = [{ sn: ':smile:', glyph: '😄' }];
            /** @type {HTMLElement} */ (document.activeElement)?.blur?.(); // focus lands on <body>
            vi.spyOn(document, 'hasFocus').mockReturnValue(true); // headless tab lacks OS focus

            // Vimium swallows the Escape keydown at window level, so the page never
            // sees the key; the only signal is a blur to nowhere, with no pointer.
            el.onEditorFocusOut({ relatedTarget: null });
            expect(el._emoji_suggestions.length).toBe(0);
            await new Promise((r) => setTimeout(r, 25));
            expect(focus).toHaveBeenCalled();
            expect(el._emoji_dismissed_query).toBe('smile');

            // A pointer-initiated blur (a click elsewhere) must NOT reclaim focus.
            focus.mockClear();
            el._pointer_down = true;
            el._emoji_suggestions = [{ sn: ':smile:', glyph: '😄' }];
            el.onEditorFocusOut({ relatedTarget: null });
            await new Promise((r) => setTimeout(r, 25));
            expect(focus).not.toHaveBeenCalled();
        }),
    );

    it(
        'treats an Escape whose own blur closed the menu as a dismissal and reclaims focus',
        mock.initConverse(converse, [], {}, async function () {
            await customElements.whenDefined('converse-social-compose-rich');
            const el = /** @type {any} */ (document.createElement('converse-social-compose-rich'));
            el._handle = { replaceEmojiTrigger: vi.fn(), focus: vi.fn() };
            el._emoji_query = 'smile';
            el._emoji_suggestions = [{ sn: ':smile:', glyph: '😄' }];

            // A vim-style extension blurs the editor on Escape at document level,
            // so the focusout (which closes the menu) runs before our keydown
            // handler does, within the same Escape dispatch.
            el.onEditorFocusOut();
            expect(el._emoji_suggestions.length).toBe(0);

            // The keydown handler must still treat this Escape as a dismissal:
            // consume it and put focus back in the editor.
            const esc = keyEvent('Escape');
            el.onEditorKeyDown(esc);
            expect(esc.preventDefault).toHaveBeenCalled();
            expect(esc.stopImmediatePropagation).toHaveBeenCalled();
            expect(el._handle.focus).toHaveBeenCalled();
            expect(el._emoji_dismissed_query).toBe('smile');

            // A later, unrelated bare Escape falls through untouched, leaving the
            // editor's blur-on-Escape (the keyboard escape hatch) to act.
            const esc2 = keyEvent('Escape');
            el.onEditorKeyDown(esc2);
            expect(esc2.preventDefault).not.toHaveBeenCalled();
        }),
    );

    it(
        'closes the emoji menu on Escape and ignores keys while it is closed',
        mock.initConverse(converse, [], {}, async function () {
            await customElements.whenDefined('converse-social-compose-rich');
            const el = /** @type {any} */ (document.createElement('converse-social-compose-rich'));
            el._handle = { replaceEmojiTrigger: vi.fn(), focus: vi.fn() };

            // With the menu closed, keys are left entirely to Lexical (no preventDefault).
            const enter = keyEvent('Enter');
            el.onEditorKeyDown(enter);
            expect(enter.preventDefault).not.toHaveBeenCalled();

            // Escape dismisses an open menu without inserting anything, and leaves
            // focus in the editor (with the caret where it was).
            el._emoji_suggestions = [{ sn: ':smile:', glyph: '😄' }];
            const esc = keyEvent('Escape');
            el.onEditorKeyDown(esc);
            expect(esc.preventDefault).toHaveBeenCalled();
            expect(el._emoji_suggestions.length).toBe(0);
            expect(el._handle.replaceEmojiTrigger).not.toHaveBeenCalled();
            expect(el._handle.focus).toHaveBeenCalled();
        }),
    );
});
