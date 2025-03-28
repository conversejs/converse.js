/*global mock, converse */

const { Strophe, sizzle, stx, u, omemo } = converse.env;

describe("An OMEMO encrypted message", function() {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("can be edited", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.initializedOMEMO(_converse);
        await mock.openChatBoxFor(_converse, contact_jid);
        await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid, ['555']));
        await u.waitUntil(() => _converse.state.omemo_store);
        const devicelist = _converse.state.devicelists.get({'jid': contact_jid});
        await u.waitUntil(() => devicelist.devices.length === 1);

        const view = _converse.chatboxviews.get(contact_jid);
        view.model.set('omemo_active', true);

        const textarea = view.querySelector('.chat-textarea');
        textarea.value = 'But soft, what light through yonder airlock breaks?';
        const message_form = view.querySelector('converse-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            key: "Enter",
        });

        await u.waitUntil(() => mock.bundleFetched(_converse, {
            jid: contact_jid,
            device_id: '555',
            identity_key: '3333',
            signed_prekey_id: "4223",
            signed_prekey_public: "1111",
            signed_prekey_sig: "2222",
            prekeys: ['1001', '1002', '1003'],
        }));
        await u.waitUntil(() =>
            mock.bundleFetched(_converse, {
                jid: _converse.bare_jid,
                device_id: "482886413b977930064a5888b92134fe",
                identity_key: '300000',
                signed_prekey_id: "4224",
                signed_prekey_public: "100000",
                signed_prekey_sig: "200000",
                prekeys: ["1991", "1992", "1993"],
            })
        );

        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.querySelector('.chat-msg__text').textContent)
            .toBe('But soft, what light through yonder airlock breaks?');

        await u.waitUntil(() => textarea.value === '');

        message_form.onKeyDown({
            target: textarea,
            key: "ArrowUp",
        });
        expect(textarea.value).toBe('But soft, what light through yonder airlock breaks?');
        expect(view.model.messages.at(0).get('correcting')).toBe(true);

        const first_msg = view.model.messages.findWhere({'message': 'But soft, what light through yonder airlock breaks?'});

        const newer_text = 'But soft, what light through yonder door breaks?';
        textarea.value = newer_text;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            key: "Enter",
        });
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.replace(/<!-.*?->/g, '') === newer_text);

        await u.waitUntil(() => _converse.api.connection.get().sent_stanzas.filter(s => s.nodeName === 'message').length === 3);
        const msg = _converse.api.connection.get().sent_stanzas.pop();
        const fallback_text = 'This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo';

        expect(msg).toEqualStanza(stx`
            <message from="romeo@montague.lit/orchard" id="${msg.getAttribute('id')}"
                to="mercutio@montague.lit" type="chat"
                xmlns="jabber:client">
                    <body>${fallback_text}</body>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                    <request xmlns="urn:xmpp:receipts"/>
                    <replace id="${first_msg.get("msgid")}" xmlns="urn:xmpp:message-correct:0"/>
                    <origin-id id="${msg.querySelector('origin-id').getAttribute('id')}" xmlns="urn:xmpp:sid:0"/>
                    <encrypted xmlns="eu.siacs.conversations.axolotl">
                        <header sid="123456789">
                            <key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>
                            <key rid="555">YzFwaDNSNzNYNw==</key>
                            <iv>${msg.querySelector('header iv').textContent}</iv>
                        </header>
                        <payload>${msg.querySelector('payload').textContent}</payload>
                    </encrypted>
                    <store xmlns="urn:xmpp:hints"/>
                    <encryption namespace="eu.siacs.conversations.axolotl" xmlns="urn:xmpp:eme:0"/>
            </message>`);

        let older_versions = first_msg.get('older_versions');
        let keys = Object.keys(older_versions);
        expect(keys.length).toBe(1);
        expect(older_versions[keys[0]]).toBe('But soft, what light through yonder airlock breaks?');
        expect(first_msg.get('plaintext')).toBe(newer_text);
        expect(first_msg.get('is_encrypted')).toBe(true);
        expect(first_msg.get('body')).toBe(fallback_text);
        expect(first_msg.get('message')).toBe(fallback_text);

        message_form.onKeyDown({
            target: textarea,
            key: "ArrowUp",
        });
        expect(textarea.value).toBe('But soft, what light through yonder door breaks?');

        const newest_text = 'But soft, what light through yonder window breaks?';
        textarea.value = newest_text;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            key: "Enter",
        });
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.replace(/<!-.*?->/g, '') === newest_text);

        keys = Object.keys(older_versions);
        expect(keys.length).toBe(2);
        expect(older_versions[keys[0]]).toBe('But soft, what light through yonder airlock breaks?');
        expect(older_versions[keys[1]]).toBe('But soft, what light through yonder door breaks?');

        const first_rcvd_msg_id = u.getUniqueId();
        let obj = await omemo.encryptMessage('This is an encrypted message from the contact')
        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <message from="${contact_jid}"
                    to="${_converse.api.connection.get().jid}"
                    type="chat"
                    id="${first_rcvd_msg_id}"
                    xmlns="jabber:client">
                <body>${fallback_text}</body>
                <origin-id id="${first_rcvd_msg_id}" xmlns="urn:xmpp:sid:0"/>
                <encrypted xmlns="${Strophe.NS.OMEMO}">
                    <header sid="555">
                        <key rid="${_converse.state.omemo_store.get('device_id')}">${u.arrayBufferToBase64(obj.key_and_tag)}</key>
                        <iv>${obj.iv}</iv>
                    </header>
                    <payload>${obj.payload}</payload>
                </encrypted>
            </message>`));
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.model.messages.length).toBe(2);
        expect(view.querySelectorAll('.chat-msg__body')[1].textContent.trim())
            .toBe('This is an encrypted message from the contact');

        const msg_id = u.getUniqueId();
        obj = await omemo.encryptMessage('This is an edited encrypted message from the contact')
        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <message from="${contact_jid}"
                     to="${_converse.api.connection.get().jid}"
                     type="chat"
                     id="${msg_id}"
                     xmlns="jabber:client">
                <body>${fallback_text}</body>
                <replace id="${first_rcvd_msg_id}" xmlns="urn:xmpp:message-correct:0"/>
                <origin-id id="${msg_id}" xmlns="urn:xmpp:sid:0"/>
                <encrypted xmlns="${Strophe.NS.OMEMO}">
                    <header sid="555">
                        <key rid="${_converse.state.omemo_store.get('device_id')}">${u.arrayBufferToBase64(obj.key_and_tag)}</key>
                        <iv>${obj.iv}</iv>
                    </header>
                    <payload>${obj.payload}</payload>
                </encrypted>
            </message>`));
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.model.messages.length).toBe(2);
        expect(view.querySelectorAll('.chat-msg__body')[1].textContent.trim())
            .toBe('This is an edited encrypted message from the contact');

        const message = view.model.messages.at(1);
        older_versions = message.get('older_versions');
        keys = Object.keys(older_versions);
        expect(keys.length).toBe(1);
        expect(older_versions[keys[0]]).toBe('This is an encrypted message from the contact');
        expect(message.get('plaintext')).toBe('This is an edited encrypted message from the contact');
        expect(message.get('is_encrypted')).toBe(true);
        expect(message.get('body')).toBe(fallback_text);
        expect(message.get('message')).toBe(fallback_text);
        expect(message.get('msgid')).toBe(first_rcvd_msg_id);
    }));
});

describe("An OMEMO encrypted MUC message", function() {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

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
        const { api } = _converse;
        const { jid: own_jid } = api.connection.get();
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterMUC(_converse, muc_jid, nick, features);
        await u.waitUntil(() => mock.initializedOMEMO(_converse));

        const view = _converse.chatboxviews.get(muc_jid);
        const toolbar = await u.waitUntil(() => view.querySelector('.chat-toolbar'));
        const omemo_toggle = await u.waitUntil(() => toolbar.querySelector('.toggle-omemo'));
        omemo_toggle.click();
        expect(view.model.get('omemo_active')).toBe(true);

        // newguy enters the room
        const contact_jid = 'newguy@montague.lit';
        let stanza = stx`
            <presence to='romeo@montague.lit/orchard' from='lounge@montague.lit/newguy' xmlns="jabber:client">
                <x xmlns='${Strophe.NS.MUC_USER}'>
                    <item affiliation='none' jid='newguy@montague.lit/_converse.js-290929789' role='participant'/>
                </x>
            </presence>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

        // Wait for Converse to fetch newguy's device list
        let iq_stanza = await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        expect(iq_stanza).toEqualStanza(stx`
            <iq from="romeo@montague.lit" id="${iq_stanza.getAttribute("id")}" to="${contact_jid}" type="get" xmlns="jabber:client">
                <pubsub xmlns="http://jabber.org/protocol/pubsub">
                    <items node="eu.siacs.conversations.axolotl.devicelist"/>
                </pubsub>
            </iq>`);

        // The server returns his device list
        stanza = stx`
            <iq from='${contact_jid}'
                    id='${iq_stanza.getAttribute('id')}'
                    to='${_converse.bare_jid}'
                    type='result'
                    xmlns='jabber:client'>
                <pubsub xmlns='http://jabber.org/protocol/pubsub'>
                    <items node='eu.siacs.conversations.axolotl.devicelist'>
                        <item xmlns='http://jabber.org/protocol/pubsub'> <!-- TODO: must have an id attribute -->
                            <list xmlns='eu.siacs.conversations.axolotl'>
                                <device id='4e30f35051b7b8b42abe083742187228'/>
                            </list>
                        </item>
                    </items>
                </pubsub>
            </iq>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.state.omemo_store);
        expect(_converse.state.devicelists.length).toBe(2);

        await u.waitUntil(() => mock.deviceListFetched(_converse, contact_jid));
        const devicelist = _converse.state.devicelists.get(contact_jid);
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
            key: "Enter",
        });

        await u.waitUntil(() => mock.bundleFetched(_converse, {
            jid: contact_jid,
            device_id: '4e30f35051b7b8b42abe083742187228',
            identity_key: '3333',
            signed_prekey_id: "4223",
            signed_prekey_public: "1111",
            signed_prekey_sig: "2222",
            prekeys: ['1001', '1002', '1003'],
        }));
        await u.waitUntil(() =>
            mock.bundleFetched(_converse, {
                jid: _converse.bare_jid,
                device_id: "482886413b977930064a5888b92134fe",
                identity_key: '300000',
                signed_prekey_id: "4224",
                signed_prekey_public: "100000",
                signed_prekey_sig: "200000",
                prekeys: ["1991", "1992", "1993"],
            })
        );

        const sent_stanzas = _converse.api.connection.get().sent_stanzas;
        const sent_stanza = await u.waitUntil(() => sent_stanzas.filter((s) => sizzle('body', s).length).pop(), 1000);

        expect(sent_stanza).toEqualStanza(stx`
            <message from="${own_jid}"
                     id="${sent_stanza.getAttribute("id")}"
                     to="lounge@montague.lit"
                     type="groupchat"
                     xmlns="jabber:client">
                <body>This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <origin-id id="${sent_stanza.getAttribute('id')}" xmlns="urn:xmpp:sid:0"/>
                <encrypted xmlns="eu.siacs.conversations.axolotl">
                    <header sid="123456789">
                        <key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>
                        <key rid="4e30f35051b7b8b42abe083742187228">YzFwaDNSNzNYNw==</key>
                        <iv>${sent_stanza.querySelector("iv").textContent}</iv>
                    </header>
                    <payload>${sent_stanza.querySelector("payload").textContent}</payload>
                </encrypted>
                <store xmlns="urn:xmpp:hints"/>
                <encryption namespace="eu.siacs.conversations.axolotl" xmlns="urn:xmpp:eme:0"/>
            </message>`);

        await u.waitUntil(() => textarea.value === '');

        const first_msg = view.model.messages.findWhere({'message': original_text});

        message_form.onKeyDown({
            target: textarea,
            key: "ArrowUp",
        });
        expect(textarea.value).toBe(original_text);
        expect(view.model.messages.at(0).get('correcting')).toBe(true);

        const new_text = 'This is an edit of the encrypted message';
        textarea.value = new_text;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            key: "Enter",
        });
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.replace(/<!-.*?->/g, '') === new_text);

        const fallback_text = 'This is an OMEMO encrypted message which your client doesn’t seem to support. Find more information on https://conversations.im/omemo';
        let older_versions = first_msg.get('older_versions');
        let keys = Object.keys(older_versions);
        expect(keys.length).toBe(1);
        expect(older_versions[keys[0]]).toBe(original_text);
        expect(first_msg.get('plaintext')).toBe(new_text);
        expect(first_msg.get('is_encrypted')).toBe(true);
        expect(first_msg.get('body')).toBe(fallback_text);
        expect(first_msg.get('message')).toBe(fallback_text);

        await u.waitUntil(() => _converse.api.connection.get().sent_stanzas.filter(s => s.nodeName === 'message').length === 2);
        const msg = _converse.api.connection.get().sent_stanzas.pop();

        expect(msg).toEqualStanza(stx`
            <message from="${own_jid}" id="${msg.getAttribute("id")}" to="${muc_jid}" type="groupchat" xmlns="jabber:client">
                <body>${fallback_text}</body>
                <active xmlns="http://jabber.org/protocol/chatstates"/>
                <replace id="${first_msg.get("msgid")}" xmlns="urn:xmpp:message-correct:0"/>
                <origin-id id="${msg.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>
                <encrypted xmlns="eu.siacs.conversations.axolotl">
                    <header sid="123456789">
                        <key rid="482886413b977930064a5888b92134fe">YzFwaDNSNzNYNw==</key>
                        <key rid="4e30f35051b7b8b42abe083742187228">YzFwaDNSNzNYNw==</key>
                        <iv>${msg.querySelector("iv").textContent}</iv>
                    </header>
                    <payload>${msg.querySelector("payload").textContent}</payload>
                </encrypted>
                <store xmlns="urn:xmpp:hints"/>
                <encryption namespace="eu.siacs.conversations.axolotl" xmlns="urn:xmpp:eme:0"/>
            </message>`);


        // Test reception of an encrypted message
        const first_received_id = _converse.api.connection.get().getUniqueId()
        const first_received_message = 'This is an encrypted message from the contact';
        const first_obj = await omemo.encryptMessage(first_received_message)
        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <message from="${muc_jid}/newguy"
                     to="${_converse.api.connection.get().jid}"
                     type="groupchat"
                     id="${first_received_id}"
                     xmlns="jabber:client">
                <body>${fallback_text}</body>
                <encrypted xmlns="${Strophe.NS.OMEMO}">
                    <header sid="555">
                        <key rid="${_converse.state.omemo_store.get('device_id')}">${u.arrayBufferToBase64(first_obj.key_and_tag)}</key>
                        <iv>${first_obj.iv}</iv>
                    </header>
                    <payload>${first_obj.payload}</payload>
                </encrypted>
            </message>`));

        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.model.messages.length).toBe(2);
        expect(view.querySelectorAll('.chat-msg__body')[1].textContent.trim()).toBe(first_received_message);
        expect(_converse.state.devicelists.length).toBe(2);
        expect(_converse.state.devicelists.at(0).get('jid')).toBe(_converse.bare_jid);
        expect(_converse.state.devicelists.at(1).get('jid')).toBe(contact_jid);

        const second_received_message = 'This is an edited encrypted message from the contact';
        const second_obj = await omemo.encryptMessage(second_received_message)
        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <message from="${muc_jid}/newguy"
                     to="${_converse.api.connection.get().jid}"
                     type="groupchat"
                     id="${_converse.api.connection.get().getUniqueId()}"
                     xmlns="jabber:client">
                <body>${fallback_text}</body>
                <replace id="${first_received_id}" xmlns="urn:xmpp:message-correct:0"/>
                <encrypted xmlns="${Strophe.NS.OMEMO}">
                    <header sid="555">
                        <key rid="${_converse.state.omemo_store.get('device_id')}">${u.arrayBufferToBase64(second_obj.key_and_tag)}</key>
                        <iv>${second_obj.iv}</iv>
                    </header>
                    <payload>${second_obj.payload}</payload>
                </encrypted>
            </message>`));
        await new Promise(resolve => view.model.messages.once('rendered', resolve));

        expect(view.model.messages.length).toBe(2);
        expect(view.querySelectorAll('.chat-msg__body')[1].textContent.trim()).toBe(second_received_message);

        const message = view.model.messages.at(1);
        older_versions = message.get('older_versions');
        keys = Object.keys(older_versions);
        expect(keys.length).toBe(1);
        expect(older_versions[keys[0]]).toBe('This is an encrypted message from the contact');
        expect(message.get('plaintext')).toBe('This is an edited encrypted message from the contact');
        expect(message.get('is_encrypted')).toBe(true);
        expect(message.get('body')).toBe(fallback_text);
        expect(message.get('msgid')).toBe(first_received_id);
    }));
});
