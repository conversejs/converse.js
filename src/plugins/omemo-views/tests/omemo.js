/*global mock, converse */

const { $iq, $msg, omemo, Strophe } = converse.env;
const u = converse.env.utils;

describe("The OMEMO module", function() {

    it("adds methods for encrypting and decrypting messages via AES GCM",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const message = 'This message will be encrypted'
        await mock.waitForRoster(_converse, 'current', 1);
        const payload = await omemo.encryptMessage(message);
        const result = await omemo.decryptMessage(payload);
        expect(result).toBe(message);
    }));

    it("enables encrypted messages to be sent and received",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        let sent_stanza;
        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.initializedOMEMO(_converse);
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
        view.model.set('omemo_active', true);

        const textarea = view.querySelector('.chat-textarea');
        textarea.value = 'This message will be encrypted';
        const message_form = view.querySelector('converse-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
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

        spyOn(_converse.connection, 'send').and.callFake(stanza => { sent_stanza = stanza });
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => sent_stanza);
        expect(Strophe.serialize(sent_stanza)).toBe(
            `<message from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute("id")}" `+
                        `to="mercutio@montague.lit" `+
                        `type="chat" xmlns="jabber:client">`+
                `<body>This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo</body>`+
                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                `<request xmlns="urn:xmpp:receipts"/>`+
                `<origin-id id="${sent_stanza.getAttribute('id')}" xmlns="urn:xmpp:sid:0"/>`+
                `<encrypted xmlns="eu.siacs.conversations.axolotl">`+
                    `<header sid="123456789">`+
                        `<key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>`+
                        `<key rid="555">YzFwaDNSNzNYNw==</key>`+
                        `<iv>${sent_stanza.querySelector("iv").textContent}</iv>`+
                    `</header>`+
                    `<payload>${sent_stanza.querySelector("payload").textContent}</payload>`+
                `</encrypted>`+
                `<store xmlns="urn:xmpp:hints"/>`+
                `<encryption namespace="eu.siacs.conversations.axolotl" xmlns="urn:xmpp:eme:0"/>`+
            `</message>`);

        // Test reception of an encrypted message
        let obj = await omemo.encryptMessage('This is an encrypted message from the contact')
        // XXX: Normally the key will be encrypted via libsignal.
        // However, we're mocking libsignal in the tests, so we include it as plaintext in the message.
        stanza = $msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                'id': _converse.connection.getUniqueId()
            }).c('body').t('This is a fallback message').up()
                .c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                    .c('header', {'sid':  '555'})
                        .c('key', {'rid':  _converse.omemo_store.get('device_id')}).t(u.arrayBufferToBase64(obj.key_and_tag)).up()
                        .c('iv').t(obj.iv)
                        .up().up()
                    .c('payload').t(obj.payload);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.model.messages.length).toBe(2);
        expect(view.querySelectorAll('.chat-msg__body')[1].textContent.trim())
            .toBe('This is an encrypted message from the contact');

        // #1193 Check for a received message without <body> tag
        obj = await omemo.encryptMessage('Another received encrypted message without fallback')
        stanza = $msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                'id': _converse.connection.getUniqueId()
            }).c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                .c('header', {'sid':  '555'})
                    .c('key', {'rid':  _converse.omemo_store.get('device_id')}).t(u.arrayBufferToBase64(obj.key_and_tag)).up()
                    .c('iv').t(obj.iv)
                    .up().up()
                .c('payload').t(obj.payload);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        await u.waitUntil(() => view.model.messages.length > 1);
        expect(view.model.messages.length).toBe(3);
        expect(view.querySelectorAll('.chat-msg__body')[2].textContent.trim())
            .toBe('Another received encrypted message without fallback');
    }));

    it("properly handles an already decrypted message being received again",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.initializedOMEMO(_converse);
        await mock.openChatBoxFor(_converse, contact_jid);
        const iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
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

        const view = _converse.chatboxviews.get(contact_jid);
        view.model.set('omemo_active', true);

        // Test reception of an encrypted message
        const msg_txt = 'This is an encrypted message from the contact';
        const obj = await omemo.encryptMessage(msg_txt)
        const id = _converse.connection.getUniqueId();
        stanza = $msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                id
            }).c('body').t('This is a fallback message').up()
                .c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                    .c('header', {'sid':  '555'})
                        .c('key', {'rid':  _converse.omemo_store.get('device_id')})
                            .t(u.arrayBufferToBase64(obj.key_and_tag)).up()
                        .c('iv').t(obj.iv)
                        .up().up()
                    .c('payload').t(obj.payload);
        _converse.connection._dataRecv(mock.createRequest(stanza));

        // Test reception of the same message, but the decryption fails.
        // The properly decrypted message should still show to the user.
        // See issue: https://github.com/conversejs/converse.js/issues/2733#issuecomment-1035493594
        stanza = $msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                id
            }).c('body').t('This is a fallback message').up()
                .c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                    .c('header', {'sid':  '555'})
                        .c('key', {'rid':  _converse.omemo_store.get('device_id')})
                            .t(u.arrayBufferToBase64(obj.key_and_tag)).up()
                        .c('iv').t(obj.iv)
                        .up().up()
                    .c('payload').t(obj.payload+'x'); // Hack to break decryption.
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => view.querySelector('.chat-msg__text')?.textContent.trim() === msg_txt);

        expect(view.model.messages.length).toBe(1);
        const msg = view.model.messages.at(0);
        expect(msg.get('is_ephemeral')).toBe(false)
        expect(msg.getDisplayName()).toBe('Mercutio');
        expect(msg.get('is_error')).toBe(false);
    }));

    it("will create a new device based on a received carbon message",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.SID]);
        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await u.waitUntil(() => mock.initializedOMEMO(_converse));
        await mock.openChatBoxFor(_converse, contact_jid);
        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        const my_devicelist = _converse.devicelists.get({'jid': _converse.bare_jid});
        expect(my_devicelist.devices.length).toBe(2);

        const stanza = $iq({
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

        const contact_devicelist = _converse.devicelists.get({'jid': contact_jid});
        await u.waitUntil(() => contact_devicelist.devices.length === 1);

        const view = _converse.chatboxviews.get(contact_jid);
        view.model.set('omemo_active', true);

        // Test reception of an encrypted carbon message
        const obj = await omemo.encryptMessage('This is an encrypted carbon message from another device of mine')
        const carbon = u.toStanza(`
            <message xmlns="jabber:client" to="romeo@montague.lit/orchard" from="romeo@montague.lit" type="chat">
                <sent xmlns="urn:xmpp:carbons:2">
                    <forwarded xmlns="urn:xmpp:forward:0">
                    <message xmlns="jabber:client"
                             from="romeo@montague.lit/gajim.HE02SW1L"
                             xml:lang="en"
                             to="${contact_jid}/gajim.0LATM5V2"
                             type="chat" id="87141781-61d6-4eb3-9a31-429935a61b76">

                        <archived xmlns="urn:xmpp:mam:tmp" by="romeo@montague.lit" id="1554033877043470"/>
                        <stanza-id xmlns="urn:xmpp:sid:0" by="romeo@montague.lit" id="1554033877043470"/>
                        <request xmlns="urn:xmpp:receipts"/>
                        <active xmlns="http://jabber.org/protocol/chatstates"/>
                        <origin-id xmlns="urn:xmpp:sid:0" id="87141781-61d6-4eb3-9a31-429935a61b76"/>
                        <encrypted xmlns="eu.siacs.conversations.axolotl">
                            <header sid="988349631">
                                <key rid="${_converse.omemo_store.get('device_id')}"
                                     prekey="true">${u.arrayBufferToBase64(obj.key_and_tag)}</key>
                                <iv>${obj.iv}</iv>
                            </header>
                            <payload>${obj.payload}</payload>
                        </encrypted>
                        <encryption xmlns="urn:xmpp:eme:0" namespace="eu.siacs.conversations.axolotl" name="OMEMO"/>
                        <store xmlns="urn:xmpp:hints"/>
                    </message>
                    </forwarded>
                </sent>
            </message>
        `);
        _converse.connection.IQ_stanzas = [];
        _converse.connection._dataRecv(mock.createRequest(carbon));

        // The message received is a prekey message, so missing prekeys are
        // generated and a new bundle published.
        iq_stanza = await u.waitUntil(() => mock.bundleHasBeenPublished(_converse));
        const result_iq = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(mock.createRequest(result_iq));

        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.model.messages.length).toBe(1);

        expect(view.querySelector('.chat-msg__text').textContent.trim())
            .toBe('This is an encrypted carbon message from another device of mine');

        expect(contact_devicelist.devices.length).toBe(1);

        // Check that the new device id has been added to my devices
        expect(my_devicelist.devices.length).toBe(3);
        expect(my_devicelist.devices.at(0).get('id')).toBe('482886413b977930064a5888b92134fe');
        expect(my_devicelist.devices.at(1).get('id')).toBe('123456789');
        expect(my_devicelist.devices.at(2).get('id')).toBe('988349631');
        expect(my_devicelist.devices.get('988349631').get('active')).toBe(true);

        const textarea = view.querySelector('.chat-textarea');
        textarea.value = 'This is an encrypted message from this device';
        const message_form = view.querySelector('converse-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        iq_stanza = await u.waitUntil(() => mock.bundleFetched(_converse, _converse.bare_jid, '988349631'));
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="${_converse.bare_jid}" type="get" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<items node="eu.siacs.conversations.axolotl.bundles:988349631"/>`+
                `</pubsub>`+
            `</iq>`);
    }));

    it("can receive a PreKeySignalMessage",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        _converse.NUM_PREKEYS = 5; // Restrict to 5, otherwise the resulting stanza is too large to easily test
        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        await u.waitUntil(() => mock.initializedOMEMO(_converse));
        const obj = await omemo.encryptMessage('This is an encrypted message from the contact');
        // XXX: Normally the key will be encrypted via libsignal.
        // However, we're mocking libsignal in the tests, so we include
        // it as plaintext in the message.
        let stanza = $msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                'id': 'qwerty'
            }).c('body').t('This is a fallback message').up()
                .c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                    .c('header', {'sid':  '555'})
                        .c('key', {
                            'prekey': 'true',
                            'rid':  _converse.omemo_store.get('device_id')
                        }).t(u.arrayBufferToBase64(obj.key_and_tag)).up()
                        .c('iv').t(obj.iv)
                        .up().up()
                    .c('payload').t(obj.payload);

        const generateMissingPreKeys = _converse.omemo_store.generateMissingPreKeys;
        spyOn(_converse.omemo_store, 'generateMissingPreKeys').and.callFake(() => {
            // Since it's difficult to override
            // decryptPreKeyWhisperMessage, where a prekey will be
            // removed from the store, we do it here, before the
            // missing prekeys are generated.
            _converse.omemo_store.removePreKey(1);
            return generateMissingPreKeys.apply(_converse.omemo_store, arguments);
        });
        _converse.connection._dataRecv(mock.createRequest(stanza));

        let iq_stanza = await mock.deviceListFetched(_converse, contact_jid);
        stanza = $iq({
            'from': contact_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.connection.jid,
            'type': 'result',
        }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
            .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                    .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                        .c('device', {'id': '555'});

        // XXX: the bundle gets published twice, we want to make sure
        // that we wait for the 2nd, so we clear all the already sent
        // stanzas.
        _converse.connection.IQ_stanzas = [];
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.omemo_store);
        iq_stanza = await u.waitUntil(() => mock.bundleHasBeenPublished(_converse), 1000);
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" type="set" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<publish node="eu.siacs.conversations.axolotl.bundles:123456789">`+
                        `<item>`+
                            `<bundle xmlns="eu.siacs.conversations.axolotl">`+
                                `<signedPreKeyPublic signedPreKeyId="0">${btoa("1234")}</signedPreKeyPublic>`+
                                    `<signedPreKeySignature>${btoa("11112222333344445555")}</signedPreKeySignature>`+
                                    `<identityKey>${btoa("1234")}</identityKey>`+
                                `<prekeys>`+
                                    `<preKeyPublic preKeyId="0">${btoa("1234")}</preKeyPublic>`+
                                    `<preKeyPublic preKeyId="1">${btoa("1234")}</preKeyPublic>`+
                                    `<preKeyPublic preKeyId="2">${btoa("1234")}</preKeyPublic>`+
                                    `<preKeyPublic preKeyId="3">${btoa("1234")}</preKeyPublic>`+
                                    `<preKeyPublic preKeyId="4">${btoa("1234")}</preKeyPublic>`+
                                `</prekeys>`+
                            `</bundle>`+
                        `</item>`+
                    `</publish>`+
                    `<publish-options>`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>http://jabber.org/protocol/pubsub#publish-options</value>`+
                            `</field>`+
                            `<field var="pubsub#access_model">`+
                                `<value>open</value>`+
                            `</field>`+
                        `</x>`+
                    `</publish-options>`+
                `</pubsub>`+
            `</iq>`)
        const own_device = _converse.devicelists.get(_converse.bare_jid).devices.get(_converse.omemo_store.get('device_id'));
        expect(own_device.get('bundle').prekeys.length).toBe(5);
        expect(_converse.omemo_store.generateMissingPreKeys).toHaveBeenCalled();
    }));

    it("updates device lists based on PEP messages",
            mock.initConverse([], {'allow_non_roster_messaging': true}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);

        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        // Wait until own devices are fetched
        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, _converse.bare_jid));
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                `</pubsub>`+
            `</iq>`);

        let stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result',
        }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
            .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                    .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                        .c('device', {'id': '555'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.omemo_store);
        expect(_converse.chatboxes.length).toBe(1);
        expect(_converse.devicelists.length).toBe(1);
        const devicelist = _converse.devicelists.get(_converse.bare_jid);
        expect(devicelist.devices.length).toBe(2);
        expect(devicelist.devices.at(0).get('id')).toBe('555');
        expect(devicelist.devices.at(1).get('id')).toBe('123456789');
        iq_stanza = await u.waitUntil(() => mock.ownDeviceHasBeenPublished(_converse));
        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        iq_stanza = await u.waitUntil(() => mock.bundleHasBeenPublished(_converse));

        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await _converse.api.waitUntil('OMEMOInitialized');


        // A PEP message is received with a device list.
        _converse.connection._dataRecv(mock.createRequest($msg({
            'from': contact_jid,
            'to': _converse.bare_jid,
            'type': 'headline',
            'id': 'update_01',
        }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
            .c('items', {'node': 'eu.siacs.conversations.axolotl.devicelist'})
                .c('item')
                    .c('list', {'xmlns': 'eu.siacs.conversations.axolotl'})
                        .c('device', {'id': '1234'}).up()
                        .c('device', {'id': '4223'})
        ));

        // Since we haven't yet fetched any devices for this user, the
        // devicelist model for them isn't yet initialized.
        // It will be created and then automatically the devices will
        // be requested from the server via IQ stanza.
        //
        // This is perhaps a bit wasteful since we're already (AFIAK) getting the info we need
        // from the PEP headline message, but the code is simpler this way.
        const iq_devicelist_get = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        _converse.connection._dataRecv(mock.createRequest($iq({
                'from': contact_jid,
                'id': iq_devicelist_get.getAttribute('id'),
                'to': _converse.connection.jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '1234'}).up()
                            .c('device', {'id': '4223'})
        ));

        await u.waitUntil(() => _converse.devicelists.length === 2);

        const list = _converse.devicelists.get(contact_jid);
        await list.initialized;
        await u.waitUntil(() => list.devices.length === 2);

        let devices = list.devices;
        expect(list.devices.length).toBe(2);
        expect(list.devices.models.map(d => d.attributes.id).sort().join()).toBe('1234,4223');

        stanza = $msg({
            'from': contact_jid,
            'to': _converse.bare_jid,
            'type': 'headline',
            'id': 'update_02',
        }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
            .c('items', {'node': 'eu.siacs.conversations.axolotl.devicelist'})
                .c('item')
                    .c('list', {'xmlns': 'eu.siacs.conversations.axolotl'})
                        .c('device', {'id': '4223'}).up()
                        .c('device', {'id': '4224'})
        _converse.connection._dataRecv(mock.createRequest(stanza));

        expect(_converse.devicelists.length).toBe(2);
        await u.waitUntil(() => list.devices.length === 3);
        expect(devices.models.map(d => d.attributes.id).sort().join()).toBe('1234,4223,4224');
        expect(devices.get('1234').get('active')).toBe(false);
        expect(devices.get('4223').get('active')).toBe(true);
        expect(devices.get('4224').get('active')).toBe(true);

        // Check that own devicelist gets updated
        stanza = $msg({
            'from': _converse.bare_jid,
            'to': _converse.bare_jid,
            'type': 'headline',
            'id': 'update_03',
        }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
            .c('items', {'node': 'eu.siacs.conversations.axolotl.devicelist'})
                .c('item')
                    .c('list', {'xmlns': 'eu.siacs.conversations.axolotl'})
                        .c('device', {'id': '123456789'})
                        .c('device', {'id': '555'})
                        .c('device', {'id': '777'})
        _converse.connection._dataRecv(mock.createRequest(stanza));

        expect(_converse.devicelists.length).toBe(2);
        devices = _converse.devicelists.get(_converse.bare_jid).devices;
        await u.waitUntil(() => devices.length === 3);
        expect(devices.models.map(d => d.attributes.id).sort().join()).toBe('123456789,555,777');
        expect(devices.get('123456789').get('active')).toBe(true);
        expect(devices.get('555').get('active')).toBe(true);
        expect(devices.get('777').get('active')).toBe(true);

        _converse.connection.IQ_stanzas = [];

        // Check that own device gets re-added
        stanza = $msg({
            'from': _converse.bare_jid,
            'to': _converse.bare_jid,
            'type': 'headline',
            'id': 'update_04',
        }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
            .c('items', {'node': 'eu.siacs.conversations.axolotl.devicelist'})
                .c('item')
                    .c('list', {'xmlns': 'eu.siacs.conversations.axolotl'})
                        .c('device', {'id': '444'})
        _converse.connection._dataRecv(mock.createRequest(stanza));

        iq_stanza = await u.waitUntil(() => mock.ownDeviceHasBeenPublished(_converse));
        // Check that our own device is added again, but that removed
        // devices are not added.
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute(`id`)}" type="set" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<publish node="eu.siacs.conversations.axolotl.devicelist">`+
                        `<item id="current">`+
                            `<list xmlns="eu.siacs.conversations.axolotl">`+
                                `<device id="123456789"/>`+
                                `<device id="444"/>`+
                            `</list>`+
                        `</item>`+
                    `</publish>`+
                    `<publish-options>`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>http://jabber.org/protocol/pubsub#publish-options</value>`+
                            `</field>`+
                            `<field var="pubsub#access_model">`+
                                `<value>open</value>`+
                            `</field>`+
                        `</x>`+
                    `</publish-options>`+
                `</pubsub>`+
            `</iq>`);
        expect(_converse.devicelists.length).toBe(2);
        devices = _converse.devicelists.get(_converse.bare_jid).devices;
        // The device id for this device (123456789) was also generated and added to the list,
        // which is why we have 2 devices now.
        expect(devices.length).toBe(4);
        expect(devices.models.map(d => d.attributes.id).sort().join()).toBe('123456789,444,555,777');
        expect(devices.get('123456789').get('active')).toBe(true);
        expect(devices.get('444').get('active')).toBe(true);
        expect(devices.get('555').get('active')).toBe(false);
        expect(devices.get('777').get('active')).toBe(false);
    }));


    it("updates device bundles based on PEP messages",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');

        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );

        const contact_jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, _converse.bare_jid));
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                `</pubsub>`+
            `</iq>`);

        _converse.connection._dataRecv(mock.createRequest($iq({
            'from': contact_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result',
        }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
            .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                    .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                        .c('device', {'id': '555'})
        ));

        await await u.waitUntil(() => _converse.omemo_store);
        expect(_converse.devicelists.length).toBe(1);
        const own_device_list = _converse.devicelists.get(_converse.bare_jid);
        expect(own_device_list.devices.length).toBe(2);
        expect(own_device_list.devices.at(0).get('id')).toBe('555');
        expect(own_device_list.devices.at(1).get('id')).toBe('123456789');
        iq_stanza = await u.waitUntil(() => mock.ownDeviceHasBeenPublished(_converse));
        let stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        iq_stanza = await u.waitUntil(() => mock.bundleHasBeenPublished(_converse));
        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await _converse.api.waitUntil('OMEMOInitialized');

        _converse.connection._dataRecv(mock.createRequest($msg({
            'from': contact_jid,
            'to': _converse.bare_jid,
            'type': 'headline',
            'id': 'update_01',
        }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
            .c('items', {'node': 'eu.siacs.conversations.axolotl.bundles:1234'})
                .c('item')
                    .c('bundle', {'xmlns': 'eu.siacs.conversations.axolotl'})
                        .c('signedPreKeyPublic', {'signedPreKeyId': '4223'}).t('1111').up()
                        .c('signedPreKeySignature').t('2222').up()
                        .c('identityKey').t('3333').up()
                        .c('prekeys')
                            .c('preKeyPublic', {'preKeyId': '1001'}).up()
                            .c('preKeyPublic', {'preKeyId': '1002'}).up()
                            .c('preKeyPublic', {'preKeyId': '1003'})
        ));

        // Since we haven't yet fetched any devices for this user, the
        // devicelist model for them isn't yet initialized.
        // It will be created and then automatically the devices will
        // be requested from the server via IQ stanza.
        const iq_devicelist_get = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        _converse.connection._dataRecv(mock.createRequest($iq({
                'from': contact_jid,
                'id': iq_devicelist_get.getAttribute('id'),
                'to': _converse.connection.jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '1234'})
        ));

        await u.waitUntil(() => _converse.devicelists.length === 2);
        const list = _converse.devicelists.get(contact_jid);
        await list.initialized;
        await u.waitUntil(() => list.devices.length);
        let device = list.devices.at(0);
        expect(device.get('bundle').identity_key).toBe('3333');
        expect(device.get('bundle').signed_prekey.public_key).toBe('1111');
        expect(device.get('bundle').signed_prekey.id).toBe(4223);
        expect(device.get('bundle').signed_prekey.signature).toBe('2222');
        expect(device.get('bundle').prekeys.length).toBe(3);
        expect(device.get('bundle').prekeys[0].id).toBe(1001);
        expect(device.get('bundle').prekeys[1].id).toBe(1002);
        expect(device.get('bundle').prekeys[2].id).toBe(1003);

        stanza = $msg({
            'from': contact_jid,
            'to': _converse.bare_jid,
            'type': 'headline',
            'id': 'update_02',
        }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
            .c('items', {'node': 'eu.siacs.conversations.axolotl.bundles:1234'})
                .c('item')
                    .c('bundle', {'xmlns': 'eu.siacs.conversations.axolotl'})
                        .c('signedPreKeyPublic', {'signedPreKeyId': '4223'}).t('5555').up()
                        .c('signedPreKeySignature').t('6666').up()
                        .c('identityKey').t('7777').up()
                        .c('prekeys')
                            .c('preKeyPublic', {'preKeyId': '2001'}).up()
                            .c('preKeyPublic', {'preKeyId': '2002'}).up()
                            .c('preKeyPublic', {'preKeyId': '2003'});
        _converse.connection._dataRecv(mock.createRequest(stanza));

        expect(_converse.devicelists.length).toBe(2);
        expect(list.devices.length).toBe(1);
        device = list.devices.at(0);

        await u.waitUntil(() => device.get('bundle').identity_key === '7777');
        expect(device.get('bundle').signed_prekey.public_key).toBe('5555');
        expect(device.get('bundle').signed_prekey.id).toBe(4223);
        expect(device.get('bundle').signed_prekey.signature).toBe('6666');
        expect(device.get('bundle').prekeys.length).toBe(3);
        expect(device.get('bundle').prekeys[0].id).toBe(2001);
        expect(device.get('bundle').prekeys[1].id).toBe(2002);
        expect(device.get('bundle').prekeys[2].id).toBe(2003);

        _converse.connection._dataRecv(mock.createRequest($msg({
            'from': _converse.bare_jid,
            'to': _converse.bare_jid,
            'type': 'headline',
            'id': 'update_03',
        }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
            .c('items', {'node': 'eu.siacs.conversations.axolotl.bundles:555'})
                .c('item')
                    .c('bundle', {'xmlns': 'eu.siacs.conversations.axolotl'})
                        .c('signedPreKeyPublic', {'signedPreKeyId': '9999'}).t('8888').up()
                        .c('signedPreKeySignature').t('3333').up()
                        .c('identityKey').t('1111').up()
                        .c('prekeys')
                            .c('preKeyPublic', {'preKeyId': '3001'}).up()
                            .c('preKeyPublic', {'preKeyId': '3002'}).up()
                            .c('preKeyPublic', {'preKeyId': '3003'})
        ));

        expect(_converse.devicelists.length).toBe(2);
        expect(own_device_list.devices.length).toBe(2);
        expect(own_device_list.devices.at(0).get('id')).toBe('555');
        expect(own_device_list.devices.at(1).get('id')).toBe('123456789');
        device = own_device_list.devices.at(0);
        await u.waitUntil(() => device.get('bundle')?.identity_key === '1111');
        expect(device.get('bundle').signed_prekey.public_key).toBe('8888');
        expect(device.get('bundle').signed_prekey.id).toBe(9999);
        expect(device.get('bundle').signed_prekey.signature).toBe('3333');
        expect(device.get('bundle').prekeys.length).toBe(3);
        expect(device.get('bundle').prekeys[0].id).toBe(3001);
        expect(device.get('bundle').prekeys[1].id).toBe(3002);
        expect(device.get('bundle').prekeys[2].id).toBe(3003);
    }));

    it("publishes a bundle with which an encrypted session can be created",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );

        _converse.NUM_PREKEYS = 2; // Restrict to 2, otherwise the resulting stanza is too large to easily test

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, _converse.bare_jid));
        let stanza = $iq({
            'from': contact_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result',
        }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
            .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                    .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                        .c('device', {'id': '482886413b977930064a5888b92134fe'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(_converse.devicelists.length).toBe(1);
        await mock.openChatBoxFor(_converse, contact_jid);
        iq_stanza = await mock.ownDeviceHasBeenPublished(_converse);
        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(mock.createRequest(stanza));

        iq_stanza = await u.waitUntil(() => mock.bundleHasBeenPublished(_converse));
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" type="set" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<publish node="eu.siacs.conversations.axolotl.bundles:123456789">`+
                        `<item>`+
                            `<bundle xmlns="eu.siacs.conversations.axolotl">`+
                                `<signedPreKeyPublic signedPreKeyId="0">${btoa("1234")}</signedPreKeyPublic>`+
                                    `<signedPreKeySignature>${btoa("11112222333344445555")}</signedPreKeySignature>`+
                                    `<identityKey>${btoa("1234")}</identityKey>`+
                                `<prekeys>`+
                                    `<preKeyPublic preKeyId="0">${btoa("1234")}</preKeyPublic>`+
                                    `<preKeyPublic preKeyId="1">${btoa("1234")}</preKeyPublic>`+
                                `</prekeys>`+
                            `</bundle>`+
                        `</item>`+
                    `</publish>`+
                    `<publish-options>`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>http://jabber.org/protocol/pubsub#publish-options</value>`+
                            `</field>`+
                            `<field var="pubsub#access_model">`+
                                `<value>open</value>`+
                            `</field>`+
                        `</x>`+
                    `</publish-options>`+
                `</pubsub>`+
            `</iq>`)

        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await _converse.api.waitUntil('OMEMOInitialized');
    }));


    it("adds a toolbar button for starting an encrypted chat session",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, _converse.bare_jid));
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                `</pubsub>`+
            `</iq>`);

        let stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result',
        }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
            .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                    .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                        .c('device', {'id': '482886413b977930064a5888b92134fe'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.omemo_store);
        expect(_converse.devicelists.length).toBe(1);
        let devicelist = _converse.devicelists.get(_converse.bare_jid);
        expect(devicelist.devices.length).toBe(2);
        expect(devicelist.devices.at(0).get('id')).toBe('482886413b977930064a5888b92134fe');
        expect(devicelist.devices.at(1).get('id')).toBe('123456789');
        // Check that own device was published
        iq_stanza = await u.waitUntil(() => mock.ownDeviceHasBeenPublished(_converse));
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute(`id`)}" type="set" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<publish node="eu.siacs.conversations.axolotl.devicelist">`+
                        `<item id="current">`+
                            `<list xmlns="eu.siacs.conversations.axolotl">`+
                                `<device id="482886413b977930064a5888b92134fe"/>`+
                                `<device id="123456789"/>`+
                            `</list>`+
                        `</item>`+
                    `</publish>`+
                    `<publish-options>`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>http://jabber.org/protocol/pubsub#publish-options</value>`+
                            `</field>`+
                            `<field var="pubsub#access_model">`+
                                `<value>open</value>`+
                            `</field>`+
                        `</x>`+
                    `</publish-options>`+
                `</pubsub>`+
            `</iq>`);

        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(mock.createRequest(stanza));

        const iq_el = await u.waitUntil(() => mock.bundleHasBeenPublished(_converse));
        expect(iq_el.getAttributeNames().sort().join()).toBe(["from", "type", "xmlns", "id"].sort().join());
        expect(iq_el.querySelector('prekeys').childNodes.length).toBe(100);

        const signed_prekeys = iq_el.querySelectorAll('signedPreKeyPublic');
        expect(signed_prekeys.length).toBe(1);
        const signed_prekey = signed_prekeys[0];
        expect(signed_prekey.getAttribute('signedPreKeyId')).toBe('0')
        expect(iq_el.querySelectorAll('signedPreKeySignature').length).toBe(1);
        expect(iq_el.querySelectorAll('identityKey').length).toBe(1);

        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_el.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await _converse.api.waitUntil('OMEMOInitialized', 1000);
        await mock.openChatBoxFor(_converse, contact_jid);

        iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="${contact_jid}" type="get" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                `</pubsub>`+
            `</iq>`);

        _converse.connection._dataRecv(mock.createRequest($iq({
            'from': contact_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result',
        }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
            .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                    .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                        .c('device', {'id': '368866411b877c30064a5f62b917cffe'}).up()
                        .c('device', {'id': '3300659945416e274474e469a1f0154c'}).up()
                        .c('device', {'id': '4e30f35051b7b8b42abe083742187228'}).up()
                        .c('device', {'id': 'ae890ac52d0df67ed7cfdf51b644e901'})
        ));

        devicelist = _converse.devicelists.get(contact_jid);
        await u.waitUntil(() => devicelist.devices.length);
        expect(_converse.devicelists.length).toBe(2);
        devicelist = _converse.devicelists.get(contact_jid);
        expect(devicelist.devices.length).toBe(4);
        expect(devicelist.devices.at(0).get('id')).toBe('368866411b877c30064a5f62b917cffe');
        expect(devicelist.devices.at(1).get('id')).toBe('3300659945416e274474e469a1f0154c');
        expect(devicelist.devices.at(2).get('id')).toBe('4e30f35051b7b8b42abe083742187228');
        expect(devicelist.devices.at(3).get('id')).toBe('ae890ac52d0df67ed7cfdf51b644e901');
        await u.waitUntil(() => _converse.chatboxviews.get(contact_jid).querySelector('.chat-toolbar'));
        const view = _converse.chatboxviews.get(contact_jid);
        const toolbar = view.querySelector('.chat-toolbar');
        expect(view.model.get('omemo_active')).toBe(undefined);
        const toggle = toolbar.querySelector('.toggle-omemo');
        expect(toggle === null).toBe(false);
        expect(u.hasClass('fa-unlock', toggle.querySelector('converse-icon'))).toBe(true);
        expect(u.hasClass('fa-lock', toggle.querySelector('.converse-icon'))).toBe(false);
        toolbar.querySelector('.toggle-omemo').click();
        expect(view.model.get('omemo_active')).toBe(true);

        await u.waitUntil(() => u.hasClass('fa-lock', toolbar.querySelector('.toggle-omemo converse-icon')));
        let icon = toolbar.querySelector('.toggle-omemo converse-icon');
        expect(u.hasClass('fa-unlock', icon)).toBe(false);
        expect(u.hasClass('fa-lock', icon)).toBe(true);

        const textarea = view.querySelector('.chat-textarea');
        textarea.value = 'This message will be sent encrypted';
        const message_form = view.querySelector('converse-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13
        });

        view.model.save({'omemo_supported': false});
        await u.waitUntil(() => toolbar.querySelector('.toggle-omemo')?.dataset.disabled === "true");
        icon = await u.waitUntil(() => toolbar.querySelector('.toggle-omemo converse-icon'));
        expect(u.hasClass('fa-lock', icon)).toBe(false);
        expect(u.hasClass('fa-unlock', icon)).toBe(true);

        view.model.save({'omemo_supported': true});
        await u.waitUntil(() => toolbar.querySelector('.toggle-omemo')?.dataset.disabled === "false");
        icon = toolbar.querySelector('.toggle-omemo converse-icon');
        expect(u.hasClass('fa-lock', icon)).toBe(false);
        expect(u.hasClass('fa-unlock', icon)).toBe(true);
    }));

    it("shows OMEMO device fingerprints in the user details modal",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);

        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)
        // We simply emit, to avoid doing all the setup work
        _converse.api.trigger('OMEMOInitialized');

        const view = _converse.chatboxviews.get(contact_jid);
        const show_modal_button = view.querySelector('.show-user-details-modal');
        show_modal_button.click();
        const modal = _converse.api.modal.get('converse-user-details-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="mercutio@montague.lit" type="get" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub"><items node="eu.siacs.conversations.axolotl.devicelist"/></pubsub>`+
            `</iq>`);

        _converse.connection._dataRecv(mock.createRequest($iq({
            'from': contact_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result',
        }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
            .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                    .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                        .c('device', {'id': '555'})
        ));

        await u.waitUntil(() => u.isVisible(modal), 1000);

        iq_stanza = await u.waitUntil(() => mock.bundleFetched(_converse, contact_jid, '555'));
        expect(Strophe.serialize(iq_stanza)).toBe(
            `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="mercutio@montague.lit" type="get" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<items node="eu.siacs.conversations.axolotl.bundles:555"/>`+
                `</pubsub>`+
            `</iq>`);

        _converse.connection._dataRecv(mock.createRequest($iq({
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
                        .c('identityKey').t('BQmHEOHjsYm3w5M8VqxAtqJmLCi7CaxxsdZz6G0YpuMI').up()
                        .c('prekeys')
                            .c('preKeyPublic', {'preKeyId': '1'}).t(btoa('1001')).up()
                            .c('preKeyPublic', {'preKeyId': '2'}).t(btoa('1002')).up()
                            .c('preKeyPublic', {'preKeyId': '3'}).t(btoa('1003'))
        ));

        await u.waitUntil(() => modal.querySelectorAll('.fingerprints .fingerprint').length);
        expect(modal.querySelectorAll('.fingerprints .fingerprint').length).toBe(1);
        const el = modal.querySelector('.fingerprints .fingerprint');
        expect(el.textContent.trim()).toBe(
            omemo.formatFingerprint(u.arrayBufferToHex(u.base64ToArrayBuffer('BQmHEOHjsYm3w5M8VqxAtqJmLCi7CaxxsdZz6G0YpuMI')))
        );
        expect(modal.querySelectorAll('input[type="radio"]').length).toBe(2);

        const devicelist = _converse.devicelists.get(contact_jid);
        expect(devicelist.devices.get('555').get('trusted')).toBe(0);

        let trusted_radio = modal.querySelector('input[type="radio"][name="555"][value="1"]');
        expect(trusted_radio.checked).toBe(true);

        let untrusted_radio = modal.querySelector('input[type="radio"][name="555"][value="-1"]');
        expect(untrusted_radio.checked).toBe(false);

        // Test that the device can be set to untrusted
        untrusted_radio.click();
        trusted_radio = document.querySelector('input[type="radio"][name="555"][value="1"]');

        await u.waitUntil(() => !trusted_radio.hasAttribute('checked'));
        expect(devicelist.devices.get('555').get('trusted')).toBe(-1);

        untrusted_radio = document.querySelector('input[type="radio"][name="555"][value="-1"]');
        expect(untrusted_radio.hasAttribute('checked')).toBe(true);

        trusted_radio.click();
        expect(devicelist.devices.get('555').get('trusted')).toBe(1);
    }));
});
