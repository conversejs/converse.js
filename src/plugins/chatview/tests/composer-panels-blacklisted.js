import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';
import { html } from 'lit';

const { u } = converse.env;

// Deliberately its own spec file. Custom elements can't be un-registered once
// defined on a page, so this blacklists time-views on a page of its own.
describe('Composer panels without the time-views plugin', function () {
    it(
        'still show the panels that other plugins add through the getComposerPanels hook',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { blacklisted_plugins: ['converse-time-views'] },
            async function (_converse) {
                _converse.api.listen.on('getComposerPanels', (_container, panels) => {
                    panels.push({ name: 'test-panel', order: 250, template: html`<div class="test-panel"></div>` });
                    return panels;
                });

                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);

                await u.waitUntil(() => view.querySelector('.test-panel'));
                expect(customElements.get('converse-entity-time-alert')).toBeUndefined();
                expect(view.querySelector('converse-composer-panels')).not.toBeNull();
            },
        ),
    );
});
