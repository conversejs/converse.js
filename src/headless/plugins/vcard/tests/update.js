describe('An incoming presence with a XEP-0153 vcard:update element', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'will cause a VCard avatar to be replaced',
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
            const sent_stanza = await u.waitUntil(
                () => IQ_stanzas.filter((s) => sizzle('vCard', s).length).pop(),
                1000
            );
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

    it(
        'will cause a VCard HTTP avatar to be replaced',
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
                                <photo>123</photo>
                            </x>
                        </presence>`
                )
            );
            const sent_stanza = await u.waitUntil(
                () => IQ_stanzas.filter((s) => sizzle('vCard', s).length).pop(),
                1000
            );
            expect(sent_stanza).toEqualStanza(stx`
                <iq type="get"
                        to="mercutio@montague.lit"
                        xmlns="jabber:client"
                        id="${sent_stanza.getAttribute('id')}">
                    <vCard xmlns="vcard-temp"/>
                </iq>`);

            const response = await fetch('/base/logo/conversejs-filled-192.png');
            const blob = await response.blob();

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
                            <BINVAL></BINVAL>
                            <EXTVAL>http://localhost:9876/base/logo/conversejs-filled-192.png</EXTVAL>
                        </PHOTO>
                    </vCard>
                </iq>`)
            );

            const { vcard } = await api.contacts.get(contact_jid);
            await u.waitUntil(() => vcard.get('image_url') === 'http://localhost:9876/base/logo/conversejs-filled-192.png');
            while (IQ_stanzas.length) IQ_stanzas.pop();

            /*
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    stx`<presence xmlns="jabber:client"
                                to="${_converse.session.get('jid')}"
                                from="${contact_jid}/resource">
                            <x xmlns='vcard-temp:x:update'>
                                <photo>123</photo>
                            </x>
                        </presence>`
                )
            );
            */

            return new Promise((resolve) => {
                setTimeout(() => {
                    expect(IQ_stanzas.filter((s) => sizzle('vCard', s).length).length).toBe(0);
                    resolve();
                }, 251);
            });
        })
    );

    it(
        'will cause a VCard avatar to be removed',
        mock.initConverse(['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { api } = _converse;
            const { u, sizzle } = _converse.env;
            await mock.waitForRoster(_converse, 'current', 1);
            mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const own_jid = _converse.session.get('jid');

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            let sent_stanza = await u.waitUntil(() => IQ_stanzas.filter((s) => sizzle(`vCard`, s).length).pop(), 500);
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
                <iq from='${own_jid}'
                        xmlns="jabber:client"
                        to='${_converse.session.get('jid')}'
                        type='result'
                        id='${sent_stanza.getAttribute('id')}'>
                    <vCard xmlns='vcard-temp'></vCard>
                </iq>`)
            );

            sent_stanza = await u.waitUntil(() =>
                IQ_stanzas.filter((s) => sizzle(`iq[to="${contact_jid}"] vCard`, s).length).pop()
            );
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
                        <CTRY>Italy</CTRY>
                        <LOCALITY>Verona</LOCALITY>
                        <N><GIVEN>Mercutio</GIVEN><FAMILY>Capulet</FAMILY></N>
                        <EMAIL><USERID>mercutio@shakespeare.lit</USERID></EMAIL>
                        <PHOTO>
                            <TYPE>${blob.type}</TYPE>
                            <BINVAL>${base64Image}</BINVAL>
                        </PHOTO>
                    </vCard>
                </iq>`)
            );

            const contact = await api.contacts.get(contact_jid);
            await u.waitUntil(() => contact.vcard.get('image'));
            expect(contact.vcard.get('image')).toEqual(base64Image);

            while (IQ_stanzas.length) IQ_stanzas.pop();

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    stx`<presence xmlns="jabber:client"
                                to="${_converse.session.get('jid')}"
                                from="${contact_jid}/resource">
                            <x xmlns='vcard-temp:x:update'>
                                <photo></photo>
                            </x>
                        </presence>`
                )
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
                mock.createRequest(stx`
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
                </iq>`)
            );

            await u.waitUntil(() => !contact.vcard.get('image'));
            expect(contact.vcard.get('image_hash')).toBeUndefined();
        })
    );

    it(
        'will cause a VCard HTTP avatar to be removed',
        mock.initConverse(['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { api } = _converse;
            const { u, sizzle } = _converse.env;
            await mock.waitForRoster(_converse, 'current', 1);
            mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const own_jid = _converse.session.get('jid');

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            let sent_stanza = await u.waitUntil(() => IQ_stanzas.filter((s) => sizzle(`vCard`, s).length).pop(), 500);
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
                <iq from='${own_jid}'
                        xmlns="jabber:client"
                        to='${_converse.session.get('jid')}'
                        type='result'
                        id='${sent_stanza.getAttribute('id')}'>
                    <vCard xmlns='vcard-temp'></vCard>
                </iq>`)
            );

            sent_stanza = await u.waitUntil(() =>
                IQ_stanzas.filter((s) => sizzle(`iq[to="${contact_jid}"] vCard`, s).length).pop()
            );
            expect(sent_stanza).toEqualStanza(stx`
                <iq type="get"
                        to="mercutio@montague.lit"
                        xmlns="jabber:client"
                        id="${sent_stanza.getAttribute('id')}">
                    <vCard xmlns="vcard-temp"/>
                </iq>`);

            const response = await fetch('/base/logo/conversejs-filled-192.png');
            const blob = await response.blob();

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
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
                            <BINVAL></BINVAL>
                            <EXTVAL>http://localhost:9876/base/logo/conversejs-filled-192.png</EXTVAL>
                        </PHOTO>
                    </vCard>
                </iq>`)
            );

            const contact = await api.contacts.get(contact_jid);
            await u.waitUntil(() => contact.vcard.get('image_url'));
            expect(contact.vcard.get('image_url')).toEqual("http://localhost:9876/base/logo/conversejs-filled-192.png");

            while (IQ_stanzas.length) IQ_stanzas.pop();

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    stx`<presence xmlns="jabber:client"
                                to="${_converse.session.get('jid')}"
                                from="${contact_jid}/resource">
                            <x xmlns='vcard-temp:x:update'>
                                <photo></photo>
                            </x>
                        </presence>`
                )
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
                mock.createRequest(stx`
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
                </iq>`)
            );

            await u.waitUntil(() => !contact.vcard.get('image_url'));
            expect(contact.vcard.get('image_url')).toBeUndefined();
        })
    );
});

describe('An outgoing presence with a XEP-0153 vcard:update element', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'is sent when the user updates their VCard avatar',
        mock.initConverse(['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { api } = _converse;
            const { u, sizzle } = _converse.env;
            await mock.waitForRoster(_converse, 'current', 0);
            mock.openControlBox(_converse);
            const own_jid = _converse.session.get('jid');
            const own_bare_jid = _converse.session.get('bare_jid');

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            let sent_stanza = await u.waitUntil(() => IQ_stanzas.filter((s) => sizzle(`vCard`, s).length).pop(), 500);
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
                <iq from='${own_jid}'
                        xmlns="jabber:client"
                        to='${_converse.session.get('jid')}'
                        type='result'
                        id='${sent_stanza.getAttribute('id')}'>
                    <vCard xmlns='vcard-temp'></vCard>
                </iq>`)
            );

            const vcard = await u.waitUntil(() => _converse.state.vcards.get(own_bare_jid));
            expect(vcard.get('image_hash')).not.toBeDefined();
            const vcard_updated = await u.waitUntil(() => vcard.get('vcard_updated'));

            while (IQ_stanzas.length) IQ_stanzas.pop();

            const response = await fetch('/base/logo/conversejs-filled-192.png');
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const byteArray = new Uint8Array(arrayBuffer);
            const hash_ab = await crypto.subtle.digest('SHA-1', byteArray);
            const image_hash = u.arrayBufferToHex(hash_ab);
            const base64Image = btoa(String.fromCharCode(...byteArray));

            // Call the API to set a new avatar
            api.vcard.set(own_bare_jid, {
                image: base64Image,
                image_type: blob.type,
            });

            sent_stanza = await u.waitUntil(() => IQ_stanzas.filter((s) => sizzle(`vCard`, s).length).pop(), 500);
            expect(sent_stanza).toEqualStanza(stx`
                <iq type="set" to="${own_bare_jid}" xmlns="jabber:client" id="${sent_stanza.getAttribute('id')}">
                    <vCard xmlns="vcard-temp">
                        <FN/><NICKNAME/><URL/><ROLE/><EMAIL><INTERNET/><PREF/><USERID/></EMAIL><PHOTO><TYPE>image/png</TYPE>
                        <BINVAL>${base64Image}</BINVAL></PHOTO>
                    </vCard>
                </iq>`);

            // Check optimistic save
            expect(vcard.get('image')).toBe(base64Image);
            expect(vcard.get('image_hash')).toBe(image_hash);
            expect(vcard.get('image_type')).toBe(blob.type);
            expect(vcard.get('vcard_updated')).toBe(vcard_updated); // didn't change

            while (IQ_stanzas.length) IQ_stanzas.pop();

            // Some servers send their own update presence, before sending the
            // return IQ. This should not create a new VCard get request
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    stx`<presence xmlns="jabber:client"
                                to="${_converse.session.get('jid')}"
                                from="${own_jid}">
                            <x xmlns='vcard-temp:x:update'>
                                <photo>${image_hash}</photo>
                            </x>
                        </presence>`
                )
            );

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
                <iq from='${own_bare_jid}'
                        xmlns="jabber:client"
                        to='${own_jid}'
                        type='result'
                        id='${sent_stanza.getAttribute('id')}'></iq>`)
            );

            // A new get IQ is sent out to fetch the latest VCard
            sent_stanza = await u.waitUntil(
                () => IQ_stanzas.filter((s) => sizzle('vCard', s).length).pop(),
                1000
            );
            expect(sent_stanza).toEqualStanza(stx`
                <iq type="get" xmlns="jabber:client" id="${sent_stanza.getAttribute('id')}">
                    <vCard xmlns="vcard-temp"/>
                </iq>`);

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(stx`
                <iq from='${own_bare_jid}'
                        xmlns="jabber:client"
                        to='${own_jid}'
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
                        <N><GIVEN>Romeo</GIVEN><FAMILY>Montague</FAMILY></N>
                        <EMAIL><USERID>romeo@shakespeare.lit</USERID></EMAIL>
                        <PHOTO>
                            <TYPE>${blob.type}</TYPE>
                            <BINVAL>${base64Image}</BINVAL>
                        </PHOTO>
                    </vCard>
                </iq>`)
            );

            await u.waitUntil(() => vcard.get('vcard_updated'));
            expect(vcard.get('image')).toBe(base64Image);
            expect(vcard.get('image_hash')).toBe(image_hash);
            expect(vcard.get('image_type')).toBe(blob.type);
        })
    );
});
