/*global mock, converse */

const { Strophe, $iq, $pres, u } = converse.env;

describe("An OMEMO encrypted message", function() {

    it("can be edited", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

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
        textarea.value = 'But soft, what light through yonder airlock breaks?';
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

        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.querySelector('.chat-msg__text').textContent)
            .toBe('But soft, what light through yonder airlock breaks?');

        await u.waitUntil(() => textarea.value === '');

        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });
        expect(textarea.value).toBe('But soft, what light through yonder airlock breaks?');
        expect(view.model.messages.at(0).get('correcting')).toBe(true);

        const first_msg = view.model.messages.findWhere({'message': 'But soft, what light through yonder airlock breaks?'});

        const newer_text = 'But soft, what light through yonder door breaks?';
        textarea.value = newer_text;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.replace(/<!-.*?->/g, '') === newer_text);

        await u.waitUntil(() => _converse.connection.sent_stanzas.filter(s => s.nodeName === 'message').length === 3);
        const msg = _converse.connection.sent_stanzas.pop();
        const fallback_text = 'This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo';

        expect(Strophe.serialize(msg))
        .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.getAttribute("id")}" `+
                `to="mercutio@montague.lit" type="chat" `+
                `xmlns="jabber:client">`+
                    `<body>${fallback_text}</body>`+
                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                    `<request xmlns="urn:xmpp:receipts"/>`+
                    `<replace id="${first_msg.get("msgid")}" xmlns="urn:xmpp:message-correct:0"/>`+
                    `<origin-id id="${msg.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                    `<encrypted xmlns="eu.siacs.conversations.axolotl">`+
                        `<header sid="123456789">`+
                            `<key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>`+
                            `<key rid="555">YzFwaDNSNzNYNw==</key>`+
                            `<iv>${msg.querySelector('header iv').textContent}</iv>`+
                        `</header>`+
                        `<payload>${msg.querySelector('payload').textContent}</payload>`+
                    `</encrypted>`+
                    `<store xmlns="urn:xmpp:hints"/>`+
                    `<encryption namespace="eu.siacs.conversations.axolotl" xmlns="urn:xmpp:eme:0"/>`+
            `</message>`);

        const older_versions = first_msg.get('older_versions');
        let keys = Object.keys(older_versions);
        expect(keys.length).toBe(1);
        expect(older_versions[keys[0]]).toBe('But soft, what light through yonder airlock breaks?');
        expect(first_msg.get('plaintext')).toBe(newer_text);
        expect(first_msg.get('is_encrypted')).toBe(true);
        expect(first_msg.get('body')).toBe(fallback_text);
        expect(first_msg.get('message')).toBe(fallback_text);

        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });
        expect(textarea.value).toBe('But soft, what light through yonder door breaks?');

        const newest_text = 'But soft, what light through yonder window breaks?';
        textarea.value = newest_text;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.replace(/<!-.*?->/g, '') === newest_text);

        keys = Object.keys(older_versions);
        expect(keys.length).toBe(2);
        expect(older_versions[keys[0]]).toBe('But soft, what light through yonder airlock breaks?');
        expect(older_versions[keys[1]]).toBe('But soft, what light through yonder door breaks?');
    }));
});

describe("An OMEMO encrypted MUC message", function() {

    it("can be edited", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

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
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick, features);
        await u.waitUntil(() => mock.initializedOMEMO(_converse));

        const view = _converse.chatboxviews.get(muc_jid);
        const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
        const omemo_toggle = await u.waitUntil(() => toolbar.querySelector('.toggle-omemo'));
        omemo_toggle.click();
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
        _converse.connection._dataRecv(mock.createRequest(stanza));

        // Wait for Converse to fetch newguy's device list
        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
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
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.omemo_store);
        expect(_converse.devicelists.length).toBe(2);

        await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        const devicelist = _converse.devicelists.get(contact_jid);
        expect(devicelist.devices.length).toBe(1);
        expect(devicelist.devices.at(0).get('id')).toBe('4e30f35051b7b8b42abe083742187228');
        expect(view.model.get('omemo_active')).toBe(true);

        const original_text = 'This message will be encrypted';
        const textarea = view.querySelector('.chat-textarea');
        textarea.value = original_text;
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });

        iq_stanza = await u.waitUntil(() => mock.bundleFetched(_converse, contact_jid, '4e30f35051b7b8b42abe083742187228'), 1000);
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
        _converse.connection._dataRecv(mock.createRequest(stanza));

        iq_stanza = await u.waitUntil(() => mock.bundleFetched(_converse, _converse.bare_jid, '482886413b977930064a5888b92134fe'), 1000);
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

        spyOn(_converse.connection, 'send').and.callThrough();
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.connection.send.calls.count(), 1000);
        const sent_stanza = _converse.connection.send.calls.all()[0].args[0];

        expect(Strophe.serialize(sent_stanza)).toBe(
            `<message from="romeo@montague.lit/orchard" `+
                     `id="${sent_stanza.getAttribute("id")}" `+
                     `to="lounge@montague.lit" `+
                     `type="groupchat" `+
                     `xmlns="jabber:client">`+
                `<body>This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo</body>`+
                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                `<origin-id id="${sent_stanza.getAttribute('id')}" xmlns="urn:xmpp:sid:0"/>`+
                `<encrypted xmlns="eu.siacs.conversations.axolotl">`+
                    `<header sid="123456789">`+
                        `<key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>`+
                        `<key rid="4e30f35051b7b8b42abe083742187228">YzFwaDNSNzNYNw==</key>`+
                        `<iv>${sent_stanza.querySelector("iv").textContent}</iv>`+
                    `</header>`+
                    `<payload>${sent_stanza.querySelector("payload").textContent}</payload>`+
                `</encrypted>`+
                `<store xmlns="urn:xmpp:hints"/>`+
                `<encryption namespace="eu.siacs.conversations.axolotl" xmlns="urn:xmpp:eme:0"/>`+
            `</message>`);

        await u.waitUntil(() => textarea.value === '');

        const first_msg = view.model.messages.findWhere({'message': original_text});

        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });
        expect(textarea.value).toBe(original_text);
        expect(view.model.messages.at(0).get('correcting')).toBe(true);

        const new_text = 'This is an edit of the encrypted message';
        textarea.value = new_text;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.replace(/<!-.*?->/g, '') === new_text);

        const fallback_text = 'This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo';
        const older_versions = first_msg.get('older_versions');
        const keys = Object.keys(older_versions);
        expect(keys.length).toBe(1);
        expect(older_versions[keys[0]]).toBe(original_text);
        expect(first_msg.get('plaintext')).toBe(new_text);
        expect(first_msg.get('is_encrypted')).toBe(true);
        expect(first_msg.get('body')).toBe(fallback_text);
        expect(first_msg.get('message')).toBe(fallback_text);

        await u.waitUntil(() => _converse.connection.sent_stanzas.filter(s => s.nodeName === 'message').length === 2);
        const msg = _converse.connection.sent_stanzas.pop();

        expect(Strophe.serialize(msg))
            .toBe(`<message from="${_converse.jid}" id="${msg.getAttribute("id")}" to="${muc_jid}" type="groupchat" xmlns="jabber:client">`+
                    `<body>${fallback_text}</body>`+
                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                    `<replace id="${first_msg.get("msgid")}" xmlns="urn:xmpp:message-correct:0"/>`+
                    `<origin-id id="${msg.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                    `<encrypted xmlns="eu.siacs.conversations.axolotl">`+
                        `<header sid="123456789">`+
                            `<key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>`+
                            `<key rid="4e30f35051b7b8b42abe083742187228">YzFwaDNSNzNYNw==</key>`+
                            `<iv>${msg.querySelector("iv").textContent}</iv>`+
                        `</header>`+
                        `<payload>${msg.querySelector("payload").textContent}</payload>`+
                    `</encrypted>`+
                    `<store xmlns="urn:xmpp:hints"/>`+
                    `<encryption namespace="eu.siacs.conversations.axolotl" xmlns="urn:xmpp:eme:0"/>`+
                `</message>`);
    }));

});
