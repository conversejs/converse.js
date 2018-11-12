(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    var Strophe = converse.env.Strophe;
    var b64_sha1 = converse.env.b64_sha1;
    var $iq = converse.env.$iq;
    var $msg = converse.env.$msg;
    var _ = converse.env._;
    var u = converse.env.utils;


    function deviceListFetched (_converse, jid) {
        return _.filter(
            _converse.connection.IQ_stanzas,
            iq => iq.nodeTree.querySelector(`iq[to="${jid}"] items[node="eu.siacs.conversations.axolotl.devicelist"]`)
        ).pop();
    }

    function ownDeviceHasBeenPublished (_converse) {
        return _.filter(
            _converse.connection.IQ_stanzas,
            iq => iq.nodeTree.querySelector('iq[from="'+_converse.bare_jid+'"] publish[node="eu.siacs.conversations.axolotl.devicelist"]')
        ).pop();
    }

    function bundleHasBeenPublished (_converse) {
        return _.filter(
            _converse.connection.IQ_stanzas,
            iq => iq.nodeTree.querySelector('publish[node="eu.siacs.conversations.axolotl.bundles:123456789"]')
        ).pop();
    }

    function bundleFetched (_converse, jid, device_id) {
        return _.filter(
            _converse.connection.IQ_stanzas,
            (iq) => iq.nodeTree.querySelector(`iq[to="${jid}"] items[node="eu.siacs.conversations.axolotl.bundles:${device_id}"]`)
        ).pop();
    }

    async function initializedOMEMO (_converse) {
        let iq_stanza = await test_utils.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
        let stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.nodeTree.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result',
        }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
            .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                    .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                        .c('device', {'id': '482886413b977930064a5888b92134fe'});
        _converse.connection._dataRecv(test_utils.createRequest(stanza));
        iq_stanza = await test_utils.waitUntil(() => ownDeviceHasBeenPublished(_converse))

        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.nodeTree.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(test_utils.createRequest(stanza));
        iq_stanza = await test_utils.waitUntil(() => bundleHasBeenPublished(_converse))

        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.nodeTree.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(test_utils.createRequest(stanza));
        await _converse.api.waitUntil('OMEMOInitialized');
    }


    describe("The OMEMO module", function() {

        it("adds methods for encrypting and decrypting messages via AES GCM",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const message = 'This message will be encrypted'
            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            const view = await test_utils.openChatBoxFor(_converse, contact_jid);
            const payload = await view.model.encryptMessage(message);
            const result = await view.model.decryptMessage(payload);
            expect(result).toBe(message);
            done();
        }));


        it("enables encrypted messages to be sent and received",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            let sent_stanza;
            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.waitUntil(() => initializedOMEMO(_converse));
            await test_utils.openChatBoxFor(_converse, contact_jid);
            let iq_stanza = await test_utils.waitUntil(() => deviceListFetched(_converse, contact_jid));
            let stanza = $iq({
                    'from': contact_jid,
                    'id': iq_stanza.nodeTree.getAttribute('id'),
                    'to': _converse.connection.jid,
                    'type': 'result',
                }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                    .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                        .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                            .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                                .c('device', {'id': '555'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.omemo_store);
            const devicelist = _converse.devicelists.get({'jid': contact_jid});
            expect(devicelist.devices.length).toBe(1);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);

            const textarea = view.el.querySelector('.chat-textarea');
            textarea.value = 'This message will be encrypted';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            iq_stanza = await test_utils.waitUntil(() => bundleFetched(_converse, contact_jid, '555'));
            stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            iq_stanza = await test_utils.waitUntil(() => bundleFetched(_converse, _converse.bare_jid, '482886413b977930064a5888b92134fe'));
            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => sent_stanza);
            expect(sent_stanza.toLocaleString()).toBe(
                `<message from="dummy@localhost/resource" id="${sent_stanza.nodeTree.getAttribute("id")}" `+
                            `to="max.frankfurter@localhost" `+
                            `type="chat" xmlns="jabber:client">`+
                    `<body>This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo</body>`+
                    `<request xmlns="urn:xmpp:receipts"/>`+
                    `<encrypted xmlns="eu.siacs.conversations.axolotl">`+
                        `<header sid="123456789">`+
                            `<key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>`+
                            `<key rid="555">YzFwaDNSNzNYNw==</key>`+
                            `<iv>${sent_stanza.nodeTree.querySelector("iv").textContent}</iv>`+
                        `</header>`+
                        `<payload>${sent_stanza.nodeTree.querySelector("payload").textContent}</payload>`+
                    `</encrypted>`+
                    `<store xmlns="urn:xmpp:hints"/>`+
                `</message>`);

            // Test reception of an encrypted message
            let obj = await view.model.encryptMessage('This is an encrypted message from the contact')
            // XXX: Normally the key will be encrypted via libsignal.
            // However, we're mocking libsignal in the tests, so we include
            // it as plaintext in the message.
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.model.messages.length).toBe(2);
            expect(view.el.querySelectorAll('.chat-msg__body')[1].textContent.trim())
                .toBe('This is an encrypted message from the contact');

            // #1193 Check for a received message without <body> tag
            obj = await view.model.encryptMessage('Another received encrypted message without fallback')
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            await test_utils.waitUntil(() => view.model.messages.length > 1);
            expect(view.model.messages.length).toBe(3);
            expect(view.el.querySelectorAll('.chat-msg__body')[2].textContent.trim())
                .toBe('Another received encrypted message without fallback');
            done();
        }));


        it("can receive a PreKeySignalMessage",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            _converse.NUM_PREKEYS = 5; // Restrict to 5, otherwise the resulting stanza is too large to easily test
            let view, sent_stanza;
            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

            await test_utils.waitUntil(() => initializedOMEMO(_converse));
            const obj = await _converse.ChatBox.prototype.encryptMessage('This is an encrypted message from the contact');
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            let iq_stanza = await test_utils.waitUntil(() => _converse.chatboxviews.get(contact_jid));
            iq_stanza = await deviceListFetched(_converse, contact_jid);
            stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.omemo_store);
            iq_stanza = await test_utils.waitUntil(() => bundleHasBeenPublished(_converse));
            expect(iq_stanza.toLocaleString()).toBe(
                `<iq from="dummy@localhost" id="${iq_stanza.nodeTree.getAttribute("id")}" type="set" xmlns="jabber:client">`+
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
                    `</pubsub>`+
                `</iq>`)
            const own_device = _converse.devicelists.get(_converse.bare_jid).devices.get(_converse.omemo_store.get('device_id'));
            expect(own_device.get('bundle').prekeys.length).toBe(5);
            expect(_converse.omemo_store.generateMissingPreKeys).toHaveBeenCalled();
            done();
        }));


        it("updates device lists based on PEP messages",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {'allow_non_roster_messaging': true},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

            // Wait until own devices are fetched
            let iq_stanza = await test_utils.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
            expect(iq_stanza.toLocaleString()).toBe(
                `<iq from="dummy@localhost" id="${iq_stanza.nodeTree.getAttribute("id")}" to="dummy@localhost" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</pubsub>`+
                `</iq>`);

            let stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '555'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.omemo_store);
            expect(_converse.chatboxes.length).toBe(1);
            expect(_converse.devicelists.length).toBe(1);
            const devicelist = _converse.devicelists.get(_converse.bare_jid);
            expect(devicelist.devices.length).toBe(2);
            expect(devicelist.devices.at(0).get('id')).toBe('555');
            expect(devicelist.devices.at(1).get('id')).toBe('123456789');
            iq_stanza = await test_utils.waitUntil(() => ownDeviceHasBeenPublished(_converse));
            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            iq_stanza = await test_utils.waitUntil(() => bundleHasBeenPublished(_converse));

            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await _converse.api.waitUntil('OMEMOInitialized');

            stanza = $msg({
                'from': contact_jid,
                'to': _converse.bare_jid,
                'type': 'headline',
                'id': 'update_01',
            }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
                .c('items', {'node': 'eu.siacs.conversations.axolotl.devicelist'})
                    .c('item')
                        .c('list', {'xmlns': 'eu.siacs.conversations.axolotl'})
                            .c('device', {'id': '1234'})
                            .c('device', {'id': '4223'})
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            expect(_converse.devicelists.length).toBe(2);
            let devices = _converse.devicelists.get(contact_jid).devices;
            expect(devices.length).toBe(2);
            expect(_.map(devices.models, 'attributes.id').sort().join()).toBe('1234,4223');

            stanza = $msg({
                'from': contact_jid,
                'to': _converse.bare_jid,
                'type': 'headline',
                'id': 'update_02',
            }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
                .c('items', {'node': 'eu.siacs.conversations.axolotl.devicelist'})
                    .c('item')
                        .c('list', {'xmlns': 'eu.siacs.conversations.axolotl'})
                            .c('device', {'id': '4223'})
                            .c('device', {'id': '4224'})
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            expect(_converse.devicelists.length).toBe(2);
            expect(devices.length).toBe(2);
            expect(_.map(devices.models, 'attributes.id').sort().join()).toBe('4223,4224');

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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            expect(_converse.devicelists.length).toBe(2);
            devices = _converse.devicelists.get(_converse.bare_jid).devices;
            expect(devices.length).toBe(3);
            expect(_.map(devices.models, 'attributes.id').sort().join()).toBe('123456789,555,777');

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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            iq_stanza = await test_utils.waitUntil(() => ownDeviceHasBeenPublished(_converse));
            // Check that our own device is added again, but that removed
            // devices are not added.
            expect(iq_stanza.toLocaleString()).toBe(
                `<iq from="dummy@localhost" id="${iq_stanza.nodeTree.getAttribute(`id`)}" type="set" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<publish node="eu.siacs.conversations.axolotl.devicelist">`+
                            `<item>`+
                                `<list xmlns="eu.siacs.conversations.axolotl">`+
                                    `<device id="123456789"/>`+
                                    `<device id="444"/>`+
                                `</list>`+
                            `</item>`+
                        `</publish>`+
                    `</pubsub>`+
                `</iq>`);
            expect(_converse.devicelists.length).toBe(2);
            devices = _converse.devicelists.get(_converse.bare_jid).devices;
            // The device id for this device (123456789) was also generated and added to the list,
            // which is why we have 2 devices now.
            expect(devices.length).toBe(2);
            expect(_.map(devices.models, 'attributes.id').sort().join()).toBe('123456789,444');
            done();
        }));


        it("updates device bundles based on PEP messages",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            const contact_jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@localhost';
            let iq_stanza = await test_utils.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
            expect(iq_stanza.toLocaleString()).toBe(
                `<iq from="dummy@localhost" id="${iq_stanza.nodeTree.getAttribute("id")}" to="dummy@localhost" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</pubsub>`+
                `</iq>`);

            let stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '555'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await await test_utils.waitUntil(() => _converse.omemo_store);
            expect(_converse.devicelists.length).toBe(1);
            let devicelist = _converse.devicelists.get(_converse.bare_jid);
            expect(devicelist.devices.length).toBe(2);
            expect(devicelist.devices.at(0).get('id')).toBe('555');
            expect(devicelist.devices.at(1).get('id')).toBe('123456789');
            iq_stanza = await test_utils.waitUntil(() => ownDeviceHasBeenPublished(_converse));
            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            iq_stanza = await test_utils.waitUntil(() => bundleHasBeenPublished(_converse));
            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await _converse.api.waitUntil('OMEMOInitialized');
            stanza = $msg({
                'from': contact_jid,
                'to': _converse.bare_jid,
                'type': 'headline',
                'id': 'update_01',
            }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
                .c('items', {'node': 'eu.siacs.conversations.axolotl.bundles:555'})
                    .c('item')
                        .c('bundle', {'xmlns': 'eu.siacs.conversations.axolotl'})
                            .c('signedPreKeyPublic', {'signedPreKeyId': '4223'}).t('1111').up()
                            .c('signedPreKeySignature').t('2222').up()
                            .c('identityKey').t('3333').up()
                            .c('prekeys')
                                .c('preKeyPublic', {'preKeyId': '1001'}).up()
                                .c('preKeyPublic', {'preKeyId': '1002'}).up()
                                .c('preKeyPublic', {'preKeyId': '1003'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            expect(_converse.devicelists.length).toBe(2);
            devicelist = _converse.devicelists.get(contact_jid);
            expect(devicelist.devices.length).toBe(1);
            let device = devicelist.devices.at(0);
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
                .c('items', {'node': 'eu.siacs.conversations.axolotl.bundles:555'})
                    .c('item')
                        .c('bundle', {'xmlns': 'eu.siacs.conversations.axolotl'})
                            .c('signedPreKeyPublic', {'signedPreKeyId': '4223'}).t('5555').up()
                            .c('signedPreKeySignature').t('6666').up()
                            .c('identityKey').t('7777').up()
                            .c('prekeys')
                                .c('preKeyPublic', {'preKeyId': '2001'}).up()
                                .c('preKeyPublic', {'preKeyId': '2002'}).up()
                                .c('preKeyPublic', {'preKeyId': '2003'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            expect(_converse.devicelists.length).toBe(2);
            devicelist = _converse.devicelists.get(contact_jid);
            expect(devicelist.devices.length).toBe(1);
            device = devicelist.devices.at(0);
            expect(device.get('bundle').identity_key).toBe('7777');
            expect(device.get('bundle').signed_prekey.public_key).toBe('5555');
            expect(device.get('bundle').signed_prekey.id).toBe(4223);
            expect(device.get('bundle').signed_prekey.signature).toBe('6666');
            expect(device.get('bundle').prekeys.length).toBe(3);
            expect(device.get('bundle').prekeys[0].id).toBe(2001);
            expect(device.get('bundle').prekeys[1].id).toBe(2002);
            expect(device.get('bundle').prekeys[2].id).toBe(2003);

            stanza = $msg({
                'from': _converse.bare_jid,
                'to': _converse.bare_jid,
                'type': 'headline',
                'id': 'update_03',
            }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
                .c('items', {'node': 'eu.siacs.conversations.axolotl.bundles:123456789'})
                    .c('item')
                        .c('bundle', {'xmlns': 'eu.siacs.conversations.axolotl'})
                            .c('signedPreKeyPublic', {'signedPreKeyId': '9999'}).t('8888').up()
                            .c('signedPreKeySignature').t('3333').up()
                            .c('identityKey').t('1111').up()
                            .c('prekeys')
                                .c('preKeyPublic', {'preKeyId': '3001'}).up()
                                .c('preKeyPublic', {'preKeyId': '3002'}).up()
                                .c('preKeyPublic', {'preKeyId': '3003'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            expect(_converse.devicelists.length).toBe(2);
            devicelist = _converse.devicelists.get(_converse.bare_jid);
            expect(devicelist.devices.length).toBe(2);
            expect(devicelist.devices.at(0).get('id')).toBe('555');
            expect(devicelist.devices.at(1).get('id')).toBe('123456789');
            device = devicelist.devices.at(1);
            expect(device.get('bundle').identity_key).toBe('1111');
            expect(device.get('bundle').signed_prekey.public_key).toBe('8888');
            expect(device.get('bundle').signed_prekey.id).toBe(9999);
            expect(device.get('bundle').signed_prekey.signature).toBe('3333');
            expect(device.get('bundle').prekeys.length).toBe(3);
            expect(device.get('bundle').prekeys[0].id).toBe(3001);
            expect(device.get('bundle').prekeys[1].id).toBe(3002);
            expect(device.get('bundle').prekeys[2].id).toBe(3003);
            done();
        }));

        it("publishes a bundle with which an encrypted session can be created",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            _converse.NUM_PREKEYS = 2; // Restrict to 2, otherwise the resulting stanza is too large to easily test

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            let iq_stanza = await test_utils.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
            let stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '482886413b977930064a5888b92134fe'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(_converse.devicelists.length).toBe(1);
            await test_utils.openChatBoxFor(_converse, contact_jid);
            iq_stanza = await ownDeviceHasBeenPublished(_converse);
            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            iq_stanza = await test_utils.waitUntil(() => bundleHasBeenPublished(_converse));
            expect(iq_stanza.toLocaleString()).toBe(
                `<iq from="dummy@localhost" id="${iq_stanza.nodeTree.getAttribute("id")}" type="set" xmlns="jabber:client">`+
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
                    `</pubsub>`+
                `</iq>`)

            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await _converse.api.waitUntil('OMEMOInitialized');
            done();
        }));


        it("adds a toolbar button for starting an encrypted chat session",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

            let iq_stanza = await test_utils.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
            expect(iq_stanza.toLocaleString()).toBe(
                `<iq from="dummy@localhost" id="${iq_stanza.nodeTree.getAttribute("id")}" to="dummy@localhost" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</pubsub>`+
                `</iq>`);

            let stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '482886413b977930064a5888b92134fe'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.omemo_store);
            expect(_converse.devicelists.length).toBe(1);
            let devicelist = _converse.devicelists.get(_converse.bare_jid);
            expect(devicelist.devices.length).toBe(2);
            expect(devicelist.devices.at(0).get('id')).toBe('482886413b977930064a5888b92134fe');
            expect(devicelist.devices.at(1).get('id')).toBe('123456789');
            // Check that own device was published
            iq_stanza = await test_utils.waitUntil(() => ownDeviceHasBeenPublished(_converse));
            expect(iq_stanza.toLocaleString()).toBe(
                `<iq from="dummy@localhost" id="${iq_stanza.nodeTree.getAttribute(`id`)}" type="set" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<publish node="eu.siacs.conversations.axolotl.devicelist">`+
                            `<item>`+
                                `<list xmlns="eu.siacs.conversations.axolotl">`+
                                    `<device id="482886413b977930064a5888b92134fe"/>`+
                                    `<device id="123456789"/>`+
                                `</list>`+
                            `</item>`+
                        `</publish>`+
                `</pubsub>`+
                `</iq>`);

            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            const iq_el = await test_utils.waitUntil(() => _.get(bundleHasBeenPublished(_converse), 'nodeTree'));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await _converse.api.waitUntil('OMEMOInitialized', 1000);
            await test_utils.openChatBoxFor(_converse, contact_jid);
            iq_stanza = await test_utils.waitUntil(() => deviceListFetched(_converse, contact_jid));
            expect(iq_stanza.toLocaleString()).toBe(
                `<iq from="dummy@localhost" id="${iq_stanza.nodeTree.getAttribute("id")}" to="${contact_jid}" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</pubsub>`+
                `</iq>`);

            stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '368866411b877c30064a5f62b917cffe'}).up()
                            .c('device', {'id': '3300659945416e274474e469a1f0154c'}).up()
                            .c('device', {'id': '4e30f35051b7b8b42abe083742187228'}).up()
                            .c('device', {'id': 'ae890ac52d0df67ed7cfdf51b644e901'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            devicelist = _converse.devicelists.get(contact_jid);
            await test_utils.waitUntil(() => devicelist.devices.length);
            expect(_converse.devicelists.length).toBe(2);
            devicelist = _converse.devicelists.get(contact_jid);
            expect(devicelist.devices.length).toBe(4);
            expect(devicelist.devices.at(0).get('id')).toBe('368866411b877c30064a5f62b917cffe');
            expect(devicelist.devices.at(1).get('id')).toBe('3300659945416e274474e469a1f0154c');
            expect(devicelist.devices.at(2).get('id')).toBe('4e30f35051b7b8b42abe083742187228');
            expect(devicelist.devices.at(3).get('id')).toBe('ae890ac52d0df67ed7cfdf51b644e901');
            await test_utils.waitUntil(() => _converse.chatboxviews.get(contact_jid).el.querySelector('.chat-toolbar'));
            const view = _converse.chatboxviews.get(contact_jid);
            const toolbar = view.el.querySelector('.chat-toolbar');
            expect(view.model.get('omemo_active')).toBe(undefined);
            let toggle = toolbar.querySelector('.toggle-omemo');
            expect(_.isNull(toggle)).toBe(false);
            expect(u.hasClass('fa-unlock', toggle)).toBe(true);
            expect(u.hasClass('fa-lock', toggle)).toBe(false);

            spyOn(view, 'toggleOMEMO').and.callThrough();
            view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
            toolbar.querySelector('.toggle-omemo').click();
            expect(view.toggleOMEMO).toHaveBeenCalled();
            expect(view.model.get('omemo_active')).toBe(true);

            await test_utils.waitUntil(() => u.hasClass('fa-lock', toolbar.querySelector('.toggle-omemo')));
            toggle = toolbar.querySelector('.toggle-omemo');
            expect(u.hasClass('fa-unlock', toggle)).toBe(false);
            expect(u.hasClass('fa-lock', toggle)).toBe(true);

            const textarea = view.el.querySelector('.chat-textarea');
            textarea.value = 'This message will be sent encrypted';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13
            });
            done();
        }));


        it("shows OMEMO device fingerprints in the user details modal",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            // We simply emit, to avoid doing all the setup work
            _converse.emit('OMEMOInitialized');

            const view = _converse.chatboxviews.get(contact_jid);
            const show_modal_button = view.el.querySelector('.show-user-details-modal');
            show_modal_button.click();
            const modal = view.user_details_modal;
            await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
            let iq_stanza = await test_utils.waitUntil(() => deviceListFetched(_converse, contact_jid));
            expect(iq_stanza.toLocaleString()).toBe(
                `<iq from="dummy@localhost" id="${iq_stanza.nodeTree.getAttribute("id")}" to="max.frankfurter@localhost" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub"><items node="eu.siacs.conversations.axolotl.devicelist"/></pubsub>`+
                `</iq>`);
            let stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '555'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
            iq_stanza = await test_utils.waitUntil(() => bundleFetched(_converse, contact_jid, '555'));
            expect(iq_stanza.toLocaleString()).toBe(
                `<iq from="dummy@localhost" id="${iq_stanza.nodeTree.getAttribute("id")}" to="max.frankfurter@localhost" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.bundles:555"/>`+
                    `</pubsub>`+
                `</iq>`);
            stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.nodeTree.getAttribute('id'),
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
                                .c('preKeyPublic', {'preKeyId': '3'}).t(btoa('1003'));
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            await test_utils.waitUntil(() => modal.el.querySelectorAll('.fingerprints .fingerprint').length);
            expect(modal.el.querySelectorAll('.fingerprints .fingerprint').length).toBe(1);
            const el = modal.el.querySelector('.fingerprints .fingerprint');
            expect(el.textContent.trim()).toBe(
                u.formatFingerprint(u.arrayBufferToHex(u.base64ToArrayBuffer('BQmHEOHjsYm3w5M8VqxAtqJmLCi7CaxxsdZz6G0YpuMI')))
            );
            expect(modal.el.querySelectorAll('input[type="radio"]').length).toBe(2);

            const devicelist = _converse.devicelists.get(contact_jid);
            expect(devicelist.devices.get('555').get('trusted')).toBe(0);

            let trusted_radio = modal.el.querySelector('input[type="radio"][name="555"][value="1"]');
            expect(trusted_radio.checked).toBe(true);

            let untrusted_radio = modal.el.querySelector('input[type="radio"][name="555"][value="-1"]');
            expect(untrusted_radio.checked).toBe(false);

            // Test that the device can be set to untrusted
            untrusted_radio.click();
            trusted_radio = document.querySelector('input[type="radio"][name="555"][value="1"]');
            expect(trusted_radio.hasAttribute('checked')).toBe(false);
            expect(devicelist.devices.get('555').get('trusted')).toBe(-1);

            untrusted_radio = document.querySelector('input[type="radio"][name="555"][value="-1"]');
            expect(untrusted_radio.hasAttribute('checked')).toBe(true);

            trusted_radio.click();
            expect(devicelist.devices.get('555').get('trusted')).toBe(1);
            done();
        }));
    });

    describe("A chatbox with an active OMEMO session", function() {

        it("will not show the spoiler toolbar button",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {
            // TODO
            done()
        }));
    });
}));
