(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    var Strophe = converse.env.Strophe;
    var b64_sha1 = converse.env.b64_sha1;
    var $iq = converse.env.$iq;
    var $msg = converse.env.$msg;
    var _ = converse.env._;
    var u = converse.env.utils;

    describe("The OMEMO module", function() {

        it("enables encrypted messages to be sent and received",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    function (done, _converse) {

            var sent_stanza;
            let iq_stanza;
            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

            // First, fetch own device list
            return test_utils.waitUntil(() => {
                return _.filter(
                    _converse.connection.IQ_stanzas,
                    (iq) => {
                        const node = iq.nodeTree.querySelector('iq[to="'+_converse.bare_jid+'"] query[node="eu.siacs.conversations.axolotl.devicelist"]');
                        if (node) { iq_stanza = iq.nodeTree;}
                        return node;
                    }).length;
            }).then(() => {
                const stanza = $iq({
                    'from': contact_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result',
                }).c('query', {
                    'xmlns': 'http://jabber.org/protocol/disco#items',
                    'node': 'eu.siacs.conversations.axolotl.devicelist'
                }).c('device', {'id': '482886413b977930064a5888b92134fe'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                _converse.emit('OMEMOInitialized');
                // Check that device list for contact is fetched when chat is opened.
                return test_utils.openChatBoxFor(_converse, contact_jid);
            }).then(() => {
                return test_utils.waitUntil(() => {
                    return _.filter(
                        _converse.connection.IQ_stanzas,
                        (iq) => {
                            const node = iq.nodeTree.querySelector('iq[to="'+contact_jid+'"] query[node="eu.siacs.conversations.axolotl.devicelist"]');
                            if (node) { iq_stanza = iq.nodeTree; }
                            return node;
                        }).length;
                });
            }).then(() => {
                const stanza = $iq({
                    'from': contact_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result',
                }).c('query', {
                    'xmlns': 'http://jabber.org/protocol/disco#items',
                    'node': 'eu.siacs.conversations.axolotl.devicelist'
                }).c('device', {'id': '555'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                const devicelist = _converse.devicelists.create({'jid': contact_jid});
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
                return test_utils.waitUntil(() => {
                    return _.filter(
                        _converse.connection.IQ_stanzas,
                        (iq) => {
                            const node = iq.nodeTree.querySelector(
                                'iq[to="'+contact_jid+'"] items[node="eu.siacs.conversations.axolotl.bundles:555"]'
                            );
                            if (node) { iq_stanza = iq.nodeTree; }
                            return node;
                        }).length;
                });
            }).then(() => {
                const stanza = $iq({
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
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                return test_utils.waitUntil(() => {
                    return _.filter(
                        _converse.connection.IQ_stanzas,
                        (iq) => {
                            const node = iq.nodeTree.querySelector(
                                'iq[to="'+_converse.bare_jid+'"] items[node="eu.siacs.conversations.axolotl.bundles:482886413b977930064a5888b92134fe"]'
                            );
                            if (node) { iq_stanza = iq.nodeTree; }
                            return node;
                        }).length;
                });
            }).then(() => {
                const stanza = $iq({
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
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                return test_utils.waitUntil(() => sent_stanza);
            }).then(function () {
                expect(sent_stanza.toLocaleString()).toBe(
                    `<message from='dummy@localhost/resource' to='max.frankfurter@localhost' `+
                             `type='chat' id='${sent_stanza.nodeTree.getAttribute('id')}' xmlns='jabber:client'>`+
                        `<body>This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo</body>`+
                        `<encrypted xmlns='eu.siacs.conversations.axolotl'>`+
                            `<header sid='123456789'>`+
                                `<key rid='482886413b977930064a5888b92134fe'>eyJ0eXBlIjoxLCJib2R5IjoiYzFwaDNSNzNYNyIsInJlZ2lzdHJhdGlvbklkIjoiMTMzNyJ9</key>`+
                                `<key rid='555'>eyJ0eXBlIjoxLCJib2R5IjoiYzFwaDNSNzNYNyIsInJlZ2lzdHJhdGlvbklkIjoiMTMzNyJ9</key>`+
                                `<iv>${sent_stanza.nodeTree.querySelector('iv').textContent}</iv>`+
                            `</header>`+
                        `</encrypted>`+
                    `</message>`);

                // Test reception of an encrypted message
                const stanza = $msg({
                        'from': contact_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': 'qwerty' 
                    }).c('body').t('This is a fallback message').up()
                        .c('encrypted', {'xmlns': Strophe.NS.OMEMO})
                            .c('header', {'sid':  '555'})
                                .c('key', {'rid':  _converse.omemo_store.get('device_id')}).t('c1ph3R73X7').up()
                                .c('iv').t('1234');
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                done();
            });
        }));

        it("will add processing hints to sent out encrypted <message> stanzas",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {
            // TODO
            done();
        }));

        it("updates device lists based on PEP messages",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            let iq_stanza;
            test_utils.createContacts(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

            test_utils.waitUntil(function () {
                return _.filter(
                    _converse.connection.IQ_stanzas,
                    (iq) => {
                        const node = iq.nodeTree.querySelector('iq[to="'+_converse.bare_jid+'"] query[node="eu.siacs.conversations.axolotl.devicelist"]');
                        if (node) { iq_stanza = iq.nodeTree;}
                        return node;
                    }).length;
            }).then(function () {
                expect(iq_stanza.outerHTML).toBe(
                    '<iq type="get" from="dummy@localhost" to="dummy@localhost" xmlns="jabber:client" id="'+iq_stanza.getAttribute("id")+'">'+
                        '<query xmlns="http://jabber.org/protocol/disco#items" '+
                               'node="eu.siacs.conversations.axolotl.devicelist"/>'+
                    '</iq>');

                const stanza = $iq({
                    'from': contact_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result',
                }).c('query', {
                    'xmlns': 'http://jabber.org/protocol/disco#items',
                    'node': 'eu.siacs.conversations.axolotl.devicelist'
                }).c('device', {'id': '555'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(_converse.devicelists.length).toBe(1);
                const devicelist = _converse.devicelists.get(_converse.bare_jid);
                expect(devicelist.devices.length).toBe(1);
                expect(devicelist.devices.at(0).get('id')).toBe('555');
                return test_utils.waitUntil(() => _converse.devicelists);
            }).then(function () {
                // We simply emit, to avoid doing all the setup work
                _converse.emit('OMEMOInitialized');

                let stanza = $msg({
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
                expect(devices.get('1234').get('active')).toBe(true);
                expect(devices.get('4223').get('active')).toBe(true);

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
                expect(devices.length).toBe(3);
                expect(_.map(devices.models, 'attributes.id').sort().join()).toBe('1234,4223,4224');
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
                                .c('device', {'id': '555'})
                                .c('device', {'id': '777'})
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(_converse.devicelists.length).toBe(2);
                devices = _converse.devicelists.get(_converse.bare_jid).devices;
                expect(devices.length).toBe(3);
                expect(_.map(devices.models, 'attributes.id').sort().join()).toBe('123456789,555,777');
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
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                return test_utils.waitUntil(function () {
                    return _.filter(
                        _converse.connection.IQ_stanzas,
                        (iq) => {
                            const node = iq.nodeTree.querySelector('iq[from="'+_converse.bare_jid+'"] publish[node="eu.siacs.conversations.axolotl.devicelist"]');
                            if (node) { iq_stanza = iq.nodeTree;}
                            return node;
                        }).length;
                });
            }).then(function () {
                // Check that our own device is added again, but that removed
                // devices are not added.
                expect(iq_stanza.outerHTML).toBe(
                    '<iq from="dummy@localhost" type="set" xmlns="jabber:client" id="'+iq_stanza.getAttribute('id')+'">'+
                        '<pubsub xmlns="http://jabber.org/protocol/pubsub">'+
                            '<publish node="eu.siacs.conversations.axolotl.devicelist">'+
                                '<item>'+
                                    '<list xmlns="eu.siacs.conversations.axolotl"/>'+
                                    '<device id="123456789"/>'+
                                    '<device id="444"/>'+
                                '</item>'+
                            '</publish>'+
                        '</pubsub>'+
                    '</iq>');
                expect(_converse.devicelists.length).toBe(2);
                const devices = _converse.devicelists.get(_converse.bare_jid).devices;
                // The device id for this device (123456789) was also generated and added to the list,
                // which is why we have 4 devices now.
                expect(devices.length).toBe(4);
                expect(_.map(devices.models, 'attributes.id').sort().join()).toBe('123456789,444,555,777');
                expect(devices.get('123456789').get('active')).toBe(true);
                expect(devices.get('444').get('active')).toBe(true);
                expect(devices.get('555').get('active')).toBe(false);
                expect(devices.get('777').get('active')).toBe(false);
                done();
            });
        }));

        it("updates device bundles based on PEP messages",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            let iq_stanza;
            test_utils.createContacts(_converse, 'current');
            const contact_jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@localhost';

            test_utils.waitUntil(function () {
                return _.filter(
                    _converse.connection.IQ_stanzas,
                    (iq) => {
                        const node = iq.nodeTree.querySelector('iq[to="'+_converse.bare_jid+'"] query[node="eu.siacs.conversations.axolotl.devicelist"]');
                        if (node) { iq_stanza = iq.nodeTree;}
                        return node;
                    }).length;
            }).then(function () {
                expect(iq_stanza.outerHTML).toBe(
                    '<iq type="get" from="dummy@localhost" to="dummy@localhost" xmlns="jabber:client" id="'+iq_stanza.getAttribute("id")+'">'+
                        '<query xmlns="http://jabber.org/protocol/disco#items" '+
                               'node="eu.siacs.conversations.axolotl.devicelist"/>'+
                    '</iq>');

                const stanza = $iq({
                    'from': contact_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result',
                }).c('query', {
                    'xmlns': 'http://jabber.org/protocol/disco#items',
                    'node': 'eu.siacs.conversations.axolotl.devicelist'
                }).c('device', {'id': '555'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(_converse.devicelists.length).toBe(1);
                return test_utils.waitUntil(() => _converse.devicelists);
            }).then(function () {
                // We simply emit, to avoid doing all the setup work
                expect(_converse.devicelists.length).toBe(1);
                let devicelist = _converse.devicelists.get(_converse.bare_jid);
                expect(devicelist.devices.length).toBe(2);
                expect(devicelist.devices.at(0).get('id')).toBe('555');
                expect(devicelist.devices.at(1).get('id')).toBe('123456789');
                _converse.emit('OMEMOInitialized');

                let stanza = $msg({
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
            });
        }));

        it("publishes a bundle with which an encrypted session can be created",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    function (done, _converse) {

            _converse.NUM_PREKEYS = 2; // Restrict to 2, otherwise the resulting stanza is too large to easily test

            let iq_stanza;
            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

            test_utils.waitUntil(function () {
                return _.filter(
                    _converse.connection.IQ_stanzas,
                    (iq) => {
                        const node = iq.nodeTree.querySelector('iq[to="'+_converse.bare_jid+'"] query[node="eu.siacs.conversations.axolotl.devicelist"]');
                        if (node) { iq_stanza = iq.nodeTree;}
                        return node;
                    }).length;
            }).then(function () {
                const stanza = $iq({
                    'from': contact_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result',
                }).c('query', {
                    'xmlns': 'http://jabber.org/protocol/disco#items',
                    'node': 'eu.siacs.conversations.axolotl.devicelist'
                }).c('device', {'id': '482886413b977930064a5888b92134fe'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(_converse.devicelists.length).toBe(1);

                return test_utils.openChatBoxFor(_converse, contact_jid);
            }).then(() => {
                return test_utils.waitUntil(() => {
                    return _.filter(_converse.connection.IQ_stanzas, function (iq) {
                        const node = iq.nodeTree.querySelector('publish[node="eu.siacs.conversations.axolotl.devicelist"]');
                        if (node) { iq_stanza = iq.nodeTree; }
                        return node;
                    }).length;
                });
            }).then(function () {
                const stanza = $iq({
                    'from': _converse.bare_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                return test_utils.waitUntil(() => {
                    return _.filter(_converse.connection.IQ_stanzas, function (iq) {
                        const node = iq.nodeTree.querySelector('publish[node="eu.siacs.conversations.axolotl.bundles:123456789"]');
                        if (node) { iq_stanza = iq.nodeTree; }
                        return node;
                    }).length;
                });
            }).then(function () {
                expect(iq_stanza.outerHTML).toBe(
                    `<iq from="dummy@localhost" type="set" xmlns="jabber:client" id="${iq_stanza.getAttribute('id')}">`+
                        `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                            `<publish node="eu.siacs.conversations.axolotl.bundles:123456789">`+
                                `<item>`+
                                    `<bundle xmlns="eu.siacs.conversations.axolotl">`+
                                        `<signedPreKeyPublic signedPreKeyId="0">${btoa('1234')}</signedPreKeyPublic>`+
                                            `<signedPreKeySignature>${btoa('11112222333344445555')}</signedPreKeySignature>`+
                                            `<identityKey>${btoa('1234')}</identityKey>`+
                                        `<prekeys>`+
                                            `<preKeyPublic preKeyId="0">${btoa('1234')}</preKeyPublic>`+
                                            `<preKeyPublic preKeyId="1">${btoa('1234')}</preKeyPublic>`+
                                        `</prekeys>`+
                                    `</bundle>`+
                                `</item>`+
                            `</publish>`+
                        `</pubsub>`+
                    `</iq>`)

                const stanza = $iq({
                    'from': _converse.bare_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                return _converse.api.waitUntil('OMEMOInitialized');
            }).then(done).catch(_.partial(console.error, _));
        }));

        it("adds a toolbar button for starting an encrypted chat session",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            let iq_stanza, modal;
            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

            test_utils.waitUntil(function () {
                return _.filter(
                    _converse.connection.IQ_stanzas,
                    (iq) => {
                        const node = iq.nodeTree.querySelector('iq[to="'+_converse.bare_jid+'"] query[node="eu.siacs.conversations.axolotl.devicelist"]');
                        if (node) { iq_stanza = iq.nodeTree;}
                        return node;
                    }).length;
            }).then(function () {
                expect(iq_stanza.outerHTML).toBe(
                    '<iq type="get" from="dummy@localhost" to="dummy@localhost" xmlns="jabber:client" id="'+iq_stanza.getAttribute("id")+'">'+
                        '<query xmlns="http://jabber.org/protocol/disco#items" '+
                               'node="eu.siacs.conversations.axolotl.devicelist"/>'+
                    '</iq>');

                const stanza = $iq({
                    'from': contact_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result',
                }).c('query', {
                    'xmlns': 'http://jabber.org/protocol/disco#items',
                    'node': 'eu.siacs.conversations.axolotl.devicelist'
                }).c('device', {'id': '482886413b977930064a5888b92134fe'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(_converse.devicelists.length).toBe(1);
                const devicelist = _converse.devicelists.get(_converse.bare_jid);
                expect(devicelist.devices.length).toBe(1);
                expect(devicelist.devices.at(0).get('id')).toBe('482886413b977930064a5888b92134fe');

                return test_utils.openChatBoxFor(_converse, contact_jid);
            }).then(() => {
                return test_utils.waitUntil(() => {
                    return _.filter(_converse.connection.IQ_stanzas, function (iq) {
                        const node = iq.nodeTree.querySelector('publish[node="eu.siacs.conversations.axolotl.devicelist"]');
                        if (node) { iq_stanza = iq.nodeTree; }
                        return node;
                    }).length;
                });
            }).then(function () {
                expect(iq_stanza.outerHTML).toBe(
                    '<iq from="dummy@localhost" type="set" xmlns="jabber:client" id="'+iq_stanza.getAttribute('id')+'">'+
                        '<pubsub xmlns="http://jabber.org/protocol/pubsub">'+
                            '<publish node="eu.siacs.conversations.axolotl.devicelist">'+
                                '<item>'+
                                    '<list xmlns="eu.siacs.conversations.axolotl"/>'+
                                    '<device id="482886413b977930064a5888b92134fe"/>'+
                                    '<device id="123456789"/>'+
                                '</item>'+
                            '</publish>'+
                    '</pubsub>'+
                    '</iq>');

                const stanza = $iq({
                    'from': _converse.bare_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                return test_utils.waitUntil(() => {
                    return _.filter(_converse.connection.IQ_stanzas, function (iq) {
                        const node = iq.nodeTree.querySelector('publish[node="eu.siacs.conversations.axolotl.bundles:123456789"]');
                        if (node) { iq_stanza = iq.nodeTree; }
                        return node;
                    }).length;
                });
            }).then(function () {
                expect(iq_stanza.getAttributeNames().sort().join()).toBe(["from", "type", "xmlns", "id"].sort().join());
                expect(iq_stanza.querySelector('prekeys').childNodes.length).toBe(100);

                const signed_prekeys = iq_stanza.querySelectorAll('signedPreKeyPublic');
                expect(signed_prekeys.length).toBe(1);
                const signed_prekey = signed_prekeys[0];
                expect(signed_prekey.getAttribute('signedPreKeyId')).toBe('0')
                expect(iq_stanza.querySelectorAll('signedPreKeySignature').length).toBe(1);
                expect(iq_stanza.querySelectorAll('identityKey').length).toBe(1);

                const stanza = $iq({
                    'from': _converse.bare_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                return test_utils.waitUntil(() => {
                    return _.filter(
                        _converse.connection.IQ_stanzas,
                        (iq) => {
                            const node = iq.nodeTree.querySelector('iq[to="'+contact_jid+'"] query[node="eu.siacs.conversations.axolotl.devicelist"]');
                            if (node) { iq_stanza = iq.nodeTree; }
                            return node;
                        }).length;});
            }).then(function () {
                expect(iq_stanza.outerHTML).toBe(
                    '<iq type="get" from="dummy@localhost" to="'+contact_jid+'" xmlns="jabber:client" id="'+iq_stanza.getAttribute("id")+'">'+
                        '<query xmlns="http://jabber.org/protocol/disco#items" '+
                               'node="eu.siacs.conversations.axolotl.devicelist"/>'+
                    '</iq>');
                const stanza = $iq({
                    'from': contact_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result',
                }).c('query', {
                    'xmlns': 'http://jabber.org/protocol/disco#items',
                    'node': 'eu.siacs.conversations.axolotl.devicelist'
                }).c('device', {'id': '368866411b877c30064a5f62b917cffe'}).up()
                  .c('device', {'id': '3300659945416e274474e469a1f0154c'}).up()
                  .c('device', {'id': '4e30f35051b7b8b42abe083742187228'}).up()
                  .c('device', {'id': 'ae890ac52d0df67ed7cfdf51b644e901'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(_converse.devicelists.length).toBe(2);
                const devicelist = _converse.devicelists.get(contact_jid);
                expect(devicelist.devices.length).toBe(4);
                expect(devicelist.devices.at(0).get('id')).toBe('368866411b877c30064a5f62b917cffe');
                expect(devicelist.devices.at(1).get('id')).toBe('3300659945416e274474e469a1f0154c');
                expect(devicelist.devices.at(2).get('id')).toBe('4e30f35051b7b8b42abe083742187228');
                expect(devicelist.devices.at(3).get('id')).toBe('ae890ac52d0df67ed7cfdf51b644e901');
                return test_utils.waitUntil(() => _converse.chatboxviews.get(contact_jid).el.querySelector('.chat-toolbar'));
            }).then(function () {
                const view = _converse.chatboxviews.get(contact_jid);
                const toolbar = view.el.querySelector('.chat-toolbar');
                expect(view.model.get('omemo_active')).toBe(undefined);
                const toggle = toolbar.querySelector('.toggle-omemo');
                expect(_.isNull(toggle)).toBe(false);
                expect(u.hasClass('fa-unlock', toggle)).toBe(true);
                expect(u.hasClass('fa-lock', toggle)).toBe(false);

                spyOn(view, 'toggleOMEMO').and.callThrough();
                view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
                toolbar.querySelector('.toggle-omemo').click();
                expect(view.toggleOMEMO).toHaveBeenCalled();
                expect(view.model.get('omemo_active')).toBe(true);

                return test_utils.waitUntil(() => u.hasClass('fa-lock', toolbar.querySelector('.toggle-omemo')));
            }).then(function () {
                const view = _converse.chatboxviews.get(contact_jid);
                const toolbar = view.el.querySelector('.chat-toolbar');
                const toggle = toolbar.querySelector('.toggle-omemo');
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
            }).catch(_.partial(console.error, _));
        }));

        it("shows OMEMO device fingerprints in the user details modal",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            let iq_stanza, modal;
            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                // We simply emit, to avoid doing all the setup work
                _converse.emit('OMEMOInitialized');

                const view = _converse.chatboxviews.get(contact_jid);
                const show_modal_button = view.el.querySelector('.show-user-details-modal');
                show_modal_button.click();
                modal = view.user_details_modal;

                return test_utils.waitUntil(() => u.isVisible(modal.el), 1000).then(() => {
                    return test_utils.waitUntil(() => {
                        return _.filter(
                            _converse.connection.IQ_stanzas,
                            (iq) => {
                                const node = iq.nodeTree.querySelector('iq[to="'+contact_jid+'"] query[node="eu.siacs.conversations.axolotl.devicelist"]');
                                if (node) { iq_stanza = iq.nodeTree; }
                                return node;
                            }).length;});
                });
            }).then(() => {
                iq_stanza;
                expect(iq_stanza.outerHTML).toBe(
                    `<iq type="get" from="dummy@localhost" to="max.frankfurter@localhost" xmlns="jabber:client" id="${iq_stanza.getAttribute('id')}">`+
                        `<query xmlns="http://jabber.org/protocol/disco#items" node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</iq>`);
                
                const stanza = $iq({
                    'from': contact_jid,
                    'id': iq_stanza.getAttribute('id'),
                    'to': _converse.bare_jid,
                    'type': 'result',
                }).c('query', {
                    'xmlns': 'http://jabber.org/protocol/disco#items',
                    'node': 'eu.siacs.conversations.axolotl.devicelist'
                }).c('device', {'id': '555'}).up()
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                return test_utils.waitUntil(() => u.isVisible(modal.el), 1000).then(function () {
                    return test_utils.waitUntil(() => {
                        return _.filter(
                            _converse.connection.IQ_stanzas,
                            (iq) => {
                                const node = iq.nodeTree.querySelector('iq[to="'+contact_jid+'"] items[node="eu.siacs.conversations.axolotl.bundles:555"]');
                                if (node) { iq_stanza = iq.nodeTree; }
                                return node;
                            }).length;});
                });
            }).then(() => {
                expect(iq_stanza.outerHTML).toBe(
                    `<iq type="get" from="dummy@localhost" to="max.frankfurter@localhost" xmlns="jabber:client" id="${iq_stanza.getAttribute('id')}">`+
                        `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                            `<items node="eu.siacs.conversations.axolotl.bundles:555"/>`+
                        `</pubsub>`+
                    `</iq>`);

                const stanza = $iq({
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
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                const view = _converse.chatboxviews.get(contact_jid);
                const modal = view.user_details_modal;
                return test_utils.waitUntil(() => modal.el.querySelectorAll('.fingerprints .fingerprint').length);
            }).then(() => {
                const view = _converse.chatboxviews.get(contact_jid);
                const modal = view.user_details_modal;
                expect(modal.el.querySelectorAll('.fingerprints .fingerprint').length).toBe(1);
                const el = modal.el.querySelector('.fingerprints .fingerprint');
                expect(el.textContent).toBe('f56d6351aa71cff0debea014d13525e42036187a');

                expect(modal.el.querySelectorAll('input[type="radio"]').length).toBe(2);

                let trusted_radio = modal.el.querySelector('input[type="radio"][name="555"][value="1"]');
                expect(trusted_radio.checked).toBe(true);

                let untrusted_radio = modal.el.querySelector('input[type="radio"][name="555"][value="-1"]');
                expect(untrusted_radio.checked).toBe(false);

                // Test that the device can be set to untrusted
                untrusted_radio.click();
                trusted_radio = document.querySelector('input[type="radio"][name="555"][value="1"]');
                expect(trusted_radio.hasAttribute('checked')).toBe(false);

                untrusted_radio = document.querySelector('input[type="radio"][name="555"][value="-1"]');
                expect(untrusted_radio.hasAttribute('checked')).toBe(true);
                done();
            });
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
