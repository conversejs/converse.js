/*global converse */
import mock from '../../../tests/mock.js';

const { stx, u } = converse.env;

describe('MUC presence history element', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'includes history when maxstanzas is set',
        mock.initConverse(['statusInitialized'], { muc_history_max_stanzas: 5 }, async function (_converse) {
            const { api } = _converse;
            const muc_jid = 'room@server';
            const nick = 'test';
            const jid = _converse.session.get('jid');
            await mock.openAndEnterMUC(_converse, muc_jid, nick, ['http://jabber.org/protocol/muc']);
            const { sent_stanzas } = _converse.api.connection.get();

            let sent_stanza = await u.waitUntil(() =>
                sent_stanzas
                    .filter((s) => s.nodeName === 'presence' && s.getAttribute('to') === `${muc_jid}/${nick}`)
                    .pop()
            );
            expect(sent_stanza).toEqualStanza(stx`
              <presence to="${muc_jid}/${nick}" xmlns="jabber:client" id="${sent_stanza.getAttribute('id')}" from="${jid}">
                <x xmlns="http://jabber.org/protocol/muc">
                  <history maxstanzas="5"/>
                </x>
                <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="https://conversejs.org" ver="H63l6q0hnLTdpFJt2JA5AOAGl/o="/>
              </presence>`);

            api.settings.set('muc_history_max_stanzas', 0);

            const muc2_jid = 'room2@server';
            await mock.openAndEnterMUC(_converse, muc2_jid, nick);
            sent_stanza = await u.waitUntil(() =>
                sent_stanzas
                    .filter((s) => s.nodeName === 'presence' && s.getAttribute('to') === `${muc2_jid}/${nick}`)
                    .pop()
            );
            expect(sent_stanza).toEqualStanza(stx`
              <presence to="${muc2_jid}/${nick}" xmlns="jabber:client" id="${sent_stanza.getAttribute('id')}" from="${jid}">
                <x xmlns="http://jabber.org/protocol/muc"><history maxstanzas="0"/></x>
                <c xmlns="http://jabber.org/protocol/caps" hash="sha-1" node="https://conversejs.org" ver="H63l6q0hnLTdpFJt2JA5AOAGl/o="/>
              </presence>`);
        })
    );
});
