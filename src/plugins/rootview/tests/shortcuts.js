import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/**
 * @param {KeyboardEventInit} init
 */
function pressKeys(init) {
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

const showHelp = () => pressKeys({ key: '/', ctrlKey: true });

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 */
async function openHelp(_converse) {
    showHelp();
    const modal = await u.waitUntil(() => _converse.api.modal.get('converse-keyboard-shortcuts-modal'));
    await u.waitUntil(() => u.isVisible(modal));
    return modal;
}

describe('Keyboard shortcuts', function () {
    it(
        'are listed by group in the help modal, shown with Ctrl+/',
        mock.initConverse(converse, [], { view_mode: 'fullscreen' }, async (_converse) => {
            const modal = await openHelp(_converse);
            expect(modal.querySelector('.modal-title').textContent.trim()).toBe('Keyboard shortcuts');

            const groups = Array.from(modal.querySelectorAll('h6')).map((el) => el.textContent);
            expect(groups).toEqual(['General', 'Chat', 'Social']);
            const labels = Array.from(modal.querySelectorAll('kbd')).map((el) => el.textContent);
            expect(labels).toEqual(['Ctrl+/', 'Alt+Shift+↓', 'Alt+Shift+↑', 'Home', 'End']);
        }),
    );

    it(
        "aren't listed for an app that isn't enabled",
        mock.initConverse(converse, [], { view_mode: 'fullscreen', apps: ['chat'] }, async (_converse) => {
            const modal = await openHelp(_converse);
            const groups = Array.from(modal.querySelectorAll('h6')).map((el) => el.textContent);
            expect(groups).toEqual(['General', 'Chat']);
        }),
    );

    it(
        "aren't listed for the Social app outside of fullscreen",
        mock.initConverse(converse, [], {}, async (_converse) => {
            const modal = await openHelp(_converse);
            const groups = Array.from(modal.querySelectorAll('h6')).map((el) => el.textContent);
            expect(groups).toEqual(['General', 'Chat']);
        }),
    );

    it(
        'can be added by plugins',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const handler = vi.fn();
            _converse.api.shortcuts.add({
                id: 'test-hello',
                group: 'Test',
                label: 'Alt+Shift+Y',
                description: 'Say hello',
                matches: (ev) => ev.altKey && ev.shiftKey && ev.code === 'KeyY',
                handler,
            });

            const ev = new KeyboardEvent('keydown', { code: 'KeyY', altKey: true, shiftKey: true, cancelable: true });
            document.dispatchEvent(ev);
            expect(handler).toHaveBeenCalledOnce();
            expect(ev.defaultPrevented).toBe(true);

            const modal = await openHelp(_converse);
            const items = Array.from(modal.querySelectorAll('li')).map((el) =>
                el.textContent.replace(/\s+/g, ' ').trim(),
            );
            expect(items).toContain('Say hello Alt+Shift+Y');
        }),
    );

    it(
        'are ignored when disabled',
        mock.initConverse(converse, [], { enable_keyboard_shortcuts: false }, async (_converse) => {
            showHelp();
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(_converse.api.modal.get('converse-keyboard-shortcuts-modal')).toBeUndefined();
        }),
    );
});
