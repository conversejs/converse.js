describe('A VCard', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'is updated when a XEP-0153 presence update is received',
        mock.initConverse(['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { api } = _converse;
            const { u, sizzle } = _converse.env;
            await mock.waitForRoster(_converse, 'current', 1);
            mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            while (IQ_stanzas.length) IQ_stanzas.pop();

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    stx`<presence xmlns="jabber:client"
                                to="${_converse.session.get('jid')}"
                                from="${contact_jid}/resource">
                            <x xmlns='vcard-temp:x:update'>
                                <photo>01b87fcd030b72895ff8e88db57ec525450f000d</photo>
                            </x>
                        </presence>`
                )
            );
            const sent_stanza = await u.waitUntil(() => IQ_stanzas.filter((s) => sizzle('vCard', s).length).pop(), 500);
            expect(sent_stanza).toEqualStanza(stx`
                <iq type="get"
                        to="mercutio@montague.lit"
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
                mock.createRequest(stx`
                <iq from='${contact_jid}'
                        xmlns="jabber:client"
                        to='${_converse.session.get('jid')}'
                        type='result'
                        id='${sent_stanza.getAttribute('id')}'>
                    <vCard xmlns='vcard-temp'>
                        <BDAY>1476-06-09</BDAY>
                        <ADR>
                        <CTRY>Italy</CTRY>
                        <LOCALITY>Verona</LOCALITY>
                        <HOME/>
                        </ADR>
                        <NICKNAME/>
                        <N><GIVEN>Mercutio</GIVEN><FAMILY>Capulet</FAMILY></N>
                        <EMAIL><USERID>mercutio@shakespeare.lit</USERID></EMAIL>
                        <PHOTO>
                        <TYPE>${blob.type}</TYPE>
                        <BINVAL>${base64Image}</BINVAL>
                        </PHOTO>
                    </vCard>
                </iq>`)
            );

            const { vcard } = await api.contacts.get(contact_jid);
            await u.waitUntil(() => vcard.get('image_hash') === '6d52ba485d3fd69c96b8d424ceaf8082a7a00e51');
            while (IQ_stanzas.length) IQ_stanzas.pop();

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    stx`<presence xmlns="jabber:client"
                                to="${_converse.session.get('jid')}"
                                from="${contact_jid}/resource">
                            <x xmlns='vcard-temp:x:update'>
                                <photo>6d52ba485d3fd69c96b8d424ceaf8082a7a00e51</photo>
                            </x>
                        </presence>`
                )
            );

            return new Promise((resolve) => {
                setTimeout(() => {
                    expect(IQ_stanzas.filter((s) => sizzle('vCard', s).length).length).toBe(0);
                    resolve();
                }, 251);
            });
        })
    );
});
