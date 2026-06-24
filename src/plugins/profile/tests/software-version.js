import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { sizzle, u, stx } = converse.env;

describe('The profile modal', function () {
    it(
        "shows the server's software version (XEP-0092)",
        mock.initConverse(converse, [], {}, async function (_converse) {
            await mock.openControlBox(_converse);
            const cbview = _converse.chatboxviews.get('controlbox');
            cbview.querySelector('.change-status').click();

            const modal = _converse.api.modal.get('converse-profile-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            const conn = _converse.api.connection.get();
            const sent_iq = await u.waitUntil(() =>
                conn.IQ_stanzas.filter((iq) => sizzle('query[xmlns="jabber:iq:version"]', iq).length).pop()
            );
            expect(sent_iq).toEqualStanza(stx`
                <iq id="${sent_iq.getAttribute('id')}" to="montague.lit" type="get" xmlns="jabber:client">
                    <query xmlns="jabber:iq:version"/>
                </iq>`);

            const result = stx`
                <iq from="montague.lit" to="${_converse.jid}" id="${sent_iq.getAttribute('id')}" type="result" xmlns="jabber:client">
                    <query xmlns="jabber:iq:version">
                        <name>Prosody</name>
                        <version>0.12.0</version>
                        <os>Debian GNU/Linux</os>
                    </query>
                </iq>`;
            conn._dataRecv(mock.createRequest(_converse, result));

            const el = await u.waitUntil(() => modal.querySelector('.server-version'));
            expect(el.textContent.replace(/\s+/g, ' ').trim()).toBe('Prosody 0.12.0 (Debian GNU/Linux)');
        })
    );
});
