/*global mock, converse */

const { $iq, Strophe, u } = converse.env;


describe("The OMEMO module", function() {

    it("implements XEP-0454 to encrypt uploaded files",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const base_url = 'https://example.org/';
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.domain,
            [{'category': 'server', 'type':'IM'}],
            ['http://jabber.org/protocol/disco#items'], [], 'info');

        const send_backup = XMLHttpRequest.prototype.send;
        const IQ_stanzas = _converse.connection.IQ_stanzas;

        await mock.waitUntilDiscoConfirmed(_converse, _converse.domain, [], [], ['upload.montague.tld'], 'items');
        await mock.waitUntilDiscoConfirmed(_converse, 'upload.montague.tld', [], [Strophe.NS.HTTPUPLOAD], []);
        await mock.waitForRoster(_converse, 'current', 3);
        const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        await u.waitUntil(() => mock.initializedOMEMO(_converse));

        await mock.openChatBoxFor(_converse, contact_jid);

        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        let stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.connection.jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '555'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.omemo_store);
        const devicelist = _converse.devicelists.get({'jid': contact_jid});
        await u.waitUntil(() => devicelist.devices.length === 1);

        const view = _converse.chatboxviews.get(contact_jid);
        const file = new File(['secret'], 'secret.txt', { type: 'text/plain' })
        view.model.set('omemo_active', true);
        view.model.sendFiles([file]);

        await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector('iq[to="upload.montague.tld"] request')).length);
        const iq = IQ_stanzas.pop();
        const url = base_url+"/secret.txt";
        stanza = u.toStanza(`
            <iq from="upload.montague.tld"
                id="${iq.getAttribute("id")}"
                to="romeo@montague.lit/orchard"
                type="result">
            <slot xmlns="urn:xmpp:http:upload:0">
                <put url="https://upload.montague.tld/4a771ac1-f0b2-4a4a-9700-f2a26fa2bb67/secret.txt">
                    <header name="Authorization">Basic Base64String==</header>
                    <header name="Cookie">foo=bar; user=romeo</header>
                </put>
                <get url="${url}" />
            </slot>
            </iq>`);

        spyOn(XMLHttpRequest.prototype, 'send').and.callFake(async function () {
            const message = view.model.messages.at(0);
            message.set('progress', 1);
            await u.waitUntil(() => view.querySelector('.chat-content progress')?.getAttribute('value') === '1')
            message.save({
                'upload': _converse.SUCCESS,
                'oob_url': message.get('get'),
                'body': message.get('get')
            });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        });
        let sent_stanza;
        _converse.connection._dataRecv(mock.createRequest(stanza));

        iq_stanza = await u.waitUntil(() => mock.bundleFetched(_converse, contact_jid, '555'));
        stanza = $iq({
            'from': contact_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result',
        }).c('pubsub', {
            'xmlns': 'http://jabber.org/protocol/pubsub'
            }).c('items', {'node': "eu.siacs.conversations.axolotl.bundles:555"})
                .c('item')
                    .c('bundle', {'xmlns': 'eu.siacs.conversations.axolotl'})
                        .c('signedPreKeyPublic', {'signedPreKeyId': '4223'}).t(btoa('1111')).up()
                        .c('signedPreKeySignature').t(btoa('2222')).up()
                        .c('identityKey').t(btoa('3333')).up()
                        .c('prekeys')
                            .c('preKeyPublic', {'preKeyId': '1'}).t(btoa('1001')).up()
                            .c('preKeyPublic', {'preKeyId': '2'}).t(btoa('1002')).up()
                            .c('preKeyPublic', {'preKeyId': '3'}).t(btoa('1003'));
        _converse.connection._dataRecv(mock.createRequest(stanza));
        iq_stanza = await u.waitUntil(() => mock.bundleFetched(_converse, _converse.bare_jid, '482886413b977930064a5888b92134fe'));
        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result',
        }).c('pubsub', {
            'xmlns': 'http://jabber.org/protocol/pubsub'
            }).c('items', {'node': "eu.siacs.conversations.axolotl.bundles:482886413b977930064a5888b92134fe"})
                .c('item')
                    .c('bundle', {'xmlns': 'eu.siacs.conversations.axolotl'})
                        .c('signedPreKeyPublic', {'signedPreKeyId': '4223'}).t(btoa('100000')).up()
                        .c('signedPreKeySignature').t(btoa('200000')).up()
                        .c('identityKey').t(btoa('300000')).up()
                        .c('prekeys')
                            .c('preKeyPublic', {'preKeyId': '1'}).t(btoa('1991')).up()
                            .c('preKeyPublic', {'preKeyId': '2'}).t(btoa('1992')).up()
                            .c('preKeyPublic', {'preKeyId': '3'}).t(btoa('1993'));

        spyOn(_converse.connection, 'send').and.callFake(stanza => (sent_stanza = stanza));
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => sent_stanza);

        const fallback = 'This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo';
        expect(Strophe.serialize(sent_stanza)).toBe(
            `<message from="romeo@montague.lit/orchard" `+
                `id="${sent_stanza.getAttribute("id")}" `+
                `to="lady.montague@montague.lit" `+
                `type="chat" `+
                `xmlns="jabber:client">`+
                    `<body>${fallback}</body>`+
                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                    `<request xmlns="urn:xmpp:receipts"/>`+
                    `<origin-id id="${sent_stanza.getAttribute('id')}" xmlns="urn:xmpp:sid:0"/>`+
                    `<encrypted xmlns="eu.siacs.conversations.axolotl">`+
                    `<header sid="123456789">`+
                        `<key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>`+
                        `<key rid="555">YzFwaDNSNzNYNw==</key>`+
                        `<iv>${sent_stanza.querySelector('header iv').textContent}</iv>`+
                    `</header>`+
                `<payload>${sent_stanza.querySelector('payload').textContent}</payload>`+
                `</encrypted>`+
                `<store xmlns="urn:xmpp:hints"/>`+
                `<encryption namespace="eu.siacs.conversations.axolotl" xmlns="urn:xmpp:eme:0"/>`+
            `</message>`);

        const link_el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(link_el.textContent.trim()).toBe(url);

        const message = view.model.messages.at(0);
        expect(message.get('is_encrypted')).toBe(true);

        XMLHttpRequest.prototype.send = send_backup;
    }));
});
