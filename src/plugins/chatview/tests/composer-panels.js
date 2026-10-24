import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { html, render } from 'lit';

const { u } = converse.env;

describe('Composer panels in a one-to-one chat', function () {
    it(
        'show a panel that a plugin adds through the getComposerPanels hook, at its order',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            _converse.api.listen.on('getComposerPanels', (_container, panels) => {
                panels.push({ name: 'test-panel', order: 250, template: html`<div class="test-panel"></div>` });
                return panels;
            });
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const panel = await u.waitUntil(() => view.querySelector('.test-panel'));
            const reply_preview = view.querySelector('converse-reply-preview');
            expect(panel.compareDocumentPosition(reply_preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        }),
    );

    it(
        'can be drawn with the exported frame outside the container, and keep their styles',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const { tplComposerPanel } = _converse.exports;
            const root = await u.waitUntil(() => document.querySelector('.conversejs'));
            const host = document.createElement('div');
            root.appendChild(host);
            render(
                tplComposerPanel({
                    kind: 'warning',
                    content: html`<span>Somewhere else</span>`,
                    close: { label: 'Close', handler: () => {} },
                }),
                host,
            );

            const panel = host.querySelector('.composer-panel');
            expect(panel.closest('converse-composer-panels')).toBeNull();
            expect(getComputedStyle(panel).borderLeftWidth).toBe('3px');
            const close = host.querySelector('.composer-panel__close');
            expect(getComputedStyle(close).position).toBe('absolute');
            expect(close.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
            host.remove();
        }),
    );

    it(
        'put a panel without a numeric order below the built-in ones',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            _converse.api.listen.on('getComposerPanels', (_container, panels) => {
                panels.unshift({ name: 'test-panel', template: html`<div class="test-panel"></div>` });
                return panels;
            });
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            const panel = await u.waitUntil(() => view.querySelector('.test-panel'));
            const reply_preview = view.querySelector('converse-reply-preview');
            expect(panel.compareDocumentPosition(reply_preview) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
        }),
    );

    it(
        'log an error and show none when a handler does not return the list',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const log_error = vi.spyOn(converse.env.log, 'error').mockImplementation(() => {});
            _converse.api.listen.on('getComposerPanels', (_container, panels) => {
                panels.push({ name: 'test-panel', order: 250, template: html`<div class="test-panel"></div>` });
            });
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            await u.waitUntil(() => log_error.mock.calls.some(([msg]) => String(msg).includes('getComposerPanels')));
            const container = view.querySelector('converse-composer-panels');
            expect(container.panels).toEqual([]);
            expect(container.querySelector('converse-reply-preview')).toBeNull();
            log_error.mockRestore();
        }),
    );

    it(
        'log an error and show none when a handler throws',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const log_error = vi.spyOn(converse.env.log, 'error').mockImplementation(() => {});
            const error = new Error('broken panel');
            _converse.api.listen.on('getComposerPanels', () => {
                throw error;
            });
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            await u.waitUntil(() => log_error.mock.calls.some(([msg]) => String(msg).includes('getComposerPanels')));
            expect(log_error).toHaveBeenCalledWith(error);
            const container = view.querySelector('converse-composer-panels');
            expect(container.panels).toEqual([]);
            expect(container.querySelector('converse-reply-preview')).toBeNull();
            log_error.mockRestore();
        }),
    );
});
