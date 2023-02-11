/*global mock, converse */

const { $iq, $msg, $pres, Strophe, omemo } = converse.env;
const u = converse.env.utils;

describe("The OMEMO module", function() {

    it("enables encrypted groupchat messages to be sent and received",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

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
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
        const view = _converse.chatboxviews.get('lounge@montague.lit');
        await u.waitUntil(() => mock.initializedOMEMO(_converse));

        const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
        const el = await u.waitUntil(() => toolbar.querySelector('.toggle-omemo'));
        el.click();
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

        const icon = toolbar.querySelector('.toggle-omemo converse-icon');
        expect(u.hasClass('fa-unlock', icon)).toBe(false);
        expect(u.hasClass('fa-lock', icon)).toBe(true);

        const textarea = view.querySelector('.chat-textarea');
        textarea.value = 'This message will be encrypted';
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

        spyOn(_converse.connection, 'send');
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

        // Test reception of an encrypted message
        const obj = await omemo.encryptMessage('This is an encrypted message from the contact')
        // XXX: Normally the key will be encrypted via libsignal.
        // However, we're mocking libsignal in the tests, so we include it as plaintext in the message.
        stanza = $msg({
                'from': `${muc_jid}/newguy`,
                'to': _converse.connection.jid,
                'type': 'groupchat',
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

        expect(_converse.devicelists.length).toBe(2);
        expect(_converse.devicelists.at(0).get('jid')).toBe(_converse.bare_jid);
        expect(_converse.devicelists.at(1).get('jid')).toBe(contact_jid);
    }));

    it("gracefully handles auth errors when trying to send encrypted groupchat messages",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

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
        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo', features);
        const view = _converse.chatboxviews.get('lounge@montague.lit');
        await u.waitUntil(() => mock.initializedOMEMO(_converse));

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

        const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
        const toggle = await u.waitUntil(() => toolbar.querySelector('.toggle-omemo'));
        toggle.click();
        expect(view.model.get('omemo_active')).toBe(true);
        expect(view.model.get('omemo_supported')).toBe(true);

        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        textarea.value = 'This message will be encrypted';
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
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

        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.omemo_store);
        expect(_converse.devicelists.length).toBe(2);

        const devicelist = _converse.devicelists.get(contact_jid);
        await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        expect(devicelist.devices.length).toBe(1);
        expect(devicelist.devices.at(0).get('id')).toBe('4e30f35051b7b8b42abe083742187228');

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
        iq_stanza = await u.waitUntil(() => mock.bundleFetched(_converse, contact_jid, '4e30f35051b7b8b42abe083742187228'));

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
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => document.querySelectorAll('.alert-danger').length, 2000);
        const header = document.querySelector('.alert-danger .modal-title');
        expect(header.textContent).toBe("Error");
        expect(u.ancestor(header, '.modal-content').querySelector('.modal-body p').textContent.trim())
            .toBe("Sorry, we're unable to send an encrypted message because newguy@montague.lit requires you "+
                  "to be subscribed to their presence in order to see their OMEMO information");

        expect(view.model.get('omemo_supported')).toBe(false);
        expect(view.querySelector('.chat-textarea').value).toBe('This message will be encrypted');
    }));


    it("adds a toolbar button for starting an encrypted groupchat session",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
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
        await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo', features);
        const view = _converse.chatboxviews.get('lounge@montague.lit');
        await u.waitUntil(() => mock.initializedOMEMO(_converse));

        const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
        let toggle = await u.waitUntil(() => toolbar.querySelector('.toggle-omemo'));
        expect(view.model.get('omemo_active')).toBe(undefined);
        expect(view.model.get('omemo_supported')).toBe(true);
        await u.waitUntil(() => toggle.dataset.disabled === "false");

        let icon = toolbar.querySelector('.toggle-omemo converse-icon');
        expect(u.hasClass('fa-unlock', icon)).toBe(true);
        expect(u.hasClass('fa-lock', icon)).toBe(false);

        toggle.click();
        toggle = toolbar.querySelector('.toggle-omemo');
        expect(toggle.dataset.disabled).toBe("false");
        expect(view.model.get('omemo_active')).toBe(true);
        expect(view.model.get('omemo_supported')).toBe(true);

        await u.waitUntil(() => !u.hasClass('fa-unlock', toolbar.querySelector('.toggle-omemo converse-icon')));
        expect(u.hasClass('fa-lock', toolbar.querySelector('.toggle-omemo converse-icon'))).toBe(true);

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
        _converse.connection._dataRecv(mock.createRequest(stanza));

        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
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
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.omemo_store);
        expect(_converse.devicelists.length).toBe(2);

        await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        const devicelist = _converse.devicelists.get(contact_jid);
        expect(devicelist.devices.length).toBe(2);
        expect(devicelist.devices.at(0).get('id')).toBe('4e30f35051b7b8b42abe083742187228');
        expect(devicelist.devices.at(1).get('id')).toBe('ae890ac52d0df67ed7cfdf51b644e901');

        expect(view.model.get('omemo_active')).toBe(true);
        toggle = toolbar.querySelector('.toggle-omemo');
        expect(toggle === null).toBe(false);
        expect(toggle.dataset.disabled).toBe("false");
        expect(view.model.get('omemo_supported')).toBe(true);

        await u.waitUntil(() => !u.hasClass('fa-unlock', toolbar.querySelector('.toggle-omemo converse-icon')));
        expect(u.hasClass('fa-lock', toolbar.querySelector('.toggle-omemo converse-icon'))).toBe(true);

        // Test that the button gets disabled when the room becomes
        // anonymous or semi-anonymous
        view.model.features.save({'nonanonymous': false, 'semianonymous': true});
        await u.waitUntil(() => !view.model.get('omemo_supported'));
        await u.waitUntil(() => view.querySelector('.toggle-omemo').dataset.disabled === "true");

        view.model.features.save({'nonanonymous': true, 'semianonymous': false});
        await u.waitUntil(() => view.model.get('omemo_supported'));
        await u.waitUntil(() => view.querySelector('.toggle-omemo') !== null);
        expect(u.hasClass('fa-unlock', toolbar.querySelector('.toggle-omemo converse-icon'))).toBe(true);
        expect(u.hasClass('fa-lock', toolbar.querySelector('.toggle-omemo converse-icon'))).toBe(false);
        expect(view.querySelector('.toggle-omemo').dataset.disabled).toBe("false");

        // Test that the button gets disabled when the room becomes open
        view.model.features.save({'membersonly': false, 'open': true});
        await u.waitUntil(() => !view.model.get('omemo_supported'));
        await u.waitUntil(() => view.querySelector('.toggle-omemo').dataset.disabled === "true");

        view.model.features.save({'membersonly': true, 'open': false});
        await u.waitUntil(() => view.model.get('omemo_supported'));
        await u.waitUntil(() => view.querySelector('.toggle-omemo').dataset.disabled === "false");

        expect(u.hasClass('fa-unlock', view.querySelector('.toggle-omemo converse-icon'))).toBe(true);
        expect(u.hasClass('fa-lock', view.querySelector('.toggle-omemo converse-icon'))).toBe(false);

        expect(view.model.get('omemo_supported')).toBe(true);
        expect(view.model.get('omemo_active')).toBe(false);

        view.querySelector('.toggle-omemo').click();
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
        _converse.connection._dataRecv(mock.createRequest(stanza));
        iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
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
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => !view.model.get('omemo_supported'));
        await u.waitUntil(() => view.querySelector('.chat-error .chat-info__message')?.textContent.trim() ===
            "oldguy doesn't appear to have a client that supports OMEMO. "+
            "Encrypted chat will no longer be possible in this grouchat."
        );

        await u.waitUntil(() => toolbar.querySelector('.toggle-omemo').dataset.disabled === "true");
        icon =  view.querySelector('.toggle-omemo converse-icon');
        expect(u.hasClass('fa-unlock', icon)).toBe(true);
        expect(u.hasClass('fa-lock', icon)).toBe(false);
        expect(toolbar.querySelector('.toggle-omemo').title).toBe('This groupchat needs to be members-only and non-anonymous in order to support OMEMO encrypted messages');
    }));
});
