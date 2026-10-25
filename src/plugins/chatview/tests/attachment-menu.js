import { vi } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, u } = converse.env;

// The voice-messages plugin is on by default and adds its own item to the menu.
// These tests are about the built-in items, so it is left out here.
function initConverse(converse, promise_names, settings, func) {
    return mock.initConverse(converse, promise_names, { blacklisted_plugins: ['converse-voice-messages'], ...settings }, func);
}

const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

/**
 * Answer the server's disco queries, with or without an HTTP File Upload service.
 * @param {Object} [options]
 * @param {boolean} [options.upload]
 */
async function confirmDisco(_converse, { upload = true } = {}) {
    const domain = _converse.session.get('domain');
    await mock.waitUntilDiscoConfirmed(
        _converse,
        domain,
        [{ category: 'server', type: 'IM' }],
        ['http://jabber.org/protocol/disco#items'],
        [],
        'info',
    );
    if (upload) {
        await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], ['upload.montague.tld'], 'items');
        await mock.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
    } else {
        await mock.waitUntilDiscoConfirmed(_converse, domain, [], [], [], 'items');
    }
}

/**
 * Open a one-to-one chat once the server has answered disco.
 * @param {Object} [options] - Passed on to {@link confirmDisco}
 */
async function openChat(_converse, options) {
    await confirmDisco(_converse, options);
    await mock.waitForRoster(_converse, 'current', 1);
    await mock.openChatBoxFor(_converse, contact_jid);
    return _converse.chatboxviews.get(contact_jid);
}

/**
 * Wait for the menu to have gathered its items, then check that there is no paperclip.
 */
async function expectNoPaperclip(view) {
    const menu = await u.waitUntil(() => view.querySelector('converse-attachment-menu'));
    await menu.initialized;
    await menu.updateComplete;
    expect(view.querySelector('.chat-toolbar .toggle-attachment-menu')).toBeNull();
}

/**
 * Pick the named item, with the file picker stubbed so that no native dialog opens.
 * @returns {{ input: HTMLInputElement, click: import('vitest').MockInstance }}
 */
function pickFileItem(view, name) {
    const input = view.querySelector('converse-attachment-menu input.fileupload');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    view.querySelector(`.attachment-menu__item[data-name="${name}"]`).click();
    return { input, click };
}

/**
 * Simulate the user choosing files in the (stubbed) picker.
 * @param {HTMLInputElement} input
 * @param {File[]} files
 */
function chooseFiles(input, files) {
    const data = new DataTransfer();
    files.forEach((f) => data.items.add(f));
    input.files = data.files;
    input.dispatchEvent(new Event('change'));
}

describe('The attachment menu in a one-to-one chat', function () {
    it(
        'opens from a paperclip in the toolbar once the server is known to offer HTTP File Upload',
        initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const view = await openChat(_converse);
            const menu = await mock.openAttachmentMenu(view);
            expect(mock.attachmentMenuItems(view)).toEqual(['Send a file', 'Send an image']);

            const button = menu.querySelector('.toggle-attachment-menu');
            expect(button.getAttribute('aria-label')).toBe('Add attachment');
            expect(button.getAttribute('aria-expanded')).toBe('true');
        }),
    );

    it(
        'moves focus to the item under the pointer, so that only one item is highlighted',
        initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const view = await openChat(_converse);
            await mock.openAttachmentMenu(view);
            const image = view.querySelector('.attachment-menu__item[data-name="image"]');
            await userEvent.hover(image);
            expect(document.activeElement).toBe(image);
        }),
    );

    it(
        'has no paperclip when there is nothing to attach',
        initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const view = await openChat(_converse, { upload: false });
            await u.waitUntil(() => view.querySelector('.chat-toolbar .toggle-emojis'));
            await expectNoPaperclip(view);
        }),
    );

    it(
        'lists file, image and location, in that order, when location sharing is on',
        initConverse(
            converse,
            ['chatBoxesFetched'],
            { visible_toolbar_buttons: { location: true } },
            async function (_converse) {
                const view = await openChat(_converse);
                await mock.openAttachmentMenu(view);
                expect(mock.attachmentMenuItems(view)).toEqual(['Send a file', 'Send an image', 'Share your location']);

                const icons = Array.from(view.querySelectorAll('.attachment-menu__item converse-icon'));
                expect(icons.map((el) => el.getAttribute('class'))).toEqual([
                    'fa fa-paperclip',
                    'fa fa-image',
                    'fa fa-globe',
                ]);
            },
        ),
    );

    it(
        'lists only location when the server has no HTTP File Upload but location sharing is on',
        initConverse(
            converse,
            ['chatBoxesFetched'],
            { visible_toolbar_buttons: { location: true } },
            async function (_converse) {
                const view = await openChat(_converse, { upload: false });
                await mock.openAttachmentMenu(view);
                expect(mock.attachmentMenuItems(view)).toEqual(['Share your location']);
            },
        ),
    );

    it(
        'leaves out file and image when the fileupload setting is off, but keeps location',
        initConverse(
            converse,
            ['chatBoxesFetched'],
            { visible_toolbar_buttons: { fileupload: false, location: true } },
            async function (_converse) {
                const view = await openChat(_converse);
                await mock.openAttachmentMenu(view);
                expect(mock.attachmentMenuItems(view)).toEqual(['Share your location']);
            },
        ),
    );

    it(
        'leaves out location when the location setting is off, but keeps file and image',
        initConverse(
            converse,
            ['chatBoxesFetched'],
            { visible_toolbar_buttons: { location: false } },
            async function (_converse) {
                const view = await openChat(_converse);
                await mock.openAttachmentMenu(view);
                expect(mock.attachmentMenuItems(view)).toEqual(['Send a file', 'Send an image']);
            },
        ),
    );

    it(
        'has no paperclip when every attachment setting is off',
        initConverse(
            converse,
            ['chatBoxesFetched'],
            { visible_toolbar_buttons: { fileupload: false, location: false } },
            async function (_converse) {
                const view = await openChat(_converse);
                await u.waitUntil(() => view.querySelector('.chat-toolbar .toggle-emojis'));
                await expectNoPaperclip(view);
            },
        ),
    );

    it(
        'closes when "Send a file" is picked, opens a picker for any file, and sends what is chosen',
        initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const view = await openChat(_converse);
            await mock.openAttachmentMenu(view);

            const { input, click } = pickFileItem(view, 'file');
            expect(click).toHaveBeenCalledTimes(1);
            expect(input.accept).toBe('');
            expect(u.isVisible(view.querySelector('.attachment-menu'))).toBe(false);

            chooseFiles(input, [new File(['hello'], 'hello.txt', { type: 'text/plain' })]);

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const iq = await u.waitUntil(() =>
                IQ_stanzas.find((iq) => iq.querySelector('iq[to="upload.montague.tld"] request')),
            );
            const request = iq.querySelector('request');
            expect(request.getAttribute('filename')).toBe('hello.txt');
            expect(request.getAttribute('content-type')).toBe('text/plain');
        }),
    );

    it(
        'opens a picker for images only when "Send an image" is picked, and sends the chosen image',
        initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const view = await openChat(_converse);
            await mock.openAttachmentMenu(view);

            const { input, click } = pickFileItem(view, 'image');
            expect(click).toHaveBeenCalledTimes(1);
            expect(input.accept).toBe('image/*');
            expect(input.hasAttribute('capture')).toBe(false);
            expect(u.isVisible(view.querySelector('.attachment-menu'))).toBe(false);

            chooseFiles(input, [new File(['...'], 'juliet.jpg', { type: 'image/jpeg' })]);

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const iq = await u.waitUntil(() =>
                IQ_stanzas.find((iq) => iq.querySelector('iq[to="upload.montague.tld"] request')),
            );
            const request = iq.querySelector('request');
            expect(request.getAttribute('filename')).toBe('juliet.jpg');
            expect(request.getAttribute('content-type')).toBe('image/jpeg');

            // A later "Send a file" is back to accepting anything.
            await mock.openAttachmentMenu(view);
            view.querySelector('.attachment-menu__item[data-name="file"]').click();
            expect(input.accept).toBe('');
        }),
    );
});

describe('The attachment menu and the keyboard', function () {
    const settings = { visible_toolbar_buttons: { location: true } };

    /**
     * Focus the paperclip and press Enter, as a keyboard user would.
     * @returns {Promise<{ button: HTMLElement, items: HTMLElement[] }>}
     */
    async function openWithKeyboard(view) {
        const button = await u.waitUntil(() => view.querySelector('.chat-toolbar .toggle-attachment-menu'));
        button.focus();
        await userEvent.keyboard('{Enter}');
        const items = Array.from(view.querySelectorAll('.attachment-menu__item'));
        await u.waitUntil(() => document.activeElement === items[0]);
        return { button, items };
    }

    it(
        'opens from Enter on the paperclip with focus on the first item, which the arrow keys move',
        initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const view = await openChat(_converse);
            const { button, items } = await openWithKeyboard(view);
            expect(items.length).toBe(3);
            expect(button.getAttribute('aria-expanded')).toBe('true');

            await userEvent.keyboard('{ArrowDown}');
            expect(document.activeElement).toBe(items[1]);
            await userEvent.keyboard('{ArrowDown}');
            expect(document.activeElement).toBe(items[2]);
            await userEvent.keyboard('{ArrowDown}'); // Wraps around
            expect(document.activeElement).toBe(items[0]);
            await userEvent.keyboard('{ArrowUp}');
            expect(document.activeElement).toBe(items[2]);
            await userEvent.keyboard('{Home}');
            expect(document.activeElement).toBe(items[0]);
            await userEvent.keyboard('{End}');
            expect(document.activeElement).toBe(items[2]);
        }),
    );

    it(
        'activates the focused item with Enter, and with Space',
        initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const view = await openChat(_converse);
            const { button } = await openWithKeyboard(view);
            const input = view.querySelector('converse-attachment-menu input.fileupload');
            const click = vi.spyOn(input, 'click').mockImplementation(() => {});

            await userEvent.keyboard('{ArrowDown}');
            await userEvent.keyboard('{Enter}');
            expect(click).toHaveBeenCalledTimes(1);
            expect(input.accept).toBe('image/*');
            expect(u.isVisible(view.querySelector('.attachment-menu'))).toBe(false);
            expect(button.getAttribute('aria-expanded')).toBe('false');

            await openWithKeyboard(view);
            await userEvent.keyboard(' ');
            expect(click).toHaveBeenCalledTimes(2);
            expect(input.accept).toBe('');
            expect(u.isVisible(view.querySelector('.attachment-menu'))).toBe(false);
        }),
    );

    it(
        'closes on Escape and puts focus back on the paperclip',
        initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const view = await openChat(_converse);
            const { button } = await openWithKeyboard(view);
            await userEvent.keyboard('{ArrowDown}');

            await userEvent.keyboard('{Escape}');
            await u.waitUntil(() => !u.isVisible(view.querySelector('.attachment-menu')));
            expect(document.activeElement).toBe(button);
            expect(button.getAttribute('aria-expanded')).toBe('false');
        }),
    );

    it(
        'closes on Escape even when focus is in the message field, and leaves focus there',
        initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const view = await openChat(_converse);
            await mock.openAttachmentMenu(view);

            const editable = view.querySelector('.chat-textarea');
            editable.focus();
            await userEvent.keyboard('{Escape}');

            await u.waitUntil(() => !u.isVisible(view.querySelector('.attachment-menu')));
            expect(document.activeElement).toBe(editable);
        }),
    );

    it(
        'is announced as a menu of labelled items opened by an "Add attachment" button',
        initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const view = await openChat(_converse);
            const menu = await mock.openAttachmentMenu(view);

            const button = menu.querySelector('.toggle-attachment-menu');
            expect(button.getAttribute('aria-label')).toBe('Add attachment');
            expect(button.getAttribute('aria-haspopup')).toBe('menu');
            expect(button.getAttribute('aria-expanded')).toBe('true');

            const list = menu.querySelector('.attachment-menu');
            expect(list.getAttribute('role')).toBe('menu');
            expect(list.getAttribute('aria-labelledby')).toBe(button.id);
            // The id must resolve to the button, not to the menu element around it.
            expect(document.getElementById(button.id)).toBe(button);
            const items = Array.from(list.querySelectorAll('[role="menuitem"]'));
            expect(items.map((el) => el.textContent.trim())).toEqual([
                'Send a file',
                'Send an image',
                'Share your location',
            ]);

            button.click();
            await u.waitUntil(() => button.getAttribute('aria-expanded') === 'false');
        }),
    );
});

describe('The attachment menu and plugins', function () {
    const settings = { visible_toolbar_buttons: { location: true } };

    it(
        'lists an item added through the getAttachmentMenuItems hook at its order, and runs its handler when picked',
        initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const handler = vi.fn();
            _converse.api.listen.on('getAttachmentMenuItems', (menu, items) => {
                items.push({
                    name: 'test-item',
                    order: 250,
                    icon: 'fa-star',
                    label: 'Share a star',
                    handler: () => handler(menu.model.get('jid')),
                });
                return items;
            });
            const view = await openChat(_converse);
            await mock.openAttachmentMenu(view);
            expect(mock.attachmentMenuItems(view)).toEqual([
                'Send a file',
                'Send an image',
                'Share a star',
                'Share your location',
            ]);
            const item = view.querySelector('.attachment-menu__item[data-name="test-item"]');
            expect(item.querySelector('converse-icon').getAttribute('class')).toBe('fa fa-star');

            item.click();
            expect(handler).toHaveBeenCalledWith(contact_jid);
            expect(u.isVisible(view.querySelector('.attachment-menu'))).toBe(false);
        }),
    );

    it(
        'puts an item without a numeric order last, after a numbered one however large its order',
        initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            _converse.api.listen.on('getAttachmentMenuItems', (_menu, items) => {
                items.unshift({ name: 'test-item', icon: 'fa-star', label: 'Share a star', handler: () => {} });
                items.push({
                    name: 'late-item',
                    order: 100000,
                    icon: 'fa-star',
                    label: 'Share a comet',
                    handler: () => {},
                });
                return items;
            });
            const view = await openChat(_converse);
            await mock.openAttachmentMenu(view);
            expect(mock.attachmentMenuItems(view)).toEqual([
                'Send a file',
                'Send an image',
                'Share your location',
                'Share a comet',
                'Share a star',
            ]);
        }),
    );

    it(
        'logs an error and shows no paperclip when a handler does not return the list',
        initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const log_error = vi.spyOn(converse.env.log, 'error').mockImplementation(() => {});
            _converse.api.listen.on('getAttachmentMenuItems', (_menu, items) => {
                items.push({ name: 'test-item', order: 250, icon: 'fa-star', label: 'Share a star', handler: () => {} });
            });
            const view = await openChat(_converse);
            await u.waitUntil(() =>
                log_error.mock.calls.some(([msg]) => String(msg).includes('getAttachmentMenuItems')),
            );
            await expectNoPaperclip(view);
            log_error.mockRestore();
        }),
    );

    it(
        'logs an error and shows no paperclip when a handler throws',
        initConverse(converse, ['chatBoxesFetched'], settings, async function (_converse) {
            const log_error = vi.spyOn(converse.env.log, 'error').mockImplementation(() => {});
            const error = new Error('broken item');
            _converse.api.listen.on('getAttachmentMenuItems', () => {
                throw error;
            });
            const view = await openChat(_converse);
            await u.waitUntil(() =>
                log_error.mock.calls.some(([msg]) => String(msg).includes('getAttachmentMenuItems')),
            );
            expect(log_error).toHaveBeenCalledWith(error);
            await expectNoPaperclip(view);
            log_error.mockRestore();
        }),
    );
});

describe('Sending files without the attachment menu', function () {
    it(
        'still works by pasting or dropping them into the message field',
        initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const view = await openChat(_converse);
            const send_files = vi.spyOn(view.model, 'sendFiles').mockResolvedValue([]);
            const editable = view.querySelector('.chat-textarea');
            const file = new File(['test'], 'test.txt', { type: 'text/plain' });

            const clipboardData = new DataTransfer();
            clipboardData.items.add(file);
            editable.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
            expect(send_files).toHaveBeenCalledTimes(1);
            expect(Array.from(send_files.mock.calls[0][0]).map((f) => f.name)).toEqual(['test.txt']);

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            editable.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
            expect(send_files).toHaveBeenCalledTimes(2);
            expect(Array.from(send_files.mock.calls[1][0]).map((f) => f.name)).toEqual(['test.txt']);
            expect(u.isVisible(view.querySelector('.attachment-menu'))).toBe(false);
        }),
    );
});
