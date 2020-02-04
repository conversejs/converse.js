(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    const { $iq, $pres, $msg, _, Strophe } = converse.env;
    const u = converse.env.utils;


    async function deviceListFetched (_converse, jid) {
        const selector = `iq[to="${jid}"] items[node="eu.siacs.conversations.axolotl.devicelist"]`;
        const stanza = await u.waitUntil(
            () => Array.from(_converse.connection.IQ_stanzas).filter(iq => iq.querySelector(selector)).pop()
        );
        await u.waitUntil(() => _converse.devicelists.get(jid));
        return stanza;
    }

    function ownDeviceHasBeenPublished (_converse) {
        return _.filter(
            Array.from(_converse.connection.IQ_stanzas),
            iq => iq.querySelector('iq[from="'+_converse.bare_jid+'"] publish[node="eu.siacs.conversations.axolotl.devicelist"]')
        ).pop();
    }

    function bundleHasBeenPublished (_converse) {
        const selector = 'publish[node="eu.siacs.conversations.axolotl.bundles:123456789"]';
        return Array.from(_converse.connection.IQ_stanzas).filter(iq => iq.querySelector(selector)).pop();
    }

    function bundleFetched (_converse, jid, device_id) {
        return _.filter(
            Array.from(_converse.connection.IQ_stanzas),
            iq => iq.querySelector(`iq[to="${jid}"] items[node="eu.siacs.conversations.axolotl.bundles:${device_id}"]`)
        ).pop();
    }

    async function initializedOMEMO (_converse) {
        await test_utils.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );
        let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
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
        _converse.connection._dataRecv(test_utils.createRequest(stanza));
        iq_stanza = await u.waitUntil(() => ownDeviceHasBeenPublished(_converse))

        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(test_utils.createRequest(stanza));
        iq_stanza = await u.waitUntil(() => bundleHasBeenPublished(_converse))

        stanza = $iq({
            'from': _converse.bare_jid,
            'id': iq_stanza.getAttribute('id'),
            'to': _converse.bare_jid,
            'type': 'result'});
        _converse.connection._dataRecv(test_utils.createRequest(stanza));
        await _converse.api.waitUntil('OMEMOInitialized');
    }


    describe("The OMEMO module", function() {

        it("adds methods for encrypting and decrypting messages via AES GCM",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const message = 'This message will be encrypted'
            await test_utils.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const view = await test_utils.openChatBoxFor(_converse, contact_jid);
            const payload = await view.model.encryptMessage(message);
            const result = await view.model.decryptMessage(payload);
            expect(result).toBe(message);
            done();
        }));


        it("enables encrypted messages to be sent and received",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            let sent_stanza;
            await test_utils.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await u.waitUntil(() => initializedOMEMO(_converse));
            await test_utils.openChatBoxFor(_converse, contact_jid);
            let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.omemo_store);
            const devicelist = _converse.devicelists.get({'jid': contact_jid});
            await u.waitUntil(() => devicelist.devices.length === 1);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);

            const textarea = view.el.querySelector('.chat-textarea');
            textarea.value = 'This message will be encrypted';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            iq_stanza = await u.waitUntil(() => bundleFetched(_converse, contact_jid, '555'));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            iq_stanza = await u.waitUntil(() => bundleFetched(_converse, _converse.bare_jid, '482886413b977930064a5888b92134fe'));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => sent_stanza);
            expect(sent_stanza.toLocaleString()).toBe(
                `<message from="romeo@montague.lit/orchard" id="${sent_stanza.nodeTree.getAttribute("id")}" `+
                            `to="mercutio@montague.lit" `+
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
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
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
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.model.messages.length > 1);
            expect(view.model.messages.length).toBe(3);
            expect(view.el.querySelectorAll('.chat-msg__body')[2].textContent.trim())
                .toBe('Another received encrypted message without fallback');
            done();
        }));

        it("enables encrypted groupchat messages to be sent and received",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            // MEMO encryption works only in members only conferences
            // that are non-anonymous.
            const features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                'muc_passwordprotected',
                'muc_hidden',
                'muc_temporary',
                'muc_membersonly',
                'muc_unmoderated',
                'muc_nonanonymous'
            ];
            await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo', features);
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            await u.waitUntil(() => initializedOMEMO(_converse));

            const toolbar = view.el.querySelector('.chat-toolbar');
            let toggle = toolbar.querySelector('.toggle-omemo');
            toggle.click();
            expect(view.model.get('omemo_active')).toBe(true);

            // newguy enters the room
            const contact_jid = 'newguy@montague.lit';
            let stanza = $pres({
                    'to': 'romeo@montague.lit/orchard',
                    'from': 'lounge@montague.lit/newguy'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newguy@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                }).tree();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            // Wait for Converse to fetch newguy's device list
            let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="${contact_jid}" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</pubsub>`+
                `</iq>`);

            // The server returns his device list
            stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '4e30f35051b7b8b42abe083742187228'}).up()
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.omemo_store);
            expect(_converse.devicelists.length).toBe(2);

            await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
            const devicelist = _converse.devicelists.get(contact_jid);
            expect(devicelist.devices.length).toBe(1);
            expect(devicelist.devices.at(0).get('id')).toBe('4e30f35051b7b8b42abe083742187228');

            toggle = toolbar.querySelector('.toggle-omemo');
            expect(view.model.get('omemo_active')).toBe(true);
            expect(u.hasClass('fa-unlock', toggle)).toBe(false);
            expect(u.hasClass('fa-lock', toggle)).toBe(true);

            const textarea = view.el.querySelector('.chat-textarea');
            textarea.value = 'This message will be encrypted';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            iq_stanza = await u.waitUntil(() => bundleFetched(_converse, contact_jid, '4e30f35051b7b8b42abe083742187228'), 1000);
            console.log("Bundle fetched 4e30f35051b7b8b42abe083742187228");
            stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {
                'xmlns': 'http://jabber.org/protocol/pubsub'
                }).c('items', {'node': "eu.siacs.conversations.axolotl.bundles:4e30f35051b7b8b42abe083742187228"})
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

            iq_stanza = await u.waitUntil(() => bundleFetched(_converse, _converse.bare_jid, '482886413b977930064a5888b92134fe'), 1000);
            console.log("Bundle fetched 482886413b977930064a5888b92134fe");
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

            spyOn(_converse.connection, 'send');
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.connection.send.calls.count(), 1000);
            const sent_stanza = _converse.connection.send.calls.all()[0].args[0];

            expect(Strophe.serialize(sent_stanza)).toBe(
                `<message from="romeo@montague.lit/orchard" `+
                         `id="${sent_stanza.nodeTree.getAttribute("id")}" `+
                         `to="lounge@montague.lit" `+
                         `type="groupchat" `+
                         `xmlns="jabber:client">`+
                    `<body>This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo</body>`+
                    `<encrypted xmlns="eu.siacs.conversations.axolotl">`+
                        `<header sid="123456789">`+
                            `<key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>`+
                            `<key rid="4e30f35051b7b8b42abe083742187228">YzFwaDNSNzNYNw==</key>`+
                            `<iv>${sent_stanza.nodeTree.querySelector("iv").textContent}</iv>`+
                        `</header>`+
                        `<payload>${sent_stanza.nodeTree.querySelector("payload").textContent}</payload>`+
                    `</encrypted>`+
                    `<store xmlns="urn:xmpp:hints"/>`+
                `</message>`);
            done();
        }));

        it("will create a new device based on a received carbon message",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.SID]);

            await test_utils.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await u.waitUntil(() => initializedOMEMO(_converse));
            await test_utils.openChatBoxFor(_converse, contact_jid);
            let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.omemo_store);
            const devicelist = _converse.devicelists.get({'jid': contact_jid});
            await u.waitUntil(() => devicelist.devices.length === 1);

            const view = _converse.chatboxviews.get(contact_jid);
            view.model.set('omemo_active', true);

            // Test reception of an encrypted carbon message
            const obj = await view.model.encryptMessage('This is an encrypted carbon message from another device of mine')
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
            _converse.connection._dataRecv(test_utils.createRequest(carbon));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.model.messages.length).toBe(1);
            expect(view.el.querySelector('.chat-msg__body').textContent.trim())
                .toBe('This is an encrypted carbon message from another device of mine');

            expect(devicelist.devices.length).toBe(2);
            expect(devicelist.devices.at(0).get('id')).toBe('555');
            expect(devicelist.devices.at(1).get('id')).toBe('988349631');
            expect(devicelist.devices.get('988349631').get('active')).toBe(true);

            const textarea = view.el.querySelector('.chat-textarea');
            textarea.value = 'This is an encrypted message from this device';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            iq_stanza = await u.waitUntil(() => bundleFetched(_converse, _converse.bare_jid, '988349631'));
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="${_converse.bare_jid}" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.bundles:988349631"/>`+
                    `</pubsub>`+
                `</iq>`);
            done();
        }));

        it("gracefully handles auth errors when trying to send encrypted groupchat messages",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            // MEMO encryption works only in members only conferences
            // that are non-anonymous.
            const features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                'muc_passwordprotected',
                'muc_hidden',
                'muc_temporary',
                'muc_membersonly',
                'muc_unmoderated',
                'muc_nonanonymous'
            ];
            await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo', features);
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            await u.waitUntil(() => initializedOMEMO(_converse));

            const contact_jid = 'newguy@montague.lit';
            let stanza = $pres({
                    'to': 'romeo@montague.lit/orchard',
                    'from': 'lounge@montague.lit/newguy'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newguy@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                }).tree();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            const toolbar = view.el.querySelector('.chat-toolbar');
            const toggle = toolbar.querySelector('.toggle-omemo');
            toggle.click();
            expect(view.model.get('omemo_active')).toBe(true);
            expect(view.model.get('omemo_supported')).toBe(true);

            const textarea = view.el.querySelector('.chat-textarea');
            textarea.value = 'This message will be encrypted';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="${contact_jid}" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</pubsub>`+
                `</iq>`);

            stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '4e30f35051b7b8b42abe083742187228'}).up()

            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.omemo_store);
            expect(_converse.devicelists.length).toBe(2);

            const devicelist = _converse.devicelists.get(contact_jid);
            await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
            expect(devicelist.devices.length).toBe(1);
            expect(devicelist.devices.at(0).get('id')).toBe('4e30f35051b7b8b42abe083742187228');

            iq_stanza = await u.waitUntil(() => bundleFetched(_converse, _converse.bare_jid, '482886413b977930064a5888b92134fe'));
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
            iq_stanza = await u.waitUntil(() => bundleFetched(_converse, contact_jid, '4e30f35051b7b8b42abe083742187228'));

            /* <iq xmlns="jabber:client" to="jc@opkode.com/converse.js-34183907" type="error" id="945c8ab3-b561-4d8a-92da-77c226bb1689:sendIQ" from="joris@konuro.net">
             *     <pubsub xmlns="http://jabber.org/protocol/pubsub">
             *         <items node="eu.siacs.conversations.axolotl.bundles:7580"/>
             *     </pubsub>
             *     <error code="401" type="auth">
             *         <presence-subscription-required xmlns="http://jabber.org/protocol/pubsub#errors"/>
             *         <not-authorized xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
             *     </error>
             * </iq>
             */
            stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': 'http://jabber.org/protocol/pubsub'})
                .c('items', {'node': "eu.siacs.conversations.axolotl.bundles:4e30f35051b7b8b42abe083742187228"}).up().up()
            .c('error', {'code': '401', 'type': 'auth'})
                .c('presence-subscription-required', {'xmlns':"http://jabber.org/protocol/pubsub#errors" }).up()
                .c('not-authorized', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            await u.waitUntil(() => document.querySelectorAll('.alert-danger').length, 2000);
            const header = document.querySelector('.alert-danger .modal-title');
            expect(header.textContent).toBe("Error");
            expect(u.ancestor(header, '.modal-content').querySelector('.modal-body p').textContent.trim())
                .toBe("Sorry, we're unable to send an encrypted message because newguy@montague.lit requires you "+
                      "to be subscribed to their presence in order to see their OMEMO information");

            expect(view.model.get('omemo_supported')).toBe(false);
            expect(view.el.querySelector('.chat-textarea').value).toBe('This message will be encrypted');
            done();
        }));

        it("can receive a PreKeySignalMessage",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            _converse.NUM_PREKEYS = 5; // Restrict to 5, otherwise the resulting stanza is too large to easily test
            await test_utils.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

            await u.waitUntil(() => initializedOMEMO(_converse));
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
            let iq_stanza = await u.waitUntil(() => _converse.chatboxviews.get(contact_jid));
            iq_stanza = await deviceListFetched(_converse, contact_jid);
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.omemo_store);

            iq_stanza = await u.waitUntil(() => bundleHasBeenPublished(_converse));
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
            done();
        }));


        it("updates device lists based on PEP messages",
            mock.initConverse(
                ['rosterGroupsFetched'], {'allow_non_roster_messaging': true},
                async function (done, _converse) {

            await test_utils.waitUntilDiscoConfirmed(
                _converse, _converse.bare_jid,
                [{'category': 'pubsub', 'type': 'pep'}],
                ['http://jabber.org/protocol/pubsub#publish-options']
            );

            await test_utils.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

            // Wait until own devices are fetched
            let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.omemo_store);
            expect(_converse.chatboxes.length).toBe(1);
            expect(_converse.devicelists.length).toBe(1);
            const devicelist = _converse.devicelists.get(_converse.bare_jid);
            expect(devicelist.devices.length).toBe(2);
            expect(devicelist.devices.at(0).get('id')).toBe('555');
            expect(devicelist.devices.at(1).get('id')).toBe('123456789');
            iq_stanza = await u.waitUntil(() => ownDeviceHasBeenPublished(_converse));
            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            iq_stanza = await u.waitUntil(() => bundleHasBeenPublished(_converse));

            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.getAttribute('id'),
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
                            .c('device', {'id': '123456789'})
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

            iq_stanza = await u.waitUntil(() => ownDeviceHasBeenPublished(_converse));
            // Check that our own device is added again, but that removed
            // devices are not added.
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute(`id`)}" type="set" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<publish node="eu.siacs.conversations.axolotl.devicelist">`+
                            `<item>`+
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
            expect(_.map(devices.models, 'attributes.id').sort().join()).toBe('123456789,444,555,777');
            expect(devices.get('123456789').get('active')).toBe(true);
            expect(devices.get('444').get('active')).toBe(true);
            expect(devices.get('555').get('active')).toBe(false);
            expect(devices.get('777').get('active')).toBe(false);
            done();
        }));


        it("updates device bundles based on PEP messages",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitUntilDiscoConfirmed(
                _converse, _converse.bare_jid,
                [{'category': 'pubsub', 'type': 'pep'}],
                ['http://jabber.org/protocol/pubsub#publish-options']
            );

            await test_utils.waitForRoster(_converse, 'current');
            const contact_jid = mock.cur_names[3].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="romeo@montague.lit" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</pubsub>`+
                `</iq>`);

            let stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '555'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await await u.waitUntil(() => _converse.omemo_store);
            expect(_converse.devicelists.length).toBe(1);
            let devicelist = _converse.devicelists.get(_converse.bare_jid);
            expect(devicelist.devices.length).toBe(2);
            expect(devicelist.devices.at(0).get('id')).toBe('555');
            expect(devicelist.devices.at(1).get('id')).toBe('123456789');
            iq_stanza = await u.waitUntil(() => ownDeviceHasBeenPublished(_converse));
            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            iq_stanza = await u.waitUntil(() => bundleHasBeenPublished(_converse));
            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.getAttribute('id'),
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
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitUntilDiscoConfirmed(
                _converse, _converse.bare_jid,
                [{'category': 'pubsub', 'type': 'pep'}],
                ['http://jabber.org/protocol/pubsub#publish-options']
            );

            _converse.NUM_PREKEYS = 2; // Restrict to 2, otherwise the resulting stanza is too large to easily test

            await test_utils.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(_converse.devicelists.length).toBe(1);
            await test_utils.openChatBoxFor(_converse, contact_jid);
            iq_stanza = await ownDeviceHasBeenPublished(_converse);
            stanza = $iq({
                'from': _converse.bare_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            iq_stanza = await u.waitUntil(() => bundleHasBeenPublished(_converse));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await _converse.api.waitUntil('OMEMOInitialized');
            done();
        }));


        it("adds a toolbar button for starting an encrypted chat session",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitUntilDiscoConfirmed(
                _converse, _converse.bare_jid,
                [{'category': 'pubsub', 'type': 'pep'}],
                ['http://jabber.org/protocol/pubsub#publish-options']
            );

            await test_utils.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

            let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, _converse.bare_jid));
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.omemo_store);
            expect(_converse.devicelists.length).toBe(1);
            let devicelist = _converse.devicelists.get(_converse.bare_jid);
            expect(devicelist.devices.length).toBe(2);
            expect(devicelist.devices.at(0).get('id')).toBe('482886413b977930064a5888b92134fe');
            expect(devicelist.devices.at(1).get('id')).toBe('123456789');
            // Check that own device was published
            iq_stanza = await u.waitUntil(() => ownDeviceHasBeenPublished(_converse));
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute(`id`)}" type="set" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<publish node="eu.siacs.conversations.axolotl.devicelist">`+
                            `<item>`+
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            const iq_el = await u.waitUntil(() => bundleHasBeenPublished(_converse));
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
            iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="${contact_jid}" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</pubsub>`+
                `</iq>`);

            stanza = $iq({
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
                            .c('device', {'id': 'ae890ac52d0df67ed7cfdf51b644e901'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            devicelist = _converse.devicelists.get(contact_jid);
            await u.waitUntil(() => devicelist.devices.length);
            expect(_converse.devicelists.length).toBe(2);
            devicelist = _converse.devicelists.get(contact_jid);
            expect(devicelist.devices.length).toBe(4);
            expect(devicelist.devices.at(0).get('id')).toBe('368866411b877c30064a5f62b917cffe');
            expect(devicelist.devices.at(1).get('id')).toBe('3300659945416e274474e469a1f0154c');
            expect(devicelist.devices.at(2).get('id')).toBe('4e30f35051b7b8b42abe083742187228');
            expect(devicelist.devices.at(3).get('id')).toBe('ae890ac52d0df67ed7cfdf51b644e901');
            await u.waitUntil(() => _converse.chatboxviews.get(contact_jid).el.querySelector('.chat-toolbar'));
            const view = _converse.chatboxviews.get(contact_jid);
            const toolbar = view.el.querySelector('.chat-toolbar');
            expect(view.model.get('omemo_active')).toBe(undefined);
            let toggle = toolbar.querySelector('.toggle-omemo');
            expect(toggle === null).toBe(false);
            expect(u.hasClass('fa-unlock', toggle)).toBe(true);
            expect(u.hasClass('fa-lock', toggle)).toBe(false);

            spyOn(view, 'toggleOMEMO').and.callThrough();
            view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
            toolbar.querySelector('.toggle-omemo').click();
            expect(view.toggleOMEMO).toHaveBeenCalled();
            expect(view.model.get('omemo_active')).toBe(true);

            await u.waitUntil(() => u.hasClass('fa-lock', toolbar.querySelector('.toggle-omemo')));
            toggle = toolbar.querySelector('.toggle-omemo');
            expect(u.hasClass('fa-unlock', toggle)).toBe(false);
            expect(u.hasClass('fa-lock', toggle)).toBe(true);

            const textarea = view.el.querySelector('.chat-textarea');
            textarea.value = 'This message will be sent encrypted';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });

            view.model.save({'omemo_supported': false});
            toggle = toolbar.querySelector('.toggle-omemo');
            expect(u.hasClass('fa-lock', toggle)).toBe(false);
            expect(u.hasClass('fa-unlock', toggle)).toBe(true);
            expect(u.hasClass('disabled', toggle)).toBe(true);

            view.model.save({'omemo_supported': true});
            toggle = toolbar.querySelector('.toggle-omemo');
            expect(u.hasClass('fa-lock', toggle)).toBe(false);
            expect(u.hasClass('fa-unlock', toggle)).toBe(true);
            expect(u.hasClass('disabled', toggle)).toBe(false);
            done();
        }));

        it("adds a toolbar button for starting an encrypted groupchat session",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {'view_mode': 'fullscreen'},
                async function (done, _converse) {

            await test_utils.waitUntilDiscoConfirmed(
                _converse, _converse.bare_jid,
                [{'category': 'pubsub', 'type': 'pep'}],
                ['http://jabber.org/protocol/pubsub#publish-options']
            );

            // MEMO encryption works only in members-only conferences that are non-anonymous.
            const features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                'muc_passwordprotected',
                'muc_hidden',
                'muc_temporary',
                'muc_membersonly',
                'muc_unmoderated',
                'muc_nonanonymous'
            ];
            await test_utils.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo', features);
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            await u.waitUntil(() => initializedOMEMO(_converse));

            const toolbar = view.el.querySelector('.chat-toolbar');
            let toggle = toolbar.querySelector('.toggle-omemo');
            expect(view.model.get('omemo_active')).toBe(undefined);
            expect(toggle === null).toBe(false);
            expect(u.hasClass('fa-unlock', toggle)).toBe(true);
            expect(u.hasClass('fa-lock', toggle)).toBe(false);
            expect(u.hasClass('disabled', toggle)).toBe(false);
            expect(view.model.get('omemo_supported')).toBe(true);

            toggle.click();
            toggle = toolbar.querySelector('.toggle-omemo');
            expect(view.model.get('omemo_active')).toBe(true);
            expect(u.hasClass('fa-unlock', toggle)).toBe(false);
            expect(u.hasClass('fa-lock', toggle)).toBe(true);
            expect(u.hasClass('disabled', toggle)).toBe(false);
            expect(view.model.get('omemo_supported')).toBe(true);

            let contact_jid = 'newguy@montague.lit';
            let stanza = $pres({
                    to: 'romeo@montague.lit/orchard',
                    from: 'lounge@montague.lit/newguy'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newguy@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                }).tree();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="${contact_jid}" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</pubsub>`+
                `</iq>`);

            stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '4e30f35051b7b8b42abe083742187228'}).up()
                            .c('device', {'id': 'ae890ac52d0df67ed7cfdf51b644e901'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.omemo_store);
            expect(_converse.devicelists.length).toBe(2);

            await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
            const devicelist = _converse.devicelists.get(contact_jid);
            expect(devicelist.devices.length).toBe(2);
            expect(devicelist.devices.at(0).get('id')).toBe('4e30f35051b7b8b42abe083742187228');
            expect(devicelist.devices.at(1).get('id')).toBe('ae890ac52d0df67ed7cfdf51b644e901');

            expect(view.model.get('omemo_active')).toBe(true);
            toggle = toolbar.querySelector('.toggle-omemo');
            expect(toggle === null).toBe(false);
            expect(u.hasClass('fa-unlock', toggle)).toBe(false);
            expect(u.hasClass('fa-lock', toggle)).toBe(true);
            expect(u.hasClass('disabled', toggle)).toBe(false);
            expect(view.model.get('omemo_supported')).toBe(true);

            // Test that the button gets disabled when the room becomes
            // anonymous or semi-anonymous
            view.model.features.save({'nonanonymous': false, 'semianonymous': true});
            await u.waitUntil(() => !view.model.get('omemo_supported'));
            toggle = toolbar.querySelector('.toggle-omemo');
            expect(toggle === null).toBe(true);
            expect(view.model.get('omemo_supported')).toBe(false);

            view.model.features.save({'nonanonymous': true, 'semianonymous': false});
            await u.waitUntil(() => view.model.get('omemo_supported'));
            toggle = toolbar.querySelector('.toggle-omemo');
            expect(toggle === null).toBe(false);
            expect(u.hasClass('fa-unlock', toggle)).toBe(true);
            expect(u.hasClass('fa-lock', toggle)).toBe(false);
            expect(u.hasClass('disabled', toggle)).toBe(false);

            // Test that the button gets disabled when the room becomes open
            view.model.features.save({'membersonly': false, 'open': true});
            await u.waitUntil(() => !view.model.get('omemo_supported'));
            toggle = toolbar.querySelector('.toggle-omemo');
            expect(toggle === null).toBe(true);

            view.model.features.save({'membersonly': true, 'open': false});
            await u.waitUntil(() => view.model.get('omemo_supported'));
            toggle = toolbar.querySelector('.toggle-omemo');
            expect(toggle === null).toBe(false);
            expect(u.hasClass('fa-unlock', toggle)).toBe(true);
            expect(u.hasClass('fa-lock', toggle)).toBe(false);
            expect(u.hasClass('disabled', toggle)).toBe(false);
            expect(view.model.get('omemo_supported')).toBe(true);
            expect(view.model.get('omemo_active')).toBe(false);

            toggle.click();
            expect(view.model.get('omemo_active')).toBe(true);

            // Someone enters the room who doesn't have OMEMO support, while we
            // have OMEMO activated...
            contact_jid = 'oldguy@montague.lit';
            stanza = $pres({
                    to: 'romeo@montague.lit/orchard',
                    from: 'lounge@montague.lit/oldguy'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': `${contact_jid}/_converse.js-290929788`,
                    'role': 'participant'
                }).tree();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="${contact_jid}" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.devicelist"/>`+
                    `</pubsub>`+
                `</iq>`);

            stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'error'
            }).c('error', {'type': 'cancel'})
                .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            await u.waitUntil(() => !view.model.get('omemo_supported'));

            expect(view.el.querySelector('.chat-error').textContent.trim()).toBe(
                "oldguy doesn't appear to have a client that supports OMEMO. "+
                "Encrypted chat will no longer be possible in this grouchat."
            );

            toggle = toolbar.querySelector('.toggle-omemo');
            expect(toggle === null).toBe(false);
            expect(u.hasClass('fa-unlock', toggle)).toBe(true);
            expect(u.hasClass('fa-lock', toggle)).toBe(false);
            expect(u.hasClass('disabled', toggle)).toBe(true);

            expect( _converse.chatboxviews.el.querySelector('.modal-body p')).toBe(null);
            toggle.click();
            const msg = _converse.chatboxviews.el.querySelector('.modal-body p');
            expect(msg.textContent).toBe(
                'Cannot use end-to-end encryption in this groupchat, '+
                'either the groupchat has some anonymity or not all participants support OMEMO.');
            done();
        }));


        it("shows OMEMO device fingerprints in the user details modal",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitUntilDiscoConfirmed(
                _converse, _converse.bare_jid,
                [{'category': 'pubsub', 'type': 'pep'}],
                ['http://jabber.org/protocol/pubsub#publish-options']
            );

            await test_utils.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            // We simply emit, to avoid doing all the setup work
            _converse.api.trigger('OMEMOInitialized');

            const view = _converse.chatboxviews.get(contact_jid);
            const show_modal_button = view.el.querySelector('.show-user-details-modal');
            show_modal_button.click();
            const modal = view.user_details_modal;
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            let iq_stanza = await u.waitUntil(() => deviceListFetched(_converse, contact_jid));
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="mercutio@montague.lit" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub"><items node="eu.siacs.conversations.axolotl.devicelist"/></pubsub>`+
                `</iq>`);
            let stanza = $iq({
                'from': contact_jid,
                'id': iq_stanza.getAttribute('id'),
                'to': _converse.bare_jid,
                'type': 'result',
            }).c('pubsub', {'xmlns': "http://jabber.org/protocol/pubsub"})
                .c('items', {'node': "eu.siacs.conversations.axolotl.devicelist"})
                    .c('item', {'xmlns': "http://jabber.org/protocol/pubsub"}) // TODO: must have an id attribute
                        .c('list', {'xmlns': "eu.siacs.conversations.axolotl"})
                            .c('device', {'id': '555'});
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            iq_stanza = await u.waitUntil(() => bundleFetched(_converse, contact_jid, '555'));
            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="mercutio@montague.lit" type="get" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<items node="eu.siacs.conversations.axolotl.bundles:555"/>`+
                    `</pubsub>`+
                `</iq>`);
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
                            .c('identityKey').t('BQmHEOHjsYm3w5M8VqxAtqJmLCi7CaxxsdZz6G0YpuMI').up()
                            .c('prekeys')
                                .c('preKeyPublic', {'preKeyId': '1'}).t(btoa('1001')).up()
                                .c('preKeyPublic', {'preKeyId': '2'}).t(btoa('1002')).up()
                                .c('preKeyPublic', {'preKeyId': '3'}).t(btoa('1003'));
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            await u.waitUntil(() => modal.el.querySelectorAll('.fingerprints .fingerprint').length);
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
}));
