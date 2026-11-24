import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

// Deliberately its own spec file. `api` is a module singleton, so on a page
// where any spec has run with converse-time enabled the `api.time` namespace it
// assigned is still there, and blacklisting the plugin in a later spec on that
// page would prove nothing.
describe('The XEP-0202 view plugin', function () {
    it(
        'survives the headless plugin it depends on being blacklisted',
        mock.initConverse(
            converse,
            ['chatBoxesFetched'],
            { blacklisted_plugins: ['converse-time'] },
            async function (_converse) {
                const { api } = _converse;
                // `strict_plugin_dependencies` is off by default, so declaring
                // converse-time a dependency only logs when it's missing.
                expect(api.time).toBeUndefined();

                await mock.waitForRoster(_converse, 'current', 1);
                await mock.openControlBox(_converse);

                const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);

                const view = _converse.chatboxviews.get(contact_jid);
                const alert_el = await u.waitUntil(() => view.querySelector('converse-entity-time-alert'));

                // The element is defined and rendering; it just has nothing to
                // ask about the contact's time.
                expect(customElements.get('converse-entity-time-alert')).toBeDefined();
                expect(alert_el.getContactTime()).toBeNull();
            },
        ),
    );
});
