/*global mock, converse */

const { $msg, $pres, Strophe, u } = converse.env;

describe("A Groupchat Message", function () {

    it("can be replaced with a correction",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        const stanza = $pres({
                to: 'romeo@montague.lit/_converse.js-29092160',
                from: 'coven@chat.shakespeare.lit/newguy'
            })
            .c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {
                'affiliation': 'none',
                'jid': 'newguy@montague.lit/_converse.js-290929789',
                'role': 'participant'
            }).tree();
        _converse.connection._dataRecv(mock.createRequest(stanza));
        const msg_id = u.getUniqueId();
        await view.model.handleMessageStanza($msg({
                'from': 'lounge@montague.lit/newguy',
                'to': _converse.connection.jid,
                'type': 'groupchat',
                'id': msg_id,
            }).c('body').t('But soft, what light through yonder airlock breaks?').tree());

        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.querySelector('.chat-msg__text').textContent)
            .toBe('But soft, what light through yonder airlock breaks?');

        await view.model.handleMessageStanza($msg({
                'from': 'lounge@montague.lit/newguy',
                'to': _converse.connection.jid,
                'type': 'groupchat',
                'id': u.getUniqueId(),
            }).c('body').t('But soft, what light through yonder chimney breaks?').up()
                .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent ===
            'But soft, what light through yonder chimney breaks?', 500);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        await u.waitUntil(() => view.querySelector('.chat-msg__content .fa-edit'));

        await view.model.handleMessageStanza($msg({
                'from': 'lounge@montague.lit/newguy',
                'to': _converse.connection.jid,
                'type': 'groupchat',
                'id': u.getUniqueId(),
            }).c('body').t('But soft, what light through yonder window breaks?').up()
                .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());

        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent ===
            'But soft, what light through yonder window breaks?', 500);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
        const edit = await u.waitUntil(() => view.querySelector('.chat-msg__content .fa-edit'));
        edit.click();
        const modal = _converse.api.modal.get('message-versions-modal');
        await u.waitUntil(() => u.isVisible(modal.el), 1000);
        const older_msgs = modal.el.querySelectorAll('.older-msg');
        expect(older_msgs.length).toBe(2);
        expect(older_msgs[0].textContent.includes('But soft, what light through yonder airlock breaks?')).toBe(true);
        expect(older_msgs[1].textContent.includes('But soft, what light through yonder chimney breaks?')).toBe(true);
    }));

    it("keeps the same position in history after a correction",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        const stanza = $pres({
                to: 'romeo@montague.lit/_converse.js-29092160',
                from: 'coven@chat.shakespeare.lit/newguy'
            })
            .c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {
                'affiliation': 'none',
                'jid': 'newguy@montague.lit/_converse.js-290929789',
                'role': 'participant'
            }).tree();
        _converse.connection._dataRecv(mock.createRequest(stanza));
        const msg_id = u.getUniqueId();

        // Receiving the first message
        await view.model.handleMessageStanza($msg({
                'from': 'lounge@montague.lit/newguy',
                'to': _converse.connection.jid,
                'type': 'groupchat',
                'id': msg_id,
            }).c('body').t('But soft, what light through yonder airlock breaks?').tree());

        // Receiving own message to check order against
        await view.model.handleMessageStanza($msg({
            'from': 'lounge@montague.lit/romeo',
            'to': _converse.connection.jid,
            'type': 'groupchat',
            'id': u.getUniqueId(),
        }).c('body').t('But soft, what light through yonder airlock breaks?').tree());

        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);
        expect(view.querySelectorAll('.chat-msg').length).toBe(2);
        expect(view.querySelectorAll('.chat-msg__text')[0].textContent)
            .toBe('But soft, what light through yonder airlock breaks?');
        expect(view.querySelectorAll('.chat-msg__text')[1].textContent)
        .toBe('But soft, what light through yonder airlock breaks?');

        // First message correction
        await view.model.handleMessageStanza($msg({
                'from': 'lounge@montague.lit/newguy',
                'to': _converse.connection.jid,
                'type': 'groupchat',
                'id': u.getUniqueId(),
            }).c('body').t('But soft, what light through yonder chimney breaks?').up()
                .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());

        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent ===
            'But soft, what light through yonder chimney breaks?', 500);
        expect(view.querySelectorAll('.chat-msg').length).toBe(2);
        await u.waitUntil(() => view.querySelector('.chat-msg__content .fa-edit'));

        // Second message correction
        await view.model.handleMessageStanza($msg({
                'from': 'lounge@montague.lit/newguy',
                'to': _converse.connection.jid,
                'type': 'groupchat',
                'id': u.getUniqueId(),
            }).c('body').t('But soft, what light through yonder window breaks?').up()
                .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());

        // Second own message
        await view.model.handleMessageStanza($msg({
            'from': 'lounge@montague.lit/romeo',
            'to': _converse.connection.jid,
            'type': 'groupchat',
            'id': u.getUniqueId(),
        }).c('body').t('But soft, what light through yonder window breaks?').tree());

        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text')[0].textContent ===
            'But soft, what light through yonder window breaks?', 500);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text')[2].textContent ===
            'But soft, what light through yonder window breaks?', 500);

        expect(view.querySelectorAll('.chat-msg').length).toBe(3);
        expect(view.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
        const edit = await u.waitUntil(() => view.querySelector('.chat-msg__content .fa-edit'));
        edit.click();
        const modal = _converse.api.modal.get('message-versions-modal');
        await u.waitUntil(() => u.isVisible(modal.el), 1000);
        const older_msgs = modal.el.querySelectorAll('.older-msg');
        expect(older_msgs.length).toBe(2);
        expect(older_msgs[0].textContent.includes('But soft, what light through yonder airlock breaks?')).toBe(true);
        expect(older_msgs[1].textContent.includes('But soft, what light through yonder chimney breaks?')).toBe(true);
    }));

    it("can be sent as a correction by using the up arrow",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        const textarea = await u.waitUntil(() => view.querySelector('textarea.chat-textarea'));
        expect(textarea.value).toBe('');
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });
        expect(textarea.value).toBe('');

        textarea.value = 'But soft, what light through yonder airlock breaks?';
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
        expect(view.querySelector('.chat-msg__text').textContent)
            .toBe('But soft, what light through yonder airlock breaks?');

        const first_msg = view.model.messages.findWhere({'message': 'But soft, what light through yonder airlock breaks?'});
        expect(textarea.value).toBe('');
        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });
        expect(textarea.value).toBe('But soft, what light through yonder airlock breaks?');
        expect(view.model.messages.at(0).get('correcting')).toBe(true);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        await u.waitUntil(() => u.hasClass('correcting', view.querySelector('.chat-msg')));

        spyOn(_converse.connection, 'send');
        const new_text = 'But soft, what light through yonder window breaks?'
        textarea.value = new_text;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => Array.from(view.querySelectorAll('.chat-msg__text'))
            .filter(m => m.textContent.replace(/<!-.*?->/g, '') === new_text).length);

        expect(_converse.connection.send).toHaveBeenCalled();
        const msg = _converse.connection.send.calls.all()[0].args[0];
        expect(Strophe.serialize(msg))
        .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.getAttribute("id")}" `+
                `to="lounge@montague.lit" type="groupchat" `+
                `xmlns="jabber:client">`+
                    `<body>But soft, what light through yonder window breaks?</body>`+
                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                    `<replace id="${first_msg.get("msgid")}" xmlns="urn:xmpp:message-correct:0"/>`+
                    `<origin-id id="${msg.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
            `</message>`);

        expect(view.model.messages.models.length).toBe(1);
        const corrected_message = view.model.messages.at(0);
        expect(corrected_message.get('msgid')).toBe(first_msg.get('msgid'));
        expect(corrected_message.get('correcting')).toBe(false);

        const older_versions = corrected_message.get('older_versions');
        const keys = Object.keys(older_versions);
        expect(keys.length).toBe(1);
        expect(older_versions[keys[0]]).toBe('But soft, what light through yonder airlock breaks?');

        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(u.hasClass('correcting', view.querySelector('.chat-msg'))).toBe(false);

        // Check that messages from other users are skipped
        await view.model.handleMessageStanza($msg({
            'from': muc_jid+'/someone-else',
            'id': u.getUniqueId(),
            'to': 'romeo@montague.lit',
            'type': 'groupchat'
        }).c('body').t('Hello world').tree());
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);
        expect(view.querySelectorAll('.chat-msg').length).toBe(2);

        // Test that pressing the down arrow cancels message correction
        expect(textarea.value).toBe('');
        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });
        expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
        expect(view.model.messages.at(0).get('correcting')).toBe(true);
        expect(view.querySelectorAll('.chat-msg').length).toBe(2);
        await u.waitUntil(() => u.hasClass('correcting', view.querySelector('.chat-msg')), 500);
        expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
        message_form.onKeyDown({
            target: textarea,
            keyCode: 40 // Down arrow
        });
        expect(textarea.value).toBe('');
        expect(view.model.messages.at(0).get('correcting')).toBe(false);
        expect(view.querySelectorAll('.chat-msg').length).toBe(2);
        await u.waitUntil(() => !u.hasClass('correcting', view.querySelector('.chat-msg')), 500);
    }));
});
