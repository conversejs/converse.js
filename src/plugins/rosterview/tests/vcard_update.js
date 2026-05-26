import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { stx } = converse.env;

describe('An incoming presence with a XEP-0153 vcard:update element', function () {
    it(
        'will cause a VCard avatar to be removed',
        mock.initConverse(converse, ['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { api } = _converse;
            const { u, sizzle } = _converse.env;
                    mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            let sent_stanza = await u.waitUntil(() =>
                IQ_stanzas.filter((s) => sizzle(`iq[to="${contact_jid}"] vCard`, s).length).pop(),
            );
            expect(sent_stanza).toEqualStanza(stx`
                <iq type="get"
                        to="${contact_jid}"
                        xmlns="jabber:client"
                        id="${sent_stanza.getAttribute('id')}">
                    <vCard xmlns="vcard-temp"/>
                </iq>`);

            const response = await fetch('/base/logo/conversejs-filled-192.png');
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const byteArray = new Uint8Array(arrayBuffer);
            const base64Image = btoa(String.fromCharCode(...byteArray));

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <iq from='${contact_jid}'
                        xmlns="jabber:client"
                        to='${_converse.session.get('jid')}'
                        type='result'
                        id='${sent_stanza.getAttribute('id')}'>
                    <vCard xmlns='vcard-temp'>
                        <BDAY>1476-06-09</BDAY>
                        <CTRY>Italy</CTRY>
                        <LOCALITY>Verona</LOCALITY>
                        <N><GIVEN>Mercutio</GIVEN><FAMILY>Capulet</FAMILY></N>
                        <EMAIL><USERID>mercutio@shakespeare.lit</USERID></EMAIL>
                        <PHOTO>
                            <TYPE>${blob.type}</TYPE>
                            <BINVAL>${base64Image}</BINVAL>
                        </PHOTO>
                    </vCard>
                </iq>`,
                ),
            );

            const contact = await api.contacts.get(contact_jid);
            await u.waitUntil(() => contact.vcard.get('image'), 1000);
            expect(contact.vcard.get('image')).toEqual(base64Image);

            while (IQ_stanzas.length) IQ_stanzas.pop();

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<presence xmlns="jabber:client"
                                to="${_converse.session.get('jid')}"
                                from="${contact_jid}/resource">
                            <x xmlns='vcard-temp:x:update'>
                                <photo></photo>
                            </x>
                        </presence>`,
                ),
            );

            sent_stanza = await u.waitUntil(() => IQ_stanzas.filter((s) => sizzle('vCard', s).length).pop(), 500);
            expect(sent_stanza).toEqualStanza(stx`
                <iq type="get"
                        to="mercutio@montague.lit"
                        xmlns="jabber:client"
                        id="${sent_stanza.getAttribute('id')}">
                    <vCard xmlns="vcard-temp"/>
                </iq>`);

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`
                <iq from='${contact_jid}'
                        xmlns="jabber:client"
                        to='${_converse.session.get('jid')}'
                        type='result'
                        id='${sent_stanza.getAttribute('id')}'>
                    <vCard xmlns='vcard-temp'>
                        <BDAY>1476-06-09</BDAY>
                        <CTRY>Italy</CTRY>
                        <LOCALITY>Verona</LOCALITY>
                        <N><GIVEN>Mercutio</GIVEN><FAMILY>Capulet</FAMILY></N>
                        <EMAIL><USERID>mercutio@shakespeare.lit</USERID></EMAIL>
                        <PHOTO></PHOTO>
                    </vCard>
                </iq>`,
                ),
            );

            await u.waitUntil(() => !contact.vcard.get('image'));
            expect(contact.vcard.get('image_hash')).toBeUndefined();
        }),
    );
});
