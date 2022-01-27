/*global mock, converse */

const { Promise, $msg, Strophe, sizzle, u } = converse.env;

describe("A Chat Message", function () {

    it("can be sent as a correction by using the up arrow",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        await mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)
        const view = _converse.chatboxviews.get(contact_jid);
        const textarea = view.querySelector('textarea.chat-textarea');
        expect(textarea.value).toBe('');
        const message_form = view.querySelector('converse-message-form');
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
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
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
        await u.waitUntil(() => u.hasClass('correcting', view.querySelector('.chat-msg')), 500);

        spyOn(_converse.connection, 'send');
        let new_text = 'But soft, what light through yonder window breaks?';
        textarea.value = new_text;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.replace(/<!-.*?->/g, '') === new_text);

        expect(_converse.connection.send).toHaveBeenCalled();
        const msg = _converse.connection.send.calls.all()[0].args[0];
        expect(Strophe.serialize(msg))
        .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.getAttribute("id")}" `+
                `to="mercutio@montague.lit" type="chat" `+
                `xmlns="jabber:client">`+
                    `<body>But soft, what light through yonder window breaks?</body>`+
                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                    `<request xmlns="urn:xmpp:receipts"/>`+
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
        await u.waitUntil(() => (u.hasClass('correcting', view.querySelector('.chat-msg')) === false), 500);

        // Test that pressing the down arrow cancels message correction
        await u.waitUntil(() => textarea.value === '')
        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });
        expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
        expect(view.model.messages.at(0).get('correcting')).toBe(true);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        await u.waitUntil(() => u.hasClass('correcting', view.querySelector('.chat-msg')), 500);
        expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
        message_form.onKeyDown({
            target: textarea,
            keyCode: 40 // Down arrow
        });
        expect(textarea.value).toBe('');
        expect(view.model.messages.at(0).get('correcting')).toBe(false);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        await u.waitUntil(() => (u.hasClass('correcting', view.querySelector('.chat-msg')) === false), 500);

        new_text = 'It is the east, and Juliet is the one.';
        textarea.value = new_text;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => Array.from(view.querySelectorAll('.chat-msg__text'))
            .filter(m => m.textContent.replace(/<!-.*?->/g, '') === new_text).length);
        expect(view.querySelectorAll('.chat-msg').length).toBe(2);

        textarea.value =  'Arise, fair sun, and kill the envious moon';
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 3);

        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });
        expect(textarea.value).toBe('Arise, fair sun, and kill the envious moon');
        await u.waitUntil(() => view.model.messages.at(2).get('correcting') === true);
        expect(view.model.messages.at(0).get('correcting')).toBeFalsy();
        expect(view.model.messages.at(1).get('correcting')).toBeFalsy();
        await u.waitUntil(() => u.hasClass('correcting', sizzle('.chat-msg:last', view).pop()), 750);

        textarea.selectionEnd = 0; // Happens by pressing up,
                                // but for some reason not in tests, so we set it manually.
        message_form.onKeyDown({
            target: textarea,
            keyCode: 38 // Up arrow
        });
        expect(textarea.value).toBe('It is the east, and Juliet is the one.');
        expect(view.model.messages.at(0).get('correcting')).toBeFalsy();
        expect(view.model.messages.at(1).get('correcting')).toBe(true);
        expect(view.model.messages.at(2).get('correcting')).toBeFalsy();
        await u.waitUntil(() => u.hasClass('correcting', sizzle('.chat-msg', view)[1]), 500);

        textarea.value = 'It is the east, and Juliet is the sun.';
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => textarea.value === '');
        await u.waitUntil(() => Array.from(view.querySelectorAll('.chat-msg__text')).filter(
            m => m.textContent === 'It is the east, and Juliet is the sun.').length);

        const messages = view.querySelectorAll('.chat-msg');
        expect(messages.length).toBe(3);
        expect(messages[0].querySelector('.chat-msg__text').textContent)
            .toBe('But soft, what light through yonder window breaks?');
        expect(messages[1].querySelector('.chat-msg__text').textContent)
            .toBe('It is the east, and Juliet is the sun.');
        expect(messages[2].querySelector('.chat-msg__text').textContent)
            .toBe('Arise, fair sun, and kill the envious moon');

        expect(view.model.messages.at(0).get('correcting')).toBeFalsy();
        expect(view.model.messages.at(1).get('correcting')).toBeFalsy();
        expect(view.model.messages.at(2).get('correcting')).toBeFalsy();
    }));


    it("can be sent as a correction by clicking the pencil icon",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        await mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        const textarea = view.querySelector('textarea.chat-textarea');

        textarea.value = 'But soft, what light through yonder airlock breaks?';
        const message_form = view.querySelector('converse-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.querySelector('.chat-msg__text').textContent)
            .toBe('But soft, what light through yonder airlock breaks?');
        await u.waitUntil(() => textarea.value === '');

        const first_msg = view.model.messages.findWhere({'message': 'But soft, what light through yonder airlock breaks?'});
        await u.waitUntil(() => view.querySelectorAll('.chat-msg .chat-msg__action').length === 2);
        let action = view.querySelector('.chat-msg .chat-msg__action');
        expect(action.textContent.trim()).toBe('Edit');

        action.style.opacity = 1;
        action.click();

        expect(textarea.value).toBe('But soft, what light through yonder airlock breaks?');
        expect(view.model.messages.at(0).get('correcting')).toBe(true);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        await u.waitUntil(() => u.hasClass('correcting', view.querySelector('.chat-msg')));

        spyOn(_converse.connection, 'send');
        const text = 'But soft, what light through yonder window breaks?';
        textarea.value = text;
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await u.waitUntil(() => view.querySelector('.chat-msg__text').textContent.replace(/<!-.*?->/g, '') === text);
        expect(_converse.connection.send).toHaveBeenCalled();

        const msg = _converse.connection.send.calls.all()[0].args[0];
        expect(Strophe.serialize(msg))
        .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.getAttribute("id")}" `+
                `to="mercutio@montague.lit" type="chat" `+
                `xmlns="jabber:client">`+
                    `<body>But soft, what light through yonder window breaks?</body>`+
                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                    `<request xmlns="urn:xmpp:receipts"/>`+
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

        await u.waitUntil(() => u.hasClass('correcting', view.querySelector('.chat-msg')) === false);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);

        // Test that clicking the pencil icon a second time cancels editing.
        action = view.querySelector('.chat-msg .chat-msg__action');
        action.style.opacity = 1;
        action.click();

        expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
        expect(view.model.messages.at(0).get('correcting')).toBe(true);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        await u.waitUntil(() => u.hasClass('correcting', view.querySelector('.chat-msg')) === true);

        action = view.querySelector('.chat-msg .chat-msg__action');
        action.style.opacity = 1;
        action.click();
        expect(view.model.messages.at(0).get('correcting')).toBe(false);
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(textarea.value).toBe('');
        await u.waitUntil(() => (u.hasClass('correcting', view.querySelector('.chat-msg')) === false), 500);

        // Test that messages from other users don't have the pencil icon
        _converse.handleMessageStanza(
            $msg({
                'from': contact_jid,
                'to': _converse.connection.jid,
                'type': 'chat',
                'id': u.getUniqueId()
            }).c('body').t('Hello').up()
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
        );
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.querySelectorAll('.chat-msg .chat-msg__action').length).toBe(2);

        // Test confirmation dialog
        spyOn(window, 'confirm').and.returnValue(true);
        textarea.value = 'But soft, what light through yonder airlock breaks?';
        action = view.querySelector('.chat-msg .chat-msg__action');
        action.style.opacity = 1;
        action.click();
        expect(window.confirm).toHaveBeenCalledWith(
            'You have an unsent message which will be lost if you continue. Are you sure?');
        expect(view.model.messages.at(0).get('correcting')).toBe(true);
        expect(textarea.value).toBe('But soft, what light through yonder window breaks?');

        textarea.value = 'But soft, what light through yonder airlock breaks?'
        action.click();
        expect(view.model.messages.at(0).get('correcting')).toBe(false);
        expect(window.confirm.calls.count()).toBe(2);
        expect(window.confirm.calls.argsFor(0)).toEqual(
            ['You have an unsent message which will be lost if you continue. Are you sure?']);
        expect(window.confirm.calls.argsFor(1)).toEqual(
            ['You have an unsent message which will be lost if you continue. Are you sure?']);
    }));


    describe("when received from someone else", function () {

        it("can be replaced with a correction",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const msg_id = u.getUniqueId();
            const view = await mock.openChatBoxFor(_converse, sender_jid);
            _converse.handleMessageStanza($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': msg_id,
                }).c('body').t('But soft, what light through yonder airlock breaks?').tree());
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder airlock breaks?');

            _converse.handleMessageStanza($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': u.getUniqueId(),
                }).c('body').t('But soft, what light through yonder chimney breaks?').up()
                .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            expect(view.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder chimney breaks?');
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
            expect(view.model.messages.models.length).toBe(1);

            _converse.handleMessageStanza($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': u.getUniqueId(),
                }).c('body').t('But soft, what light through yonder window breaks?').up()
                .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            expect(view.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder window breaks?');
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
            view.querySelector('.chat-msg__content .fa-edit').click();

            const modal = _converse.api.modal.get('message-versions-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            const older_msgs = modal.el.querySelectorAll('.older-msg');
            expect(older_msgs.length).toBe(2);
            expect(older_msgs[0].textContent.includes('But soft, what light through yonder airlock breaks?')).toBe(true);
            expect(view.model.messages.models.length).toBe(1);
        }));
    });
});
