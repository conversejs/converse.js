(function (root, factory) {
    define([
        "jquery",
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function ($, jasmine, mock, test_utils) {
    "use strict";
    const { Backbone, Promise, Strophe, $iq, $msg, $pres, b64_sha1, moment, sizzle, _ } = converse.env;
    const u = converse.env.utils;


    describe("A Chat Message", function () {

        it("can be sent as a correction by clicking the pencil icon",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const textarea = view.el.querySelector('textarea.chat-textarea');

            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder airlock breaks?');
            expect(textarea.value).toBe('');

            const first_msg = view.model.messages.findWhere({'message': 'But soft, what light through yonder airlock breaks?'});
            expect(view.el.querySelectorAll('.chat-msg .chat-msg__action').length).toBe(1);
            let action = view.el.querySelector('.chat-msg .chat-msg__action');
            expect(action.getAttribute('title')).toBe('Edit this message');

            action.style.opacity = 1;
            action.click();

            expect(textarea.value).toBe('But soft, what light through yonder airlock breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));
            expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(true);

            spyOn(_converse.connection, 'send');
            textarea.value = 'But soft, what light through yonder window breaks?';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            expect(_converse.connection.send).toHaveBeenCalled();
            await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));

            const msg = _converse.connection.send.calls.all()[0].args[0];
            expect(msg.toLocaleString())
            .toBe(`<message from="dummy@localhost/resource" id="${msg.nodeTree.getAttribute("id")}" `+
                    `to="max.frankfurter@localhost" type="chat" `+
                    `xmlns="jabber:client">`+
                        `<body>But soft, what light through yonder window breaks?</body>`+
                        `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                        `<request xmlns="urn:xmpp:receipts"/>`+
                        `<replace id="${first_msg.get("msgid")}" xmlns="urn:xmpp:message-correct:0"/>`+
                        `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                `</message>`);
            expect(view.model.messages.models.length).toBe(1);
            const corrected_message = view.model.messages.at(0);
            expect(corrected_message.get('msgid')).toBe(first_msg.get('msgid'));
            expect(corrected_message.get('correcting')).toBe(false);
            expect(corrected_message.get('older_versions').length).toBe(1);
            expect(corrected_message.get('older_versions')[0]).toBe('But soft, what light through yonder airlock breaks?');

            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(false);

            // Test that clicking the pencil icon a second time cancels editing.
            action = view.el.querySelector('.chat-msg .chat-msg__action');
            action.style.opacity = 1;
            action.click();
            await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));

            expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await test_utils.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')) === true);

            action = view.el.querySelector('.chat-msg .chat-msg__action');
            action.style.opacity = 1;
            action.click();
            expect(textarea.value).toBe('');
            expect(view.model.messages.at(0).get('correcting')).toBe(false);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await test_utils.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')) === false);

            // Test that messages from other users don't have the pencil icon
            _converse.chatboxes.onMessage(
                $msg({
                    'from': contact_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': (new Date()).getTime()
                }).c('body').t('Hello').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
            );
            expect(view.el.querySelectorAll('.chat-msg .chat-msg__action').length).toBe(1);
            done();
        }));


        it("can be sent as a correction by using the up arrow",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);
            const textarea = view.el.querySelector('textarea.chat-textarea');
            expect(textarea.value).toBe('');
            view.keyPressed({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('');

            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder airlock breaks?');

            const first_msg = view.model.messages.findWhere({'message': 'But soft, what light through yonder airlock breaks?'});
            expect(textarea.value).toBe('');
            view.keyPressed({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('But soft, what light through yonder airlock breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await test_utils.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')));

            spyOn(_converse.connection, 'send');
            textarea.value = 'But soft, what light through yonder window breaks?';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            expect(_converse.connection.send).toHaveBeenCalled();
            await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));

            const msg = _converse.connection.send.calls.all()[0].args[0];
            expect(msg.toLocaleString())
            .toBe(`<message from="dummy@localhost/resource" id="${msg.nodeTree.getAttribute("id")}" `+
                    `to="max.frankfurter@localhost" type="chat" `+
                    `xmlns="jabber:client">`+
                        `<body>But soft, what light through yonder window breaks?</body>`+
                        `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                        `<request xmlns="urn:xmpp:receipts"/>`+
                        `<replace id="${first_msg.get("msgid")}" xmlns="urn:xmpp:message-correct:0"/>`+
                        `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                `</message>`);
            expect(view.model.messages.models.length).toBe(1);
            const corrected_message = view.model.messages.at(0);
            expect(corrected_message.get('msgid')).toBe(first_msg.get('msgid'));
            expect(corrected_message.get('correcting')).toBe(false);
            expect(corrected_message.get('older_versions').length).toBe(1);
            expect(corrected_message.get('older_versions')[0]).toBe('But soft, what light through yonder airlock breaks?');

            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await test_utils.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')) === false);

            // Test that pressing the down arrow cancels message correction
            expect(textarea.value).toBe('');
            view.keyPressed({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await test_utils.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')) === true);
            expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
            view.keyPressed({
                target: textarea,
                keyCode: 40 // Down arrow
            });
            expect(textarea.value).toBe('');
            expect(view.model.messages.at(0).get('correcting')).toBe(false);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await test_utils.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')) === false);

            textarea.value = 'It is the east, and Juliet is the one.';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);

            textarea.value =  'Arise, fair sun, and kill the envious moon';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(3);

            view.keyPressed({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('Arise, fair sun, and kill the envious moon');
            expect(view.model.messages.at(0).get('correcting')).toBeFalsy();
            expect(view.model.messages.at(1).get('correcting')).toBeFalsy();
            expect(view.model.messages.at(2).get('correcting')).toBe(true);
            await test_utils.waitUntil(() => u.hasClass('correcting', sizzle('.chat-msg:last', view.el).pop()));

            textarea.selectionEnd = 0; // Happens by pressing up,
                                    // but for some reason not in tests, so we set it manually.
            view.keyPressed({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('It is the east, and Juliet is the one.');
            expect(view.model.messages.at(0).get('correcting')).toBeFalsy();
            expect(view.model.messages.at(1).get('correcting')).toBe(true);
            expect(view.model.messages.at(2).get('correcting')).toBeFalsy();
            await test_utils.waitUntil(() => u.hasClass('correcting', sizzle('.chat-msg', view.el)[1]));

            textarea.value = 'It is the east, and Juliet is the sun.';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));

            expect(textarea.value).toBe('');
            const messages = view.el.querySelectorAll('.chat-msg');
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
            done();
        }));


        it("can be received out of order, and will still be displayed in the right order",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();

            let message, msg;
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length)
            spyOn(_converse, 'log');
            spyOn(_converse.chatboxes, 'getChatBox').and.callThrough();
            _converse.filter_by_resource = true;

            /*  <message id='aeb213' to='juliet@capulet.lit/chamber'>
             *    <forwarded xmlns='urn:xmpp:forward:0'>
             *      <delay xmlns='urn:xmpp:delay' stamp='2010-07-10T23:08:25Z'/>
             *      <message xmlns='jabber:client'
             *          to='juliet@capulet.lit/balcony'
             *          from='romeo@montague.lit/orchard'
             *          type='chat'>
             *          <body>Call me but love, and I'll be new baptized; Henceforth I never will be Romeo.</body>
             *      </message>
             *    </forwarded>
             *  </message>
             */
            msg = $msg({'id': 'aeb213', 'to': _converse.bare_jid})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                    .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-02T13:08:25Z'}).up()
                    .c('message', {
                        'xmlns': 'jabber:client',
                        'to': _converse.bare_jid,
                        'from': sender_jid,
                        'type': 'chat'})
                    .c('body').t("message")
                    .tree();
            await _converse.chatboxes.onMessage(msg);
            await test_utils.waitUntil(() => _converse.api.chats.get().length);
            const view = _converse.chatboxviews.get(sender_jid);
            msg = $msg({'id': 'aeb214', 'to': _converse.bare_jid})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                    .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2017-12-31T22:08:25Z'}).up()
                    .c('message', {
                        'xmlns': 'jabber:client',
                        'to': _converse.bare_jid,
                        'from': sender_jid,
                        'type': 'chat'})
                    .c('body').t("Older message")
                    .tree();
            await _converse.chatboxes.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            msg = $msg({'id': 'aeb215', 'to': _converse.bare_jid})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                    .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-01T13:18:23Z'}).up()
                    .c('message', {
                        'xmlns': 'jabber:client',
                        'to': _converse.bare_jid,
                        'from': sender_jid,
                        'type': 'chat'})
                    .c('body').t("Inbetween message").up()
                    .tree();
            await _converse.chatboxes.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            msg = $msg({'id': 'aeb216', 'to': _converse.bare_jid})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                    .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-01T13:18:23Z'}).up()
                    .c('message', {
                        'xmlns': 'jabber:client',
                        'to': _converse.bare_jid,
                        'from': sender_jid,
                        'type': 'chat'})
                    .c('body').t("another inbetween message")
                    .tree();
            await _converse.chatboxes.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            msg = $msg({'id': 'aeb217', 'to': _converse.bare_jid})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                    .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-02T12:18:23Z'}).up()
                    .c('message', {
                        'xmlns': 'jabber:client',
                        'to': _converse.bare_jid,
                        'from': sender_jid,
                        'type': 'chat'})
                    .c('body').t("An earlier message on the next day")
                    .tree();
            await _converse.chatboxes.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            msg = $msg({'id': 'aeb218', 'to': _converse.bare_jid})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                    .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-02T22:28:23Z'}).up()
                    .c('message', {
                        'xmlns': 'jabber:client',
                        'to': _converse.bare_jid,
                        'from': sender_jid,
                        'type': 'chat'})
                    .c('body').t("newer message from the next day")
                    .tree();
            await _converse.chatboxes.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            // Insert <composing> message, to also check that
            // text messages are inserted correctly with
            // temporary chat events in the chat contents.
            msg = $msg({
                    'id': 'aeb219',
                    'to': _converse.bare_jid,
                    'xmlns': 'jabber:client',
                    'from': sender_jid,
                    'type': 'chat'})
                .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                .tree();
            await _converse.chatboxes.onMessage(msg);

            msg = $msg({
                    'id': 'aeb220',
                    'to': _converse.bare_jid,
                    'xmlns': 'jabber:client',
                    'from': sender_jid,
                    'type': 'chat'})
                .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                .c('body').t("latest message")
                .tree();
            await _converse.chatboxes.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            const chat_content = view.el.querySelector('.chat-content');
            view.clearSpinner(); //cleanup
            expect(chat_content.querySelectorAll('.date-separator').length).toEqual(4);

            let day = sizzle('.date-separator:first', chat_content).pop();
            expect(day.getAttribute('data-isodate')).toEqual(moment('2017-12-31T00:00:00').format());

            let time = sizzle('time:first', chat_content).pop();
            expect(time.textContent).toEqual('Sunday Dec 31st 2017')

            day = sizzle('.date-separator:first', chat_content).pop();
            expect(day.nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('Older message');

            let el = sizzle('.chat-msg:first', chat_content).pop().querySelector('.chat-msg__text')
            expect(u.hasClass('chat-msg--followup', el)).toBe(false);
            expect(el.textContent).toEqual('Older message');

            time = sizzle('time.separator-text:eq(1)', chat_content).pop();
            expect(time.textContent).toEqual("Monday Jan 1st 2018");

            day = sizzle('.date-separator:eq(1)', chat_content).pop();
            expect(day.getAttribute('data-isodate')).toEqual(moment('2018-01-01T00:00:00').format());
            expect(day.nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('Inbetween message');

            el = sizzle('.chat-msg:eq(1)', chat_content).pop();
            expect(el.querySelector('.chat-msg__text').textContent).toEqual('Inbetween message');
            expect(el.nextElementSibling.querySelector('.chat-msg__text').textContent).toEqual('another inbetween message');
            el = sizzle('.chat-msg:eq(2)', chat_content).pop();
            expect(el.querySelector('.chat-msg__text').textContent)
                .toEqual('another inbetween message');
            expect(u.hasClass('chat-msg--followup', el)).toBe(true);

            time = sizzle('time.separator-text:nth(2)', chat_content).pop();
            expect(time.textContent).toEqual("Tuesday Jan 2nd 2018");

            day = sizzle('.date-separator:nth(2)', chat_content).pop();
            expect(day.getAttribute('data-isodate')).toEqual(moment('2018-01-02T00:00:00').format());
            expect(day.nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('An earlier message on the next day');

            el = sizzle('.chat-msg:eq(3)', chat_content).pop();
            expect(el.querySelector('.chat-msg__text').textContent).toEqual('An earlier message on the next day');
            expect(u.hasClass('chat-msg--followup', el)).toBe(false);

            el = sizzle('.chat-msg:eq(4)', chat_content).pop();
            expect(el.querySelector('.chat-msg__text').textContent).toEqual('message');
            expect(el.nextElementSibling.querySelector('.chat-msg__text').textContent).toEqual('newer message from the next day');
            expect(u.hasClass('chat-msg--followup', el)).toBe(false);

            day = sizzle('.date-separator:last', chat_content).pop();
            expect(day.getAttribute('data-isodate')).toEqual(moment().startOf('day').format());
            expect(day.nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('latest message');
            expect(u.hasClass('chat-msg--followup', el)).toBe(false);
            done();
        }));

        it("is ignored if it's a malformed headline message",
        mock.initConverse(
            null, ['rosterGroupsFetched'], {},
            async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();

            /* Ideally we wouldn't have to filter out headline
            * messages, but Prosody gives them the wrong 'type' :(
            */
            sinon.spy(_converse, 'log');
            sinon.spy(_converse.chatboxes, 'getChatBox');
            sinon.spy(u, 'isHeadlineMessage');
            const msg = $msg({
                    from: 'localhost',
                    to: _converse.bare_jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('body').t("This headline message will not be shown").tree();
            await _converse.chatboxes.onMessage(msg);
            expect(_converse.log.calledWith(
                "onMessage: Ignoring incoming headline message from JID: localhost",
                Strophe.LogLevel.INFO
            )).toBeTruthy();
            expect(u.isHeadlineMessage.called).toBeTruthy();
            expect(u.isHeadlineMessage.returned(true)).toBeTruthy();
            expect(_converse.chatboxes.getChatBox.called).toBeFalsy();
            // Remove sinon spies
            _converse.log.restore();
            _converse.chatboxes.getChatBox.restore();
            u.isHeadlineMessage.restore();
            done();
        }));


        it("can be a carbon message, as defined in XEP-0280",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();

            // Send a message from a different resource
            spyOn(_converse, 'log');
            const msgtext = 'This is a carbon message';
            const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
            const msg = $msg({
                    'from': sender_jid,
                    'id': (new Date()).getTime(),
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'xmlns': 'jabber:client'
                }).c('received', {'xmlns': 'urn:xmpp:carbons:2'})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                .c('message', {
                        'xmlns': 'jabber:client',
                        'from': sender_jid,
                        'to': _converse.bare_jid+'/another-resource',
                        'type': 'chat'
                }).c('body').t(msgtext).tree();
            await _converse.chatboxes.onMessage(msg);
            await test_utils.waitUntil(() => _converse.api.chats.get().length)
            const chatbox = _converse.chatboxes.get(sender_jid);
            const view = _converse.chatboxviews.get(sender_jid);
                
            expect(chatbox).toBeDefined();
            expect(view).toBeDefined();
            // Check that the message was received and check the message parameters
            expect(chatbox.messages.length).toEqual(1);
            const msg_obj = chatbox.messages.models[0];
            expect(msg_obj.get('message')).toEqual(msgtext);
            expect(msg_obj.get('fullname')).toEqual(mock.cur_names[1]);
            expect(msg_obj.get('sender')).toEqual('them');
            expect(msg_obj.get('is_delayed')).toEqual(false);
            // Now check that the message appears inside the chatbox in the DOM
            const chat_content = view.el.querySelector('.chat-content');
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(msgtext);
            expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
            await test_utils.waitUntil(() => chatbox.vcard.get('fullname') === 'Candice van der Knijff')
            expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Candice van der Knijff');
            done();
        }));

        it("can be a carbon message that this user sent from a different client, as defined in XEP-0280",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitUntilDiscoConfirmed(_converse, 'localhost', [], ['vcard-temp']);
            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();

            // Send a message from a different resource
            spyOn(_converse, 'log');
            const msgtext = 'This is a sent carbon message';
            const recipient_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
            const msg = $msg({
                    'from': _converse.bare_jid,
                    'id': (new Date()).getTime(),
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'xmlns': 'jabber:client'
                }).c('sent', {'xmlns': 'urn:xmpp:carbons:2'})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                .c('message', {
                        'xmlns': 'jabber:client',
                        'from': _converse.bare_jid+'/another-resource',
                        'to': recipient_jid,
                        'type': 'chat'
                }).c('body').t(msgtext).tree();
            await _converse.chatboxes.onMessage(msg);
            await test_utils.waitUntil(() => _converse.api.chats.get().length);
            // Check that the chatbox and its view now exist
            const chatbox = _converse.chatboxes.get(recipient_jid);
            const view = _converse.chatboxviews.get(recipient_jid);
            expect(chatbox).toBeDefined();
            expect(view).toBeDefined();
            await new Promise(resolve => view.once('messageInserted', resolve));
            // Check that the message was received and check the message parameters
            expect(chatbox.messages.length).toEqual(1);
            const msg_obj = chatbox.messages.models[0];
            expect(msg_obj.get('message')).toEqual(msgtext);
            expect(msg_obj.get('fullname')).toEqual(_converse.xmppstatus.get('fullname'));
            expect(msg_obj.get('sender')).toEqual('me');
            expect(msg_obj.get('is_delayed')).toEqual(false);
            // Now check that the message appears inside the chatbox in the DOM
            const msg_txt = view.el.querySelector('.chat-content .chat-msg .chat-msg__text').textContent;
            expect(msg_txt).toEqual(msgtext);
            done();
        }));

        it("will be discarded if it's a malicious message meant to look like a carbon copy",
        mock.initConverse(
            null, ['rosterGroupsFetched'], {},
            async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();
            /* <message from="mallory@evil.example" to="b@xmpp.example">
             *    <received xmlns='urn:xmpp:carbons:2'>
             *      <forwarded xmlns='urn:xmpp:forward:0'>
             *          <message from="alice@xmpp.example" to="bob@xmpp.example/client1">
             *              <body>Please come to Creepy Valley tonight, alone!</body>
             *          </message>
             *      </forwarded>
             *    </received>
             * </message>
             */
            spyOn(_converse, 'log');
            const msgtext = 'Please come to Creepy Valley tonight, alone!';
            const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
            const impersonated_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
            const msg = $msg({
                    'from': sender_jid,
                    'id': (new Date()).getTime(),
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'xmlns': 'jabber:client'
                }).c('received', {'xmlns': 'urn:xmpp:carbons:2'})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                .c('message', {
                        'xmlns': 'jabber:client',
                        'from': impersonated_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat'
                }).c('body').t(msgtext).tree();
            await _converse.chatboxes.onMessage(msg);

            // Check that chatbox for impersonated user is not created.
            let chatbox = _converse.chatboxes.get(impersonated_jid);
            expect(chatbox).not.toBeDefined();

            // Check that the chatbox for the malicous user is not created
            chatbox = _converse.chatboxes.get(sender_jid);
            expect(chatbox).not.toBeDefined();
            done();
        }));

        it("received for a minimized chat box will increment a counter on its header",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            if (_converse.view_mode === 'fullscreen') {
                return done();
            }
            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            const contact_name = mock.cur_names[0];
            const contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openControlBox();
            spyOn(_converse, 'emit').and.callThrough();

            await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const chatview = await _converse.api.chatviews.get(contact_jid);
            expect(u.isVisible(chatview.el)).toBeTruthy();
            expect(chatview.model.get('minimized')).toBeFalsy();
            chatview.el.querySelector('.toggle-chatbox-button').click();
            expect(chatview.model.get('minimized')).toBeTruthy();
            var message = 'This message is sent to a minimized chatbox';
            var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            var msg = $msg({
                from: sender_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: (new Date()).getTime()
            }).c('body').t(message).up()
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            await _converse.chatboxes.onMessage(msg);

            await test_utils.waitUntil(() => chatview.model.messages.length);
            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
            const trimmed_chatboxes = _converse.minimized_chats;
            const trimmedview = trimmed_chatboxes.get(contact_jid);
            let count = trimmedview.el.querySelector('.message-count');
            expect(u.isVisible(chatview.el)).toBeFalsy();
            expect(trimmedview.model.get('minimized')).toBeTruthy();
            expect(u.isVisible(count)).toBeTruthy();
            expect(count.textContent).toBe('1');
            _converse.chatboxes.onMessage(
                $msg({
                    from: mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: (new Date()).getTime()
                }).c('body').t('This message is also sent to a minimized chatbox').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
            );

            await test_utils.waitUntil(() => (chatview.model.messages.length > 1));
            expect(u.isVisible(chatview.el)).toBeFalsy();
            expect(trimmedview.model.get('minimized')).toBeTruthy();
            count = trimmedview.el.querySelector('.message-count');
            expect(u.isVisible(count)).toBeTruthy();
            expect(count.textContent).toBe('2');
            trimmedview.el.querySelector('.restore-chat').click();
            expect(trimmed_chatboxes.keys().length).toBe(0);
            done();
        }));

        it("will indicate when it has a time difference of more than a day between it and its predecessor",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();
            spyOn(_converse, 'emit');
            const contact_name = mock.cur_names[1];
            const contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';

            await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
            await test_utils.openChatBoxFor(_converse, contact_jid);
            test_utils.clearChatBoxMessages(_converse, contact_jid);
            const one_day_ago = moment();
            one_day_ago.subtract('days', 1);
            const chatbox = _converse.chatboxes.get(contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            let message = 'This is a day old message';
            let msg = $msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: one_day_ago.unix()
            }).c('body').t(message).up()
            .c('delay', { xmlns:'urn:xmpp:delay', from: 'localhost', stamp: one_day_ago.format() })
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            await _converse.chatboxes.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
            expect(chatbox.messages.length).toEqual(1);
            let msg_obj = chatbox.messages.models[0];
            expect(msg_obj.get('message')).toEqual(message);
            expect(msg_obj.get('fullname')).toEqual(contact_name);
            expect(msg_obj.get('sender')).toEqual('them');
            expect(msg_obj.get('is_delayed')).toEqual(true);
            await test_utils.waitUntil(() => chatbox.vcard.get('fullname') === 'Candice van der Knijff')
            const chat_content = view.el.querySelector('.chat-content');
            expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(message);
            expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
            expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Candice van der Knijff');

            expect(chat_content.querySelectorAll('.date-separator').length).toEqual(1);
            let day = chat_content.querySelector('.date-separator');
            expect(day.getAttribute('class')).toEqual('message date-separator');
            expect(day.getAttribute('data-isodate')).toEqual(moment(one_day_ago.startOf('day')).format());

            let time = chat_content.querySelector('time.separator-text');
            expect(time.textContent).toEqual(moment(one_day_ago.startOf('day')).format("dddd MMM Do YYYY"));

            message = 'This is a current message';
            msg = $msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: new Date().getTime()
            }).c('body').t(message).up()
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            await _converse.chatboxes.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
            // Check that there is a <time> element, with the required
            // props.
            expect(chat_content.querySelectorAll('time.separator-text').length).toEqual(2); // There are now two time elements

            const message_date = new Date();
            day = sizzle('.date-separator:last', chat_content);
            expect(day.length).toEqual(1);
            expect(day[0].getAttribute('class')).toEqual('message date-separator');
            expect(day[0].getAttribute('data-isodate')).toEqual(moment(message_date).startOf('day').format());

            time = sizzle('time.separator-text:last', chat_content).pop();
            expect(time.textContent).toEqual(moment(message_date).startOf('day').format("dddd MMM Do YYYY"));

            // Normal checks for the 2nd message
            expect(chatbox.messages.length).toEqual(2);
            msg_obj = chatbox.messages.models[1];
            expect(msg_obj.get('message')).toEqual(message);
            expect(msg_obj.get('fullname')).toEqual(contact_name);
            expect(msg_obj.get('sender')).toEqual('them');
            expect(msg_obj.get('is_delayed')).toEqual(false);
            const msg_txt = sizzle('.chat-msg:last .chat-msg__text', chat_content).pop().textContent;
            expect(msg_txt).toEqual(message);

            expect(chat_content.querySelector('.chat-msg:last-child .chat-msg__text').textContent).toEqual(message);
            expect(chat_content.querySelector('.chat-msg:last-child .chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
            expect(chat_content.querySelector('.chat-msg:last-child .chat-msg__author').textContent.trim()).toBe('Candice van der Knijff');
            done();
        }));

        it("can be sent from a chatbox, and will appear inside it",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();
            spyOn(_converse, 'emit');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            expect(_converse.emit).toHaveBeenCalledWith('chatBoxFocused', jasmine.any(Object));
            const view = _converse.chatboxviews.get(contact_jid);
            const message = 'This message is sent from this chatbox';
            spyOn(view.model, 'sendMessage').and.callThrough();
            await test_utils.sendMessage(view, message);
            expect(view.model.sendMessage).toHaveBeenCalled();
            expect(view.model.messages.length, 2);
            expect(_converse.emit.calls.mostRecent().args, ['messageSend', message]);
            expect(sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop().textContent).toEqual(message);
            done();
        }));

        it("is sanitized to prevent Javascript injection attacks",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);
            const message = '<p>This message contains <em>some</em> <b>markup</b></p>';
            spyOn(view.model, 'sendMessage').and.callThrough();
            await test_utils.sendMessage(view, message);
            expect(view.model.sendMessage).toHaveBeenCalled();
            const msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
            expect(msg.text()).toEqual(message);
            expect(msg.html()).toEqual('&lt;p&gt;This message contains &lt;em&gt;some&lt;/em&gt; &lt;b&gt;markup&lt;/b&gt;&lt;/p&gt;');
            done();
        }));

        it("can contain hyperlinks, which will be clickable",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);
            const message = 'This message contains a hyperlink: www.opkode.com';
            spyOn(view.model, 'sendMessage').and.callThrough();
            test_utils.sendMessage(view, message);
            expect(view.model.sendMessage).toHaveBeenCalled();
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            const msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
            expect(msg.text()).toEqual(message);
            expect(msg.html())
                .toEqual('This message contains a hyperlink: <a target="_blank" rel="noopener" href="http://www.opkode.com">www.opkode.com</a>');
            done();
        }));

        it("will have properly escaped URLs",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);

            let message = "http://www.opkode.com/'onmouseover='alert(1)'whatever";
            await test_utils.sendMessage(view, message);

            let msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
            expect(msg.textContent).toEqual(message);
            expect($(msg).html())
                .toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%27onmouseover=%27alert%281%29%27whatever">http://www.opkode.com/\'onmouseover=\'alert(1)\'whatever</a>');

            message = 'http://www.opkode.com/"onmouseover="alert(1)"whatever';
            await test_utils.sendMessage(view, message);

            msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
            expect(msg.textContent).toEqual(message);
            expect($(msg).html()).toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%22onmouseover=%22alert%281%29%22whatever">http://www.opkode.com/"onmouseover="alert(1)"whatever</a>');

            message = "https://en.wikipedia.org/wiki/Ender's_Game";
            await test_utils.sendMessage(view, message);

            msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
            expect(msg.textContent).toEqual(message);
            expect($(msg).html()).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">'+message+'</a>');

            message = "https://en.wikipedia.org/wiki/Ender's_Game";
            await test_utils.sendMessage(view, message);

            msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
            expect(msg.textContent).toEqual(message);
            expect($(msg).html()).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">'+message+'</a>');
            done();
        }));

        it("will render newlines",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            const view = await test_utils.openChatBoxFor(_converse, contact_jid);
            let stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="dummy@localhost/resource">
                    <body>Hey\nHave you heard the news?</body>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            const chat_content = view.el.querySelector('.chat-content');
            expect(chat_content.querySelector('.chat-msg__text').innerHTML).toBe('Hey<br>Have you heard the news?');
            stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="dummy@localhost/resource">
                    <body>Hey\n\n\nHave you heard the news?</body>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(chat_content.querySelector('.message:last-child .chat-msg__text').innerHTML).toBe('Hey<br><br>Have you heard the news?');
            stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="dummy@localhost/resource">
                    <body>Hey\nHave you heard\nthe news?</body>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(chat_content.querySelector('.message:last-child .chat-msg__text').innerHTML).toBe('Hey<br>Have you heard<br>the news?');
            done();
        }));

        it("will render images from their URLs",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            let base_url = 'https://conversejs.org';
            let message = base_url+"/logo/conversejs-filled.svg";
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();
            test_utils.sendMessage(view, message);
            await test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length, 1000)
            expect(view.model.sendMessage).toHaveBeenCalled();
            let msg = $(view.el).find('.chat-content .chat-msg').last().find('.chat-msg__text');
            expect(msg.html().trim()).toEqual(
                '<!-- src/templates/image.html -->\n'+
                '<a href="'+base_url+'/logo/conversejs-filled.svg" target="_blank" rel="noopener"><img class="chat-image img-thumbnail"'+
                ' src="' + message + '"></a>');
            message += "?param1=val1&param2=val2";
            test_utils.sendMessage(view, message);
            await test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length === 2, 1000);
            expect(view.model.sendMessage).toHaveBeenCalled();
            msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
            expect(msg.html().trim()).toEqual(
                '<!-- src/templates/image.html -->\n'+
                '<a href="'+base_url+'/logo/conversejs-filled.svg?param1=val1&amp;param2=val2" target="_blank" rel="noopener"><img'+
                ' class="chat-image img-thumbnail" src="'+message.replace(/&/g, '&amp;')+'"></a>')

            // Test now with two images in one message
            message += ' hello world '+base_url+"/logo/conversejs-filled.svg";
            test_utils.sendMessage(view, message);
            await test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length === 4, 1000);
            expect(view.model.sendMessage).toHaveBeenCalled();
            msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
            expect(msg[0].textContent.trim()).toEqual('hello world');
            expect(msg[0].querySelectorAll('img').length).toEqual(2);

            // Non-https images aren't rendered
            base_url = document.URL.split(window.location.pathname)[0];
            message = base_url+"/logo/conversejs-filled.svg";
            expect(view.el.querySelectorAll('img').length).toBe(4);
            test_utils.sendMessage(view, message);
            expect(view.el.querySelectorAll('img').length).toBe(4);
            done();
        }));

        it("will render the message time as configured",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');

            _converse.time_format = 'hh:mm';
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);
            const message = 'This message is sent from this chatbox';
            await test_utils.sendMessage(view, message);

            const chatbox = _converse.chatboxes.get(contact_jid);
            expect(chatbox.messages.models.length, 1);
            const msg_object = chatbox.messages.models[0];

            const msg_author = view.el.querySelector('.chat-content .chat-msg:last-child .chat-msg__author');
            expect(msg_author.textContent.trim()).toBe('Max Mustermann');

            const msg_time = view.el.querySelector('.chat-content .chat-msg:last-child .chat-msg__time');
            const time = moment(msg_object.get('time')).format(_converse.time_format);
            expect(msg_time.textContent).toBe(time);
            done();
        }));

        it("will be correctly identified and rendered as a followup message",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();

            let message, msg;
            const base_time = new Date();
            const ONE_MINUTE_LATER = 60000;

            await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 300);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            _converse.filter_by_resource = true;

            jasmine.clock().install();
            jasmine.clock().mockDate(base_time);

            _converse.chatboxes.onMessage($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': (new Date()).getTime()
                }).c('body').t('A message').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await new Promise(resolve => _converse.on('chatBoxOpened', resolve));
            const view = await _converse.chatboxviews.get(sender_jid);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            jasmine.clock().tick(3*ONE_MINUTE_LATER);
            _converse.chatboxes.onMessage($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': (new Date()).getTime()
                }).c('body').t("Another message 3 minutes later").up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            jasmine.clock().tick(11*ONE_MINUTE_LATER);
            _converse.chatboxes.onMessage($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': (new Date()).getTime()
                }).c('body').t("Another message 14 minutes since we started").up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            jasmine.clock().tick(1000);
            // Insert <composing> message, to also check that
            // text messages are inserted correctly with
            // temporary chat events in the chat contents.
            _converse.chatboxes.onMessage($msg({
                    'id': 'aeb219',
                    'to': _converse.bare_jid,
                    'xmlns': 'jabber:client',
                    'from': sender_jid,
                    'type': 'chat'})
                .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                .tree());
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            jasmine.clock().tick(1*ONE_MINUTE_LATER);
            _converse.chatboxes.onMessage($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': (new Date()).getTime()
                }).c('body').t("Another message 1 minute and 1 second since the previous one").up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            jasmine.clock().tick(1*ONE_MINUTE_LATER);
            const chat_content = view.el.querySelector('.chat-content');
            await test_utils.sendMessage(view, "Another message within 10 minutes, but from a different person");

            expect(chat_content.querySelectorAll('.message').length).toBe(6);
            expect(chat_content.querySelectorAll('.chat-msg').length).toBe(5);
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(2)'))).toBe(false);
            expect(chat_content.querySelector('.message:nth-child(2) .chat-msg__text').textContent).toBe("A message");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(3)'))).toBe(true);
            expect(chat_content.querySelector('.message:nth-child(3) .chat-msg__text').textContent).toBe(
                "Another message 3 minutes later");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(4)'))).toBe(false);
            expect(chat_content.querySelector('.message:nth-child(4) .chat-msg__text').textContent).toBe(
                "Another message 14 minutes since we started");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(5)'))).toBe(true);
            expect(chat_content.querySelector('.message:nth-child(5) .chat-msg__text').textContent).toBe(
                "Another message 1 minute and 1 second since the previous one");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(6)'))).toBe(false);
            expect(chat_content.querySelector('.message:nth-child(6) .chat-msg__text').textContent).toBe(
                "Another message within 10 minutes, but from a different person");

            // Let's add a delayed, inbetween message
            _converse.chatboxes.onMessage($msg({'id': 'aeb218', 'to': _converse.bare_jid})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                    .c('delay', {'xmlns': 'urn:xmpp:delay',
                                    'stamp': moment(base_time).add(5, 'minutes').format()
                                }).up()
                    .c('message', {
                        'xmlns': 'jabber:client',
                        'to': _converse.bare_jid,
                        'from': sender_jid,
                        'type': 'chat'})
                    .c('body').t("A delayed message, sent 5 minutes since we started")
                    .tree());
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            expect(chat_content.querySelectorAll('.message').length).toBe(7);
            expect(chat_content.querySelectorAll('.chat-msg').length).toBe(6);
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(2)'))).toBe(false);
            expect(chat_content.querySelector('.message:nth-child(2) .chat-msg__text').textContent).toBe("A message");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(3)'))).toBe(true);
            expect(chat_content.querySelector('.message:nth-child(3) .chat-msg__text').textContent).toBe(
                "Another message 3 minutes later");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(4)'))).toBe(true);
            expect(chat_content.querySelector('.message:nth-child(4) .chat-msg__text').textContent).toBe(
                "A delayed message, sent 5 minutes since we started");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(5)'))).toBe(true);
            expect(chat_content.querySelector('.message:nth-child(5) .chat-msg__text').textContent).toBe(
                "Another message 14 minutes since we started");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(6)'))).toBe(true);
            expect(chat_content.querySelector('.message:nth-child(6) .chat-msg__text').textContent).toBe(
                "Another message 1 minute and 1 second since the previous one");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(7)'))).toBe(false);

            _converse.chatboxes.onMessage($msg({'id': 'aeb213', 'to': _converse.bare_jid})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                    .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':moment(base_time).add(4, 'minutes').format()}).up()
                    .c('message', {
                        'xmlns': 'jabber:client',
                        'to': sender_jid,
                        'from': _converse.bare_jid+"/some-other-resource",
                        'type': 'chat'})
                    .c('body').t("A carbon message 4 minutes later")
                    .tree()); 
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            expect(chat_content.querySelectorAll('.message').length).toBe(8);
            expect(chat_content.querySelectorAll('.chat-msg').length).toBe(7);
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(2)'))).toBe(false);
            expect(chat_content.querySelector('.message:nth-child(2) .chat-msg__text').textContent).toBe("A message");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(3)'))).toBe(true);
            expect(chat_content.querySelector('.message:nth-child(3) .chat-msg__text').textContent).toBe(
                "Another message 3 minutes later");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(4)'))).toBe(false);
            expect(chat_content.querySelector('.message:nth-child(4) .chat-msg__text').textContent).toBe(
                "A carbon message 4 minutes later");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(5)'))).toBe(false);
            expect(chat_content.querySelector('.message:nth-child(5) .chat-msg__text').textContent).toBe(
                "A delayed message, sent 5 minutes since we started");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(6)'))).toBe(true);
            expect(chat_content.querySelector('.message:nth-child(6) .chat-msg__text').textContent).toBe(
                "Another message 14 minutes since we started");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(7)'))).toBe(true);
            expect(chat_content.querySelector('.message:nth-child(7) .chat-msg__text').textContent).toBe(
                "Another message 1 minute and 1 second since the previous one");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(8)'))).toBe(false);
            expect(chat_content.querySelector('.message:nth-child(8) .chat-msg__text').textContent).toBe(
                "Another message within 10 minutes, but from a different person");

            jasmine.clock().uninstall();
            done();
        }));

        it("received may emit a message delivery receipt",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {
            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            const msg_id = u.getUniqueId();
            const sent_stanzas = [];
            spyOn(_converse.connection, 'send').and.callFake(function (stanza) {
                sent_stanzas.push(stanza);
            });
            const msg = $msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': msg_id,
                }).c('body').t('Message!').up()
                .c('request', {'xmlns': Strophe.NS.RECEIPTS}).tree();
            await _converse.chatboxes.onMessage(msg);
            const sent_messages = sent_stanzas.map(s => _.isElement(s) ? s : s.nodeTree).filter(s => s.nodeName === 'message');
            expect(sent_messages.length).toBe(1);
            const receipt = sizzle(`received[xmlns="${Strophe.NS.RECEIPTS}"]`, sent_messages[0]).pop();
            expect(Strophe.serialize(receipt)).toBe(`<received id="${msg_id}" xmlns="${Strophe.NS.RECEIPTS}"/>`);
            done();
        }));

        it("carbon received does not emit a message delivery receipt",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {
            test_utils.createContacts(_converse, 'current', 1);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            const msg_id = u.getUniqueId();
            const sent_stanzas = [];
            const view = await test_utils.openChatBoxFor(_converse, sender_jid);
            spyOn(view.model, 'sendReceiptStanza').and.callThrough();
            const msg = $msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': u.getUniqueId(),
                }).c('received', {'xmlns': 'urn:xmpp:carbons:2'})
                .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                .c('message', {
                        'xmlns': 'jabber:client',
                        'from': sender_jid,
                        'to': _converse.bare_jid+'/another-resource',
                        'type': 'chat',
                        'id': msg_id
                }).c('body').t('Message!').up()
                .c('request', {'xmlns': Strophe.NS.RECEIPTS}).tree();
            await _converse.chatboxes.onMessage(msg);
            await test_utils.waitUntil(() => _converse.api.chats.get().length);
            expect(view.model.sendReceiptStanza).not.toHaveBeenCalled();
            done();
        }));

        it("forwarded does not emit a message delivery receipt if it's mine",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {
            test_utils.createContacts(_converse, 'current', 1);
            const recipient_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            const msg_id = u.getUniqueId();
            const sent_stanzas = [];
            const view = await test_utils.openChatBoxFor(_converse, recipient_jid);
            spyOn(view.model, 'sendReceiptStanza').and.callThrough();
            const msg = $msg({
                    'from': converse.bare_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': u.getUniqueId(),
                }).c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                .c('message', {
                        'xmlns': 'jabber:client',
                        'from': _converse.bare_jid+'/another-resource',
                        'to': recipient_jid,
                        'type': 'chat',
                        'id': msg_id
                }).c('body').t('Message!').up()
                .c('request', {'xmlns': Strophe.NS.RECEIPTS}).tree();
            await _converse.chatboxes.onMessage(msg);
            await test_utils.waitUntil(() => _converse.api.chats.get().length);
            expect(view.model.sendReceiptStanza).not.toHaveBeenCalled();
            done();
        }));

        it("delivery can be acknowledged by a receipt",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await test_utils.waitUntil(() => _converse.api.chats.get().length);
            const chatbox = _converse.chatboxes.get(contact_jid);
            expect(chatbox).toBeDefined();
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            let msg_obj = chatbox.messages.models[0];
            let msg_id = msg_obj.get('msgid');
            let msg = $msg({
                    'from': contact_jid,
                    'to': _converse.connection.jid,
                    'id': u.getUniqueId(),
                }).c('received', {'id': msg_id, xmlns: Strophe.NS.RECEIPTS}).up().tree();
            _converse.connection._dataRecv(test_utils.createRequest(msg));
            await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(1);

            // Also handle receipts with type 'chat'. See #1353
            spyOn(_converse.chatboxes, 'onMessage').and.callThrough();
            textarea.value = 'Another message';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));

            msg_obj = chatbox.messages.models[1];
            msg_id = msg_obj.get('msgid');
            msg = $msg({
                    'from': contact_jid,
                    'type': 'chat',
                    'to': _converse.connection.jid,
                    'id': u.getUniqueId(),
                }).c('received', {'id': msg_id, xmlns: Strophe.NS.RECEIPTS}).up().tree();
            _converse.connection._dataRecv(test_utils.createRequest(msg));
            await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(2);
            expect(_converse.chatboxes.onMessage.calls.count()).toBe(1);
            done();
        }));


        describe("when received from someone else", function () {

            it("will open a chatbox and be displayed inside it",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                _converse.emit('rosterContactsFetched');
                test_utils.openControlBox();
                await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 300);
                spyOn(_converse, 'emit');
                const message = 'This is a received message';
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                // We don't already have an open chatbox for this user
                expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();
                _converse.chatboxes.onMessage(
                    $msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': (new Date()).getTime()
                    }).c('body').t(message).up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
                );
                await test_utils.waitUntil(() => _converse.api.chats.get().length === 2);
                const chatbox = _converse.chatboxes.get(sender_jid);
                expect(chatbox).toBeDefined();
                const view = _converse.chatboxviews.get(sender_jid);
                expect(view).toBeDefined();

                expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                // Check that the message was received and check the message parameters
                expect(chatbox.messages.length).toEqual(1);
                const msg_obj = chatbox.messages.models[0];
                expect(msg_obj.get('message')).toEqual(message);
                expect(msg_obj.get('fullname')).toEqual(mock.cur_names[0]);
                expect(msg_obj.get('sender')).toEqual('them');
                expect(msg_obj.get('is_delayed')).toEqual(false);
                // Now check that the message appears inside the chatbox in the DOM
                const chat_content = view.el.querySelector('.chat-content');
                expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(message);
                expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                await test_utils.waitUntil(() => chatbox.vcard.get('fullname') === mock.cur_names[0]);
                expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Max Frankfurter');
                done();
            }));

            it("can be replaced with a correction",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'current', 1);
                _converse.emit('rosterContactsFetched');
                test_utils.openControlBox();
                const message = 'This is a received message';
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                const msg_id = u.getUniqueId();
                const view = await test_utils.openChatBoxFor(_converse, sender_jid);
                _converse.chatboxes.onMessage($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': msg_id,
                    }).c('body').t('But soft, what light through yonder airlock breaks?').tree());
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(view.el.querySelector('.chat-msg__text').textContent)
                    .toBe('But soft, what light through yonder airlock breaks?');

                _converse.chatboxes.onMessage($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': u.getUniqueId(),
                    }).c('body').t('But soft, what light through yonder chimney breaks?').up()
                    .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());
                await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));

                expect(view.el.querySelector('.chat-msg__text').textContent)
                    .toBe('But soft, what light through yonder chimney breaks?');
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(view.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);

                _converse.chatboxes.onMessage($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': u.getUniqueId(),
                    }).c('body').t('But soft, what light through yonder window breaks?').up()
                    .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());
                await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));

                expect(view.el.querySelector('.chat-msg__text').textContent)
                    .toBe('But soft, what light through yonder window breaks?');
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(view.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
                view.el.querySelector('.chat-msg__content .fa-edit').click();
                const modal = view.model.messages.at(0).message_versions_modal;
                await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
                const older_msgs = modal.el.querySelectorAll('.older-msg');
                expect(older_msgs.length).toBe(2);
                expect(older_msgs[0].textContent).toBe('But soft, what light through yonder airlock breaks?');
                expect(older_msgs[1].textContent).toBe('But soft, what light through yonder chimney breaks?');
                done();
            }));


            describe("when a chatbox is opened for someone who is not in the roster", function () {

                it("the VCard for that user is fetched and the chatbox updated with the results",
                    mock.initConverse(
                        null, ['rosterGroupsFetched'], {},
                        async function (done, _converse) {

                    _converse.emit('rosterContactsFetched');
                    _converse.allow_non_roster_messaging = true;
                    spyOn(_converse, 'emit').and.callThrough();

                    const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var vcard_fetched = false;
                    spyOn(_converse.api.vcard, "get").and.callFake(function () {
                        vcard_fetched = true;
                        return Promise.resolve({
                            'fullname': mock.cur_names[0],
                            'vcard_updated': moment().format(),
                            'jid': sender_jid
                        });
                    });
                    const message = 'This is a received message from someone not on the roster';
                    const msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                    // We don't already have an open chatbox for this user
                    expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();

                    await _converse.chatboxes.onMessage(msg);
                    await test_utils.waitUntil(() => _converse.api.chats.get().length);
                    expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

                    // Check that the chatbox and its view now exist
                    const chatbox = _converse.chatboxes.get(sender_jid);
                    const view = _converse.chatboxviews.get(sender_jid);

                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    expect(chatbox.get('fullname') === sender_jid);
                    await new Promise(resolve => view.once('messageInserted', resolve));

                    await test_utils.waitUntil(() => view.el.querySelector('.chat-msg__author').textContent.trim() === 'Max Frankfurter');
                    let author_el = view.el.querySelector('.chat-msg__author');
                    expect( _.includes(author_el.textContent.trim(), 'Max Frankfurter')).toBeTruthy();
                    await test_utils.waitUntil(() => vcard_fetched, 100);
                    expect(_converse.api.vcard.get).toHaveBeenCalled();
                    await test_utils.waitUntil(() => chatbox.vcard.get('fullname') === mock.cur_names[0])
                    author_el = view.el.querySelector('.chat-msg__author');
                    expect( _.includes(author_el.textContent.trim(), 'Max Frankfurter')).toBeTruthy();
                    done();
                }));
            });


            describe("who is not on the roster", function () {

                it("will open a chatbox and be displayed inside it if allow_non_roster_messaging is true",
                    mock.initConverse(
                        null, ['rosterGroupsFetched'], {},
                        async function (done, _converse) {

                    _converse.allow_non_roster_messaging = false;
                    _converse.emit('rosterContactsFetched');

                    spyOn(_converse, 'emit');
                    const message = 'This is a received message from someone not on the roster';
                    const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    const msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                    // We don't already have an open chatbox for this user
                    expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();

                    let chatbox = _converse.chatboxes.get(sender_jid);
                    expect(chatbox).not.toBeDefined();
                    // onMessage is a handler for received XMPP messages
                    await _converse.chatboxes.onMessage(msg);
                    expect(_converse.api.chats.get().length).toBe(1);
                    let view = _converse.chatboxviews.get(sender_jid);
                    expect(view).not.toBeDefined();

                    // onMessage is a handler for received XMPP messages
                    _converse.allow_non_roster_messaging = true;
                    await _converse.chatboxes.onMessage(msg);
                    view = _converse.chatboxviews.get(sender_jid);
                    await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                    expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                    // Check that the chatbox and its view now exist
                    chatbox = _converse.chatboxes.get(sender_jid);
                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    // Check that the message was received and check the message parameters
                    expect(chatbox.messages.length).toEqual(1);
                    const msg_obj = chatbox.messages.models[0];
                    expect(msg_obj.get('message')).toEqual(message);
                    expect(msg_obj.get('fullname')).toEqual(undefined);
                    expect(msg_obj.get('sender')).toEqual('them');
                    expect(msg_obj.get('is_delayed')).toEqual(false);

                    await test_utils.waitUntil(() => view.el.querySelector('.chat-msg__author').textContent.trim() === 'Max Frankfurter');
                    // Now check that the message appears inside the chatbox in the DOM
                    const chat_content = view.el.querySelector('.chat-content');
                    expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(message);
                    expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                    expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Max Frankfurter');
                    done();
                }));
            });


            describe("and for which then an error message is received from the server", function () {

                it("will have the error message displayed after itself",
                    mock.initConverse(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        async function (done, _converse) {

                    test_utils.createContacts(_converse, 'current');
                    _converse.emit('rosterContactsFetched');
                    test_utils.openControlBox();

                    // TODO: what could still be done for error
                    // messages... if the <error> element has type
                    // "cancel", then we know the messages wasn't sent,
                    // and can give the user a nicer indication of
                    // that.

                    /* <message from="scotty@enterprise.com/_converse.js-84843526"
                     *          to="kirk@enterprise.com.com"
                     *          type="chat"
                     *          id="82bc02ce-9651-4336-baf0-fa04762ed8d2"
                     *          xmlns="jabber:client">
                     *      <body>yo</body>
                     *      <active xmlns="http://jabber.org/protocol/chatstates"/>
                     *  </message>
                     */
                    const error_txt = 'Server-to-server connection failed: Connecting failed: connection timeout';
                    const sender_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                    let fullname = _converse.xmppstatus.get('fullname');
                    fullname = _.isEmpty(fullname)? _converse.bare_jid: fullname;
                    await _converse.api.chats.open(sender_jid)
                    var msg_text = 'This message will not be sent, due to an error';
                    const view = _converse.chatboxviews.get(sender_jid);
                    let message = view.model.messages.create({
                        'msgid': '82bc02ce-9651-4336-baf0-fa04762ed8d2',
                        'fullname': fullname,
                        'sender': 'me',
                        'time': moment().format(),
                        'message': msg_text
                    });
                    view.model.sendMessage(message);
                    await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                    const chat_content = view.el.querySelector('.chat-content');
                    let msg_txt = sizzle('.chat-msg:last .chat-msg__text', chat_content).pop().textContent;
                    expect(msg_txt).toEqual(msg_text);

                    // We send another message, for which an error will
                    // not be received, to test that errors appear
                    // after the relevant message.
                    msg_text = 'This message will be sent, and also receive an error';
                    message = view.model.messages.create({
                        'msgid': '6fcdeee3-000f-4ce8-a17e-9ce28f0ae104',
                        'fullname': fullname,
                        'sender': 'me',
                        'time': moment().format(),
                        'message': msg_text
                    });
                    view.model.sendMessage(message);
                    await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                    msg_txt = sizzle('.chat-msg:last .chat-msg__text', chat_content).pop().textContent;
                    expect(msg_txt).toEqual(msg_text);

                    /* <message xmlns="jabber:client"
                     *          to="scotty@enterprise.com/_converse.js-84843526"
                     *          type="error"
                     *          id="82bc02ce-9651-4336-baf0-fa04762ed8d2"
                     *          from="kirk@enterprise.com.com">
                     *     <error type="cancel">
                     *         <remote-server-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                     *         <text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">Server-to-server connection failed: Connecting failed: connection timeout</text>
                     *     </error>
                     * </message>
                     */
                    let stanza = $msg({
                            'to': _converse.connection.jid,
                            'type': 'error',
                            'id': '82bc02ce-9651-4336-baf0-fa04762ed8d2',
                            'from': sender_jid
                        })
                        .c('error', {'type': 'cancel'})
                        .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                        .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                            .t('Server-to-server connection failed: Connecting failed: connection timeout');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                    expect(chat_content.querySelector('.chat-error').textContent).toEqual(error_txt);
                    stanza = $msg({
                            'to': _converse.connection.jid,
                            'type': 'error',
                            'id': '6fcdeee3-000f-4ce8-a17e-9ce28f0ae104',
                            'from': sender_jid
                        })
                        .c('error', {'type': 'cancel'})
                        .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                        .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                            .t('Server-to-server connection failed: Connecting failed: connection timeout');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                    expect(chat_content.querySelectorAll('.chat-error').length).toEqual(2);

                    // We don't render duplicates
                    stanza = $msg({
                            'to': _converse.connection.jid,
                            'type':'error',
                            'id': '6fcdeee3-000f-4ce8-a17e-9ce28f0ae104',
                            'from': sender_jid
                        })
                        .c('error', {'type': 'cancel'})
                        .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                        .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                            .t('Server-to-server connection failed: Connecting failed: connection timeout');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    expect(chat_content.querySelectorAll('.chat-error').length).toEqual(2);

                    // We send another message, for which an error will
                    // not be received, to test that errors appear
                    // after the relevant message.
                    msg_text = 'This message will be sent, and also receive an error';
                    message = view.model.messages.create({
                        'msgid': 'another-id',
                        'fullname': fullname,
                        'sender': 'me',
                        'time': moment().format(),
                        'message': msg_text
                    });
                    view.model.sendMessage(message);
                    await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                    msg_txt = sizzle('.chat-msg:last .chat-msg__text', chat_content).pop().textContent;
                    expect(msg_txt).toEqual(msg_text);

                    // A different error message will however render
                    stanza = $msg({
                            'to': _converse.connection.jid,
                            'type':'error',
                            'id': 'another-id',
                            'from': sender_jid
                        })
                        .c('error', {'type': 'cancel'})
                        .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                        .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                            .t('Something else went wrong as well');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                    expect(chat_content.querySelectorAll('.chat-error').length).toEqual(3);
                    done();
                }));

                it("will not show to the user an error message for a CSI message",
                    mock.initConverse(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        async function (done, _converse) {

                    // See #1317
                    // https://github.com/conversejs/converse.js/issues/1317
                    test_utils.createContacts(_converse, 'current');
                    _converse.emit('rosterContactsFetched');
                    test_utils.openControlBox();

                    const contact_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                    await test_utils.openChatBoxFor(_converse, contact_jid);

                    const messages = _converse.connection.sent_stanzas.filter(s => s.nodeName === 'message');
                    expect(messages.length).toBe(1);
                    expect(Strophe.serialize(messages[0])).toBe(
                        `<message id="${messages[0].getAttribute('id')}" to="robin.schook@localhost" type="chat" xmlns="jabber:client">`+
                           `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                           `<no-store xmlns="urn:xmpp:hints"/>`+
                           `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
                        `</message>`);

                    const stanza = $msg({
                            'from': contact_jid,
                            'type': 'error',
                            'id': messages[0].getAttribute('id')
                        }).c('error', {'type': 'cancel', 'code': '503'})
                            .c('service-unavailable', { 'xmlns': 'urn:ietf:params:xml:ns:xmpp-stanzas' }).up()
                            .c('text', { 'xmlns': 'urn:ietf:params:xml:ns:xmpp-stanzas' })
                                .t('User session not found')
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    const view = _converse.chatboxviews.get(contact_jid);
                    const chat_content = view.el.querySelector('.chat-content');
                    expect(chat_content.querySelectorAll('.chat-error').length).toEqual(0);
                    done();
                }));
            });


            it("will cause the chat area to be scrolled down only if it was at the bottom originally",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                _converse.emit('rosterContactsFetched');
                test_utils.openControlBox();

                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                const message = 'This message is received while the chat area is scrolled up';
                await test_utils.openChatBoxFor(_converse, sender_jid)
                const view = _converse.chatboxviews.get(sender_jid);
                spyOn(view, 'onScrolledDown').and.callThrough();
                // Create enough messages so that there's a scrollbar.
                const promises = [];
                for (let i=0; i<20; i++) {
                    _converse.chatboxes.onMessage($msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: _converse.connection.getUniqueId(),
                        }).c('body').t('Message: '+i).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                    promises.push(new Promise((resolve, reject) => view.once('messageInserted', resolve)));
                }
                await Promise.all(promises);
                await test_utils.waitUntil(() => view.content.scrollTop, 1000)
                await test_utils.waitUntil(() => !view.model.get('auto_scrolled'), 500);
                view.content.scrollTop = 0;
                await test_utils.waitUntil(() => view.model.get('scrolled'), 900);
                _converse.chatboxes.onMessage($msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t(message).up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                await test_utils.waitUntil(() => view.model.messages.length > 20, 1000);
                // Now check that the message appears inside the chatbox in the DOM
                const chat_content = view.el.querySelector('.chat-content');
                const  msg_txt = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop().textContent;
                expect(msg_txt).toEqual(message);
                await test_utils.waitUntil(() => u.isVisible(view.el.querySelector('.new-msgs-indicator')), 900);
                expect(view.model.get('scrolled')).toBe(true);
                expect(view.content.scrollTop).toBe(0);
                expect(u.isVisible(view.el.querySelector('.new-msgs-indicator'))).toBeTruthy();
                // Scroll down again
                view.content.scrollTop = view.content.scrollHeight;
                await test_utils.waitUntil(() => !u.isVisible(view.el.querySelector('.new-msgs-indicator')), 900);
                done();
            }));

            it("is ignored if it's intended for a different resource and filter_by_resource is set to true",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();

                await test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length)
                // Send a message from a different resource
                spyOn(_converse, 'log');
                spyOn(_converse.chatboxes, 'getChatBox').and.callThrough();
                _converse.filter_by_resource = true;
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                let msg = $msg({
                        from: sender_jid,
                        to: _converse.bare_jid+"/some-other-resource",
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t("This message will not be shown").up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                await _converse.chatboxes.onMessage(msg);
                await test_utils.waitUntil(() => _converse.api.chats.get().length);
                expect(_converse.log).toHaveBeenCalledWith(
                        "onMessage: Ignoring incoming message intended for a different resource: dummy@localhost/some-other-resource",
                        Strophe.LogLevel.INFO);
                expect(_converse.chatboxes.getChatBox).not.toHaveBeenCalled();
                _converse.filter_by_resource = false;

                const message = "This message sent to a different resource will be shown";
                msg = $msg({
                        from: sender_jid,
                        to: _converse.bare_jid+"/some-other-resource",
                        type: 'chat',
                        id: '134234623462346'
                    }).c('body').t(message).up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                await _converse.chatboxes.onMessage(msg);
                await test_utils.waitUntil(() => _converse.chatboxviews.keys().length > 1, 1000);
                const view = _converse.chatboxviews.get(sender_jid);
                await test_utils.waitUntil(() => view.model.messages.length);
                expect(_converse.chatboxes.getChatBox).toHaveBeenCalled();
                var chat_content = $(view.el).find('.chat-content:last')[0];
                var msg_txt = chat_content.querySelector('.chat-msg .chat-msg__text').textContent;
                expect(msg_txt).toEqual(message);
                done();
            }));
        });


        describe("which contains an OOB URL", function () {

            it("will render audio from oob mp3 URLs",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'current', 1);
                _converse.emit('rosterContactsFetched');
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                await test_utils.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();

                let stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="dummy@localhost/resource">
                        <body>Have you heard this funny audio?</body>
                        <x xmlns="jabber:x:oob"><url>https://localhost/audio.mp3</url></x>
                    </message>`)
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                await test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg audio').length, 1000);
                let msg = view.el.querySelector('.chat-msg .chat-msg__text');
                expect(msg.outerHTML).toEqual('<div class="chat-msg__text">Have you heard this funny audio?</div>');
                let media = view.el.querySelector('.chat-msg .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    '<!-- src/templates/audio.html -->'+
                    '<audio controls="" src="https://localhost/audio.mp3"></audio>'+
                    '<a target="_blank" rel="noopener" href="https://localhost/audio.mp3">Download audio file "audio.mp3"</a>');

                // If the <url> and <body> contents is the same, don't duplicate.
                stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="dummy@localhost/resource">
                        <body>https://localhost/audio.mp3</body>
                        <x xmlns="jabber:x:oob"><url>https://localhost/audio.mp3</url></x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                msg = view.el.querySelector('.chat-msg:last-child .chat-msg__text');
                expect(msg.innerHTML).toEqual('<!-- message gets added here via renderMessage -->'); // Emtpy
                media = view.el.querySelector('.chat-msg:last-child .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    '<!-- src/templates/audio.html -->'+
                    '<audio controls="" src="https://localhost/audio.mp3"></audio>'+
                    '<a target="_blank" rel="noopener" href="https://localhost/audio.mp3">Download audio file "audio.mp3"</a>'
                );
                done();
            }));

            it("will render video from oob mp4 URLs",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                _converse.emit('rosterContactsFetched');
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                await test_utils.openChatBoxFor(_converse, contact_jid)
                const view = _converse.chatboxviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();

                let stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="dummy@localhost/resource">
                        <body>Have you seen this funny video?</body>
                        <x xmlns="jabber:x:oob"><url>https://localhost/video.mp4</url></x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg video').length, 2000)
                let msg = view.el.querySelector('.chat-msg .chat-msg__text');
                expect(msg.outerHTML).toEqual('<div class="chat-msg__text">Have you seen this funny video?</div>');
                let media = view.el.querySelector('.chat-msg .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    '<!-- src/templates/video.html -->'+
                    '<video controls="" src="https://localhost/video.mp4" style="max-height: 50vh"></video>'+
                    '<a target="_blank" rel="noopener" href="https://localhost/video.mp4">Download video file "video.mp4"</a>');

                // If the <url> and <body> contents is the same, don't duplicate.
                stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="dummy@localhost/resource">
                        <body>https://localhost/video.mp4</body>
                        <x xmlns="jabber:x:oob"><url>https://localhost/video.mp4</url></x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                msg = view.el.querySelector('.chat-msg:last-child .chat-msg__text');
                expect(msg.innerHTML).toEqual('<!-- message gets added here via renderMessage -->'); // Emtpy
                media = view.el.querySelector('.chat-msg:last-child .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    '<!-- src/templates/video.html -->'+
                    '<video controls="" src="https://localhost/video.mp4" style="max-height: 50vh"></video>'+
                    '<a target="_blank" rel="noopener" href="https://localhost/video.mp4">Download video file "video.mp4"</a>');
                done();
            }));

            it("will render download links for files from oob URLs",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                test_utils.createContacts(_converse, 'current', 1);
                _converse.emit('rosterContactsFetched');
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                await test_utils.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();
                const stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="dummy@localhost/resource">
                        <body>Have you downloaded this funny file?</body>
                        <x xmlns="jabber:x:oob"><url>https://localhost/funny.pdf</url></x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                await test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg a').length, 1000);
                const msg = view.el.querySelector('.chat-msg .chat-msg__text');
                expect(msg.outerHTML).toEqual('<div class="chat-msg__text">Have you downloaded this funny file?</div>');
                const media = view.el.querySelector('.chat-msg .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    '<!-- src/templates/file.html -->'+
                    '<a target="_blank" rel="noopener" href="https://localhost/funny.pdf">Download file "funny.pdf"</a>');
                done();
            }));

            it("will render images from oob URLs",
                mock.initConverse(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const base_url = 'https://conversejs.org';
                test_utils.createContacts(_converse, 'current');
                _converse.emit('rosterContactsFetched');
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                await test_utils.openChatBoxFor(_converse, contact_jid)
                const view = await _converse.api.chatviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();
                const url = base_url+"/logo/conversejs-filled.svg";

                const stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="dummy@localhost/resource">
                        <body>Have you seen this funny image?</body>
                        <x xmlns="jabber:x:oob"><url>${url}</url></x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg img').length, 2000);

                const msg = view.el.querySelector('.chat-msg .chat-msg__text');
                expect(msg.outerHTML).toEqual('<div class="chat-msg__text">Have you seen this funny image?</div>');
                const media = view.el.querySelector('.chat-msg .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    `<!-- src/templates/image.html -->`+
                    `<a href="${base_url}/logo/conversejs-filled.svg" target="_blank" rel="noopener">`+
                        `<img class="chat-image img-thumbnail" src="${base_url}/logo/conversejs-filled.svg">`+
                    `</a>`);
                done();
            }));
        });
    });

    describe("A XEP-0333 Chat Marker", function () {

        it("is sent when a markable message is received from a roster contact",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const view = await _converse.api.chatviews.get(contact_jid);
            const msgid = u.getUniqueId();
            const stanza = u.toStanza(`
                <message from='${contact_jid}'
                    id='${msgid}'
                    type="chat"
                    to='${_converse.jid}'>
                  <body>My lord, dispatch; read o'er these articles.</body>
                  <markable xmlns='urn:xmpp:chat-markers:0'/>
                </message>`);

            const sent_stanzas = [];
            spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s));
            spyOn(view.model, 'sendMarker').and.callThrough();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => view.model.sendMarker.calls.count() === 1);
            expect(Strophe.serialize(sent_stanzas[0])).toBe(
                `<message from="dummy@localhost/resource" `+
                        `id="${sent_stanzas[0].nodeTree.getAttribute('id')}" `+
                        `to="${contact_jid}" type="chat" xmlns="jabber:client">`+
                `<received id="${msgid}" xmlns="urn:xmpp:chat-markers:0"/>`+
                `</message>`);
            done();
        }));

        it("is not sent when a markable message is received from someone not on the roster",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {'allow_non_roster_messaging': true},
                async function (done, _converse) {

            _converse.emit('rosterContactsFetched');
            const contact_jid = 'someone@localhost';
            const msgid = u.getUniqueId();
            const stanza = u.toStanza(`
                <message from='${contact_jid}'
                    id='${msgid}'
                    type="chat"
                    to='${_converse.jid}'>
                  <body>My lord, dispatch; read o'er these articles.</body>
                  <markable xmlns='urn:xmpp:chat-markers:0'/>
                </message>`);

            const sent_stanzas = [];
            spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s));
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.api.chats.get().length == 2);
            const sent_messages = sent_stanzas
                .map(s => _.isElement(s) ? s : s.nodeTree)
                .filter(e => e.nodeName === 'message');

            // Only one message is sent out, and it's not a chat marker
            expect(sent_messages.length).toBe(1);
            expect(Strophe.serialize(sent_messages[0])).toBe(
                `<message id="${sent_messages[0].getAttribute('id')}" to="someone@localhost" type="chat" xmlns="jabber:client">`+
                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                    `<no-store xmlns="urn:xmpp:hints"/>`+
                    `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
                `</message>`);
            done();
        }));

        it("is ignored if it's a carbon copy of one that I sent from a different client",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.SID]);

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const view = await _converse.api.chatviews.get(contact_jid);

            let stanza = u.toStanza(`
                <message xmlns="jabber:client"
                         to="${_converse.bare_jid}"
                         type="chat"
                         id="2e972ea0-0050-44b7-a830-f6638a2595b3"
                         from="${contact_jid}">
                    <body>😊</body>
                    <markable xmlns="urn:xmpp:chat-markers:0"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="2e972ea0-0050-44b7-a830-f6638a2595b3"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="IxVDLJ0RYbWcWvqC" by="${_converse.bare_jid}"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.model.messages.length).toBe(1);

            stanza = u.toStanza(
                `<message xmlns="jabber:client" to="${_converse.bare_jid}" type="chat" from="${contact_jid}">
                    <sent xmlns="urn:xmpp:carbons:2">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <message xmlns="jabber:client" to="${contact_jid}" type="chat" from="${_converse.bare_jid}/other-resource">
                                <received xmlns="urn:xmpp:chat-markers:0" id="2e972ea0-0050-44b7-a830-f6638a2595b3"/>
                                <store xmlns="urn:xmpp:hints"/>
                                <stanza-id xmlns="urn:xmpp:sid:0" id="F4TC6CvHwzqRbeHb" by="jc@opkode.com"/>
                            </message>
                        </forwarded>
                    </sent>
                </message>`);
            spyOn(_converse, 'emit').and.callThrough();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.emit.calls.count() === 1);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.model.messages.length).toBe(1);
            done();
        }));
    });


    describe("A Groupchat Message", function () {

        it("is specially marked when you are mentioned in it",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
            const view = _converse.chatboxviews.get('lounge@localhost');
            if (!view.el.querySelectorAll('.chat-area').length) { view.renderChatArea(); }
            const message = 'dummy: Your attention is required';
            const nick = mock.chatroom_names[0],
                msg = $msg({
                    from: 'lounge@localhost/'+nick,
                    id: (new Date()).getTime(),
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t(message).tree();
            await view.model.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(u.hasClass('mentioned', view.el.querySelector('.chat-msg'))).toBeTruthy();
            done();
        }));

        it("can not be expected to have a unique id attribute",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
            const view = _converse.chatboxviews.get('lounge@localhost');
            if (!view.el.querySelectorAll('.chat-area').length) { view.renderChatArea(); }
            const id = u.getUniqueId();
            let msg = $msg({
                    from: 'lounge@localhost/some1',
                    id: id,
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t('First message').tree();
            await view.model.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);

            msg = $msg({
                    from: 'lounge@localhost/some2',
                    id: id,
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t('Another message').tree();
            await view.model.onMessage(msg);
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);
            done();
        }));

        it("is ignored if it has the same stanza-id of an already received on",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'room', 'muc.example.com', 'dummy');
            const view = _converse.chatboxviews.get('room@muc.example.com');
            spyOn(view.model, 'hasDuplicateStanzaID').and.callThrough();
            let stanza = u.toStanza(`
                <message xmlns="jabber:client"
                         from="room@muc.example.com/some1"
                         to="${_converse.connection.jid}"
                         type="groupchat">
                    <body>Typical body text</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                               by="room@muc.example.com"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="de305d54-75b4-431b-adb2-eb6b9e546013"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.api.chats.get().length);
            await test_utils.waitUntil(() => view.model.messages.length === 1);
            await test_utils.waitUntil(() => view.model.hasDuplicateStanzaID.calls.count() === 1);
            let result = await view.model.hasDuplicateStanzaID.calls.all()[0].returnValue;
            expect(result).toBe(false);

            stanza = u.toStanza(`
                <message xmlns="jabber:client"
                         from="room@muc.example.com/some1"
                         to="${_converse.connection.jid}"
                         type="groupchat">
                    <body>Typical body text</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                               by="room@muc.example.com"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="de305d54-75b4-431b-adb2-eb6b9e546013"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => view.model.hasDuplicateStanzaID.calls.count() === 2);
            result = await view.model.hasDuplicateStanzaID.calls.all()[1].returnValue;
            expect(result).toBe(true);
            expect(view.model.messages.length).toBe(1);
            done();
        }));

        it("keeps track whether you are the sender or not",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
            const view = _converse.chatboxviews.get('lounge@localhost');
            const msg = $msg({
                    from: 'lounge@localhost/dummy',
                    id: (new Date()).getTime(),
                    to: 'dummy@localhost',
                    type: 'groupchat'
                }).c('body').t('I wrote this message!').tree();
            await view.model.onMessage(msg);
            expect(view.model.messages.last().get('sender')).toBe('me');
            done();
        }));

        it("can be replaced with a correction",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
            const jid = 'lounge@localhost';
            const room = _converse.api.rooms.get(jid);
            const view = _converse.chatboxviews.get(jid);
            const stanza = $pres({
                    to: 'dummy@localhost/_converse.js-29092160',
                    from: 'coven@chat.shakespeare.lit/newguy'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newguy@localhost/_converse.js-290929789',
                    'role': 'participant'
                }).tree();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            const msg_id = u.getUniqueId();
            await view.model.onMessage($msg({
                    'from': 'lounge@localhost/newguy',
                    'to': _converse.connection.jid,
                    'type': 'groupchat',
                    'id': msg_id,
                }).c('body').t('But soft, what light through yonder airlock breaks?').tree());
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder airlock breaks?');

            await view.model.onMessage($msg({
                    'from': 'lounge@localhost/newguy',
                    'to': _converse.connection.jid,
                    'type': 'groupchat',
                    'id': u.getUniqueId(),
                }).c('body').t('But soft, what light through yonder chimney breaks?').up()
                    .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());
            await test_utils.waitUntil(() => view.el.querySelector('.chat-msg__text').textContent ===
                'But soft, what light through yonder chimney breaks?');
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);

            await view.model.onMessage($msg({
                    'from': 'lounge@localhost/newguy',
                    'to': _converse.connection.jid,
                    'type': 'groupchat',
                    'id': u.getUniqueId(),
                }).c('body').t('But soft, what light through yonder window breaks?').up()
                    .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());

            await test_utils.waitUntil(() => view.el.querySelector('.chat-msg__text').textContent ===
                'But soft, what light through yonder window breaks?');
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
            view.el.querySelector('.chat-msg__content .fa-edit').click();
            const modal = view.model.messages.at(0).message_versions_modal;
            await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
            const older_msgs = modal.el.querySelectorAll('.older-msg');
            expect(older_msgs.length).toBe(2);
            expect(older_msgs[0].textContent).toBe('But soft, what light through yonder airlock breaks?');
            expect(older_msgs[1].textContent).toBe('But soft, what light through yonder chimney breaks?');
            done();
        }));

        it("can be sent as a correction by using the up arrow",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
            const room_jid = 'lounge@localhost';
            const room = _converse.api.rooms.get(room_jid);
            const view = _converse.chatboxviews.get(room_jid);
            const textarea = view.el.querySelector('textarea.chat-textarea');
            expect(textarea.value).toBe('');
            view.keyPressed({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('');

            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder airlock breaks?');

            const first_msg = view.model.messages.findWhere({'message': 'But soft, what light through yonder airlock breaks?'});
            expect(textarea.value).toBe('');
            view.keyPressed({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));
            expect(textarea.value).toBe('But soft, what light through yonder airlock breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(true);

            spyOn(_converse.connection, 'send');
            textarea.value = 'But soft, what light through yonder window breaks?';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            expect(_converse.connection.send).toHaveBeenCalled();
            await new Promise((resolve, reject) => view.model.messages.once('rendered', resolve));

            const msg = _converse.connection.send.calls.all()[0].args[0];
            expect(msg.toLocaleString())
            .toBe(`<message from="dummy@localhost/resource" id="${msg.nodeTree.getAttribute("id")}" `+
                    `to="lounge@localhost" type="groupchat" `+
                    `xmlns="jabber:client">`+
                        `<body>But soft, what light through yonder window breaks?</body>`+
                        `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                        `<replace id="${first_msg.get("msgid")}" xmlns="urn:xmpp:message-correct:0"/>`+
                        `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                `</message>`);

            expect(view.model.messages.models.length).toBe(1);
            const corrected_message = view.model.messages.at(0);
            expect(corrected_message.get('msgid')).toBe(first_msg.get('msgid'));
            expect(corrected_message.get('correcting')).toBe(false);
            expect(corrected_message.get('older_versions').length).toBe(1);
            expect(corrected_message.get('older_versions')[0]).toBe('But soft, what light through yonder airlock breaks?');

            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(false);

            // Check that messages from other users are skipped
            await view.model.onMessage($msg({
                'from': room_jid+'/someone-else',
                'id': (new Date()).getTime(),
                'to': 'dummy@localhost',
                'type': 'groupchat'
            }).c('body').t('Hello world').tree());
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);

            // Test that pressing the down arrow cancels message correction
            expect(textarea.value).toBe('');
            view.keyPressed({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);
            await test_utils.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')));
            expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
            view.keyPressed({
                target: textarea,
                keyCode: 40 // Down arrow
            });
            expect(textarea.value).toBe('');
            expect(view.model.messages.at(0).get('correcting')).toBe(false);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);
            await test_utils.waitUntil(() => !u.hasClass('correcting', view.el.querySelector('.chat-msg')));
            done();
        }));

        it("will be shown as received upon MUC reflection",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
            const view = _converse.chatboxviews.get('lounge@localhost');
            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            const msg_obj = view.model.messages.at(0);
            const stanza = u.toStanza(`
                <message xmlns="jabber:client"
                         from="${msg_obj.get('from')}"
                         to="${_converse.connection.jid}"
                         type="groupchat">
                    <body>${msg_obj.get('message')}</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                               by="lounge@localhost"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${msg_obj.get('origin_id')}"/>
                </message>`);
            await view.model.onMessage(stanza);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(1);
            done();
        }));

        it("gets updated with its stanza-id upon MUC reflection",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.openAndEnterChatRoom(_converse, 'room', 'muc.example.com', 'dummy');
            const view = _converse.chatboxviews.get('room@muc.example.com');

            const attrs = {
                'id': _converse.connection.getUniqueId(),
                'origin_id': _converse.connection.getUniqueId(),
                'fullname': 'dummy',
                'references': [],
                'from': _converse.connection.jid,
                'sender': 'me',
                'time': moment().format(),
                'message': 'Hello world',
                'is_spoiler': false,
                'type': 'groupchat' 
            }
            view.model.sendMessage(attrs);
            await test_utils.waitUntil(() => _converse.api.chats.get().length);
            await test_utils.waitUntil(() => view.model.messages.length === 1);
            expect(view.model.messages.at(0).get('stanza_id')).toBeUndefined();
            expect(view.model.messages.at(0).get('origin_id')).toBe(attrs.origin_id);

            const stanza = u.toStanza(`
                <message xmlns="jabber:client"
                         from="room@muc.example.com/dummy"
                         to="${_converse.connection.jid}"
                         type="groupchat">
                    <body>Hello world</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                               by="room@muc.example.com"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${attrs.origin_id}"/>
                </message>`);
            spyOn(view.model, 'handleReflection').and.callThrough();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => view.model.handleReflection.calls.count() === 1);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('stanza_id room@muc.example.com')).toBe("5f3dbc5e-e1d3-4077-a492-693f3769c7ad");
            expect(view.model.messages.at(0).get('origin_id')).toBe(attrs.origin_id);
            done();
        }));

        it("can cause a delivery receipt to be returned",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
            const view = _converse.chatboxviews.get('lounge@localhost');
            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);

            const msg_obj = view.model.messages.at(0);
            const stanza = u.toStanza(`
                <message xml:lang="en" to="dummy@localhost/resource"
                         from="lounge@localhost/some1" type="groupchat" xmlns="jabber:client">
                    <received xmlns="urn:xmpp:receipts" id="${msg_obj.get('msgid')}"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="CE08D448-5ED8-4B6A-BB5B-07ED9DFE4FF0"/>
                </message>`);
            spyOn(_converse, 'emit').and.callThrough();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.emit.calls.count() === 1);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);
            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
            done();
        }));

        it("can cause a chat marker to be returned",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy');
            const view = _converse.chatboxviews.get('lounge@localhost');
            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.keyPressed({
                target: textarea,
                preventDefault: _.noop,
                keyCode: 13 // Enter
            });
            await new Promise((resolve, reject) => view.once('messageInserted', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);

            const msg_obj = view.model.messages.at(0);
            let stanza = u.toStanza(`
                <message xml:lang="en" to="dummy@localhost/resource"
                         from="lounge@localhost/some1" type="groupchat" xmlns="jabber:client">
                    <received xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
                </message>`);
            spyOn(_converse, 'emit').and.callThrough();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.emit.calls.count() === 1);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);
            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

            stanza = u.toStanza(`
                <message xml:lang="en" to="dummy@localhost/resource"
                         from="lounge@localhost/some1" type="groupchat" xmlns="jabber:client">
                    <displayed xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.emit.calls.count() === 2);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);
            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

            stanza = u.toStanza(`
                <message xml:lang="en" to="dummy@localhost/resource"
                         from="lounge@localhost/some1" type="groupchat" xmlns="jabber:client">
                    <acknowledged xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.emit.calls.count() === 3);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);
            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

            stanza = u.toStanza(`
                <message xml:lang="en" to="dummy@localhost/resource"
                         from="lounge@localhost/some1" type="groupchat" xmlns="jabber:client">
                    <body>'tis I!</body>
                    <markable xmlns="urn:xmpp:chat-markers:0"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await test_utils.waitUntil(() => _converse.emit.calls.count() === 5);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);
            expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
            done();
        }));

        describe("when received", function () {

            it("highlights all users mentioned via XEP-0372 references",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'tom');
                const view = _converse.chatboxviews.get('lounge@localhost');
                ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh'].forEach((nick) => {
                    _converse.connection._dataRecv(test_utils.createRequest(
                        $pres({
                            'to': 'tom@localhost/resource',
                            'from': `lounge@localhost/${nick}`
                        })
                        .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': `${nick}@localhost/resource`,
                            'role': 'participant'
                        }))
                    );
                });
                const msg = $msg({
                        from: 'lounge@localhost/gibson',
                        id: (new Date()).getTime(),
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t('hello z3r0 tom mr.robot, how are you?').up()
                        .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'6', 'end':'10', 'type':'mention', 'uri':'xmpp:z3r0@localhost'}).up()
                        .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'11', 'end':'14', 'type':'mention', 'uri':'xmpp:dummy@localhost'}).up()
                        .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'15', 'end':'23', 'type':'mention', 'uri':'xmpp:mr.robot@localhost'}).nodeTree;
                await view.model.onMessage(msg);
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                expect(view.el.querySelectorAll('.chat-msg__text').length).toBe(1);
                expect(view.el.querySelector('.chat-msg__text').outerHTML).toBe(
                    '<div class="chat-msg__text">hello <span class="mention">z3r0</span> '+
                    '<span class="mention mention--self badge badge-info">tom</span> '+
                    '<span class="mention">mr.robot</span>, how are you?</div>');
                done();
            }));
        });

        describe("in which someone is mentioned", function () {

            it("gets parsed for mentions which get turned into references",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'tom');
                const view = _converse.chatboxviews.get('lounge@localhost');
                ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh', 'Link Mauve'].forEach((nick) => {
                    _converse.connection._dataRecv(test_utils.createRequest(
                        $pres({
                            'to': 'tom@localhost/resource',
                            'from': `lounge@localhost/${nick}`
                        })
                        .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': `${nick.replace(/\s/g, '-')}@localhost/resource`,
                            'role': 'participant'
                        })));
                });

                // Run a few unit tests for the parseTextForReferences method
                let [text, references] = view.model.parseTextForReferences('hello z3r0')
                expect(references.length).toBe(0);
                expect(text).toBe('hello z3r0');

                [text, references] = view.model.parseTextForReferences('hello @z3r0')
                expect(references.length).toBe(1);
                expect(text).toBe('hello z3r0');
                expect(JSON.stringify(references))
                    .toBe('[{"begin":6,"end":10,"value":"z3r0","type":"mention","uri":"xmpp:z3r0@localhost"}]');

                [text, references] = view.model.parseTextForReferences('hello @some1 @z3r0 @gibson @mr.robot, how are you?')
                expect(text).toBe('hello @some1 z3r0 gibson mr.robot, how are you?');
                expect(JSON.stringify(references))
                    .toBe('[{"begin":13,"end":17,"value":"z3r0","type":"mention","uri":"xmpp:z3r0@localhost"},'+
                            '{"begin":18,"end":24,"value":"gibson","type":"mention","uri":"xmpp:gibson@localhost"},'+
                            '{"begin":25,"end":33,"value":"mr.robot","type":"mention","uri":"xmpp:mr.robot@localhost"}]');

                [text, references] = view.model.parseTextForReferences('yo @gib')
                expect(text).toBe('yo @gib');
                expect(references.length).toBe(0);

                [text, references] = view.model.parseTextForReferences('yo @gibsonian')
                expect(text).toBe('yo @gibsonian');
                expect(references.length).toBe(0);

                [text, references] = view.model.parseTextForReferences('@gibson')
                expect(text).toBe('gibson');
                expect(references.length).toBe(1);
                expect(JSON.stringify(references))
                    .toBe('[{"begin":0,"end":6,"value":"gibson","type":"mention","uri":"xmpp:gibson@localhost"}]');

                [text, references] = view.model.parseTextForReferences('hi @Link Mauve how are you?')
                expect(text).toBe('hi Link Mauve how are you?');
                expect(references.length).toBe(1);
                expect(JSON.stringify(references))
                    .toBe('[{"begin":3,"end":13,"value":"Link Mauve","type":"mention","uri":"xmpp:Link-Mauve@localhost"}]');
                done();
            }));

            it("can get corrected and given new references",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'tom');
                const view = _converse.chatboxviews.get('lounge@localhost');
                ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh'].forEach((nick) => {
                    _converse.connection._dataRecv(test_utils.createRequest(
                        $pres({
                            'to': 'tom@localhost/resource',
                            'from': `lounge@localhost/${nick}`
                        })
                        .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': `${nick}@localhost/resource`,
                            'role': 'participant'
                        })));
                });

                const textarea = view.el.querySelector('textarea.chat-textarea');
                textarea.value = 'hello @z3r0 @gibson @mr.robot, how are you?'
                const enter_event = {
                    'target': textarea,
                    'preventDefault': _.noop,
                    'stopPropagation': _.noop,
                    'keyCode': 13 // Enter
                }
                spyOn(_converse.connection, 'send');
                view.keyPressed(enter_event);
                await new Promise((resolve, reject) => view.once('messageInserted', resolve));
                const msg = _converse.connection.send.calls.all()[0].args[0];
                expect(msg.toLocaleString())
                    .toBe(`<message from="dummy@localhost/resource" id="${msg.nodeTree.getAttribute("id")}" `+
                            `to="lounge@localhost" type="groupchat" `+
                            `xmlns="jabber:client">`+
                                `<body>hello z3r0 gibson mr.robot, how are you?</body>`+
                                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<reference begin="18" end="26" type="mention" uri="xmpp:mr.robot@localhost" xmlns="urn:xmpp:reference:0"/>`+
                                `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@localhost" xmlns="urn:xmpp:reference:0"/>`+
                                `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@localhost" xmlns="urn:xmpp:reference:0"/>`+
                                `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                            `</message>`);

                const first_msg = view.model.messages.findWhere({'message': 'hello z3r0 gibson mr.robot, how are you?'});
                const action = view.el.querySelector('.chat-msg .chat-msg__action');
                action.style.opacity = 1;
                action.click();

                expect(textarea.value).toBe('hello @z3r0 @gibson @mr.robot, how are you?');
                expect(view.model.messages.at(0).get('correcting')).toBe(true);
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                await test_utils.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')));

                textarea.value = 'hello @z3r0 @gibson @sw0rdf1sh, how are you?';
                view.keyPressed(enter_event);

                const correction = _converse.connection.send.calls.all()[1].args[0];
                expect(correction.toLocaleString())
                    .toBe(`<message from="dummy@localhost/resource" id="${correction.nodeTree.getAttribute("id")}" `+
                            `to="lounge@localhost" type="groupchat" `+
                            `xmlns="jabber:client">`+
                                `<body>hello z3r0 gibson sw0rdf1sh, how are you?</body>`+
                                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<reference begin="18" end="27" type="mention" uri="xmpp:sw0rdf1sh@localhost" xmlns="urn:xmpp:reference:0"/>`+
                                `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@localhost" xmlns="urn:xmpp:reference:0"/>`+
                                `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@localhost" xmlns="urn:xmpp:reference:0"/>`+
                                `<replace id="${msg.nodeTree.getAttribute("id")}" xmlns="urn:xmpp:message-correct:0"/>`+
                                `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                            `</message>`);
                done();
            }));

            it("includes XEP-0372 references to that person",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'tom')
                .then(() => {
                    const view = _converse.chatboxviews.get('lounge@localhost');
                    ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh'].forEach((nick) => {
                        _converse.connection._dataRecv(test_utils.createRequest(
                            $pres({
                                'to': 'tom@localhost/resource',
                                'from': `lounge@localhost/${nick}`
                            })
                            .c('x', {xmlns: Strophe.NS.MUC_USER})
                            .c('item', {
                                'affiliation': 'none',
                                'jid': `${nick}@localhost/resource`,
                                'role': 'participant'
                            })));
                    });

                    spyOn(_converse.connection, 'send');
                    const textarea = view.el.querySelector('textarea.chat-textarea');
                    textarea.value = 'hello @z3r0 @gibson @mr.robot, how are you?'
                    const enter_event = {
                        'target': textarea,
                        'preventDefault': _.noop,
                        'stopPropagation': _.noop,
                        'keyCode': 13 // Enter
                    }
                    view.keyPressed(enter_event);

                    const msg = _converse.connection.send.calls.all()[0].args[0];
                    expect(msg.toLocaleString())
                        .toBe(`<message from="dummy@localhost/resource" id="${msg.nodeTree.getAttribute("id")}" `+
                                `to="lounge@localhost" type="groupchat" `+
                                `xmlns="jabber:client">`+
                                    `<body>hello z3r0 gibson mr.robot, how are you?</body>`+
                                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                    `<reference begin="18" end="26" type="mention" uri="xmpp:mr.robot@localhost" xmlns="urn:xmpp:reference:0"/>`+
                                    `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@localhost" xmlns="urn:xmpp:reference:0"/>`+
                                    `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@localhost" xmlns="urn:xmpp:reference:0"/>`+
                                    `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                              `</message>`);
                    done();
                }).catch(_.partial(console.error, _));
            }));
        });
    });
}));
