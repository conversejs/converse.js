(function (root, factory) {
    define([
        "jquery",
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function ($, jasmine, mock, test_utils) {
    "use strict";
    const _ = converse.env._;
    const $iq = converse.env.$iq;
    const $msg = converse.env.$msg;
    const $pres = converse.env.$pres;
    const Strophe = converse.env.Strophe;
    const Promise = converse.env.Promise;
    const moment = converse.env.moment;
    const u = converse.env.utils;


    describe("A Chat Message", function () {

        it("can be sent as a correction by clicking the pencil icon",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                const view = _converse.chatboxviews.get(contact_jid);
                const textarea = view.el.querySelector('textarea.chat-textarea');

                textarea.value = 'But soft, what light through yonder airlock breaks?';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13 // Enter
                });
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
                expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(true);

                spyOn(_converse.connection, 'send');
                textarea.value = 'But soft, what light through yonder window breaks?';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13 // Enter
                });
                expect(_converse.connection.send).toHaveBeenCalled();

                const msg = _converse.connection.send.calls.all()[0].args[0];
                expect(msg.toLocaleString())
                .toBe(`<message from='dummy@localhost/resource' `+
                        `to='max.frankfurter@localhost' type='chat' id='${msg.nodeTree.getAttribute('id')}' `+
                        `xmlns='jabber:client'>`+
                            `<body>But soft, what light through yonder window breaks?</body>`+
                            `<active xmlns='http://jabber.org/protocol/chatstates'/>`+
                            `<replace xmlns='urn:xmpp:message-correct:0' id='${first_msg.get('msgid')}'/>`+
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

                expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
                expect(view.model.messages.at(0).get('correcting')).toBe(true);
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(true);

                action = view.el.querySelector('.chat-msg .chat-msg__action');
                action.style.opacity = 1;
                action.click();
                expect(textarea.value).toBe('');
                expect(view.model.messages.at(0).get('correcting')).toBe(false);
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(false);

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
            });
        }));


        it("can be sent as a correction by using the up arrow",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
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
                expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(true);

                spyOn(_converse.connection, 'send');
                textarea.value = 'But soft, what light through yonder window breaks?';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13 // Enter
                });
                expect(_converse.connection.send).toHaveBeenCalled();

                const msg = _converse.connection.send.calls.all()[0].args[0];
                expect(msg.toLocaleString())
                .toBe(`<message from='dummy@localhost/resource' `+
                        `to='max.frankfurter@localhost' type='chat' id='${msg.nodeTree.getAttribute('id')}' `+
                        `xmlns='jabber:client'>`+
                            `<body>But soft, what light through yonder window breaks?</body>`+
                            `<active xmlns='http://jabber.org/protocol/chatstates'/>`+
                            `<replace xmlns='urn:xmpp:message-correct:0' id='${first_msg.get('msgid')}'/>`+
                    `</message>`);
                expect(view.model.messages.models.length).toBe(1);
                const corrected_message = view.model.messages.at(0);
                expect(corrected_message.get('msgid')).toBe(first_msg.get('msgid'));
                expect(corrected_message.get('correcting')).toBe(false);
                expect(corrected_message.get('older_versions').length).toBe(1);
                expect(corrected_message.get('older_versions')[0]).toBe('But soft, what light through yonder airlock breaks?');

                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(false);

                // Test that pressing the down arrow cancels message correction
                expect(textarea.value).toBe('');
                view.keyPressed({
                    target: textarea,
                    keyCode: 38 // Up arrow
                });
                expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
                expect(view.model.messages.at(0).get('correcting')).toBe(true);
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(true);
                expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
                view.keyPressed({
                    target: textarea,
                    keyCode: 40 // Down arrow
                });
                expect(textarea.value).toBe('');
                expect(view.model.messages.at(0).get('correcting')).toBe(false);
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(false);

                textarea.value = 'It is the east, and Juliet is the one.';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13 // Enter
                });
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);

                textarea.value =  'Arise, fair sun, and kill the envious moon';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13 // Enter
                });
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(3);

                view.keyPressed({
                    target: textarea,
                    keyCode: 38 // Up arrow
                });
                expect(textarea.value).toBe('Arise, fair sun, and kill the envious moon');
                expect(view.model.messages.at(0).get('correcting')).toBeFalsy();
                expect(view.model.messages.at(1).get('correcting')).toBeFalsy();
                expect(view.model.messages.at(2).get('correcting')).toBe(true);

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

                textarea.value = 'It is the east, and Juliet is the sun.';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13 // Enter
                });
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
            });
        }));



        it("can be received out of order, and will still be displayed in the right order",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {


            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();

            test_utils.waitUntil(function () {
                    return $(_converse.rosterview.el).find('.roster-group').length;
                }, 300)
            .then(function () {
                var message, msg;
                spyOn(_converse, 'log');
                spyOn(_converse.chatboxes, 'getChatBox').and.callThrough();
                _converse.filter_by_resource = true;
                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

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
                _converse.chatboxes.onMessage(msg);

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
                _converse.chatboxes.onMessage(msg);

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
                _converse.chatboxes.onMessage(msg);

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
                _converse.chatboxes.onMessage(msg);

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
                _converse.chatboxes.onMessage(msg);

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
                _converse.chatboxes.onMessage(msg);

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
                _converse.chatboxes.onMessage(msg);

                msg = $msg({
                        'id': 'aeb220',
                        'to': _converse.bare_jid,
                        'xmlns': 'jabber:client',
                        'from': sender_jid,
                        'type': 'chat'})
                    .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                    .c('body').t("latest message")
                    .tree();
                _converse.chatboxes.onMessage(msg);

                var chatboxview = _converse.chatboxviews.get(sender_jid);
                var $chat_content = $(chatboxview.el).find('.chat-content');
                chatboxview.clearSpinner(); //cleanup

                expect($chat_content[0].querySelectorAll('.date-separator').length).toEqual(4);

                var $day = $chat_content.find('.date-separator:first');
                expect($day.data('isodate')).toEqual(moment('2017-12-31T00:00:00').format());

                var $time = $chat_content.find('time:first');
                expect($time.text()).toEqual('Sunday Dec 31st 2017')

                $day = $chat_content.find('.date-separator:first');
                expect($day[0].nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('Older message');

                var $el = $chat_content.find('.chat-msg:first').find('.chat-msg__text')
                expect($el.hasClass('chat-msg--followup')).toBe(false);
                expect($el.text()).toEqual('Older message');

                $time = $chat_content.find('time.separator-text:eq(1)');
                expect($time.text()).toEqual("Monday Jan 1st 2018");

                $day = $chat_content.find('.date-separator:eq(1)');
                expect($day.data('isodate')).toEqual(moment('2018-01-01T00:00:00').format());
                expect($day[0].nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('Inbetween message');

                $el = $chat_content.find('.chat-msg:eq(1)');
                expect($el.find('.chat-msg__text').text()).toEqual('Inbetween message');
                expect($el[0].nextElementSibling.querySelector('.chat-msg__text').textContent).toEqual('another inbetween message');
                $el = $chat_content.find('.chat-msg:eq(2)');
                expect($el.find('.chat-msg__text').text()).toEqual('another inbetween message');
                expect($el.hasClass('chat-msg--followup')).toBe(true);

                $time = $chat_content.find('time.separator-text:nth(2)');
                expect($time.text()).toEqual("Tuesday Jan 2nd 2018");

                $day = $chat_content.find('.date-separator:nth(2)');
                expect($day.data('isodate')).toEqual(moment('2018-01-02T00:00:00').format());
                expect($day[0].nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('An earlier message on the next day');

                $el = $chat_content.find('.chat-msg:eq(3)');
                expect($el.find('.chat-msg__text').text()).toEqual('An earlier message on the next day');
                expect($el.hasClass('chat-msg--followup')).toBe(false);

                $el = $chat_content.find('.chat-msg:eq(4)');
                expect($el.find('.chat-msg__text').text()).toEqual('message');
                expect($el[0].nextElementSibling.querySelector('.chat-msg__text').textContent).toEqual('newer message from the next day');
                expect($el.hasClass('chat-msg--followup')).toBe(false);

                $day = $chat_content.find('.date-separator:last');
                expect($day.data('isodate')).toEqual(moment().startOf('day').format());
                expect($day[0].nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('latest message');
                expect($el.hasClass('chat-msg--followup')).toBe(false);
                done();
            });
        }));

        it("is ignored if it's a malformed headline message",
        mock.initConverseWithPromises(
            null, ['rosterGroupsFetched'], {},
            function (done, _converse) {

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
            _converse.chatboxes.onMessage(msg);
            expect(_converse.log.calledWith(
                "onMessage: Ignoring incoming headline message sent with type 'chat' from JID: localhost",
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
        mock.initConverseWithPromises(
            null, ['rosterGroupsFetched'], {},
            function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();

            // Send a message from a different resource
            spyOn(_converse, 'log');
            var msgtext = 'This is a carbon message';
            var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
            var msg = $msg({
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
            _converse.chatboxes.onMessage(msg);

            // Check that the chatbox and its view now exist
            var chatbox = _converse.chatboxes.get(sender_jid);
            var chatboxview = _converse.chatboxviews.get(sender_jid);
            expect(chatbox).toBeDefined();
            expect(chatboxview).toBeDefined();
            // Check that the message was received and check the message parameters
            expect(chatbox.messages.length).toEqual(1);
            var msg_obj = chatbox.messages.models[0];
            expect(msg_obj.get('message')).toEqual(msgtext);
            expect(msg_obj.get('fullname')).toEqual(mock.cur_names[1]);
            expect(msg_obj.get('sender')).toEqual('them');
            expect(msg_obj.get('is_delayed')).toEqual(false);
            // Now check that the message appears inside the chatbox in the DOM
            const chat_content = chatboxview.el.querySelector('.chat-content');
            expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(msgtext);
            expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
            return test_utils.waitUntil(() => chatbox.vcard.get('fullname') === 'Candice van der Knijff')
            .then(function () {
                expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Candice van der Knijff');
                done();
            });
        }));

        it("can be a carbon message that this user sent from a different client, as defined in XEP-0280",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.waitUntilDiscoConfirmed(_converse, 'localhost', [], ['vcard-temp']).then(function () {
                test_utils.createContacts(_converse, 'current');
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
                _converse.chatboxes.onMessage(msg);

                // Check that the chatbox and its view now exist
                const chatbox = _converse.chatboxes.get(recipient_jid);
                const chatboxview = _converse.chatboxviews.get(recipient_jid);
                expect(chatbox).toBeDefined();
                expect(chatboxview).toBeDefined();
                // Check that the message was received and check the message parameters
                expect(chatbox.messages.length).toEqual(1);
                const  msg_obj = chatbox.messages.models[0];
                expect(msg_obj.get('message')).toEqual(msgtext);
                expect(msg_obj.get('fullname')).toEqual(_converse.xmppstatus.get('fullname'));
                expect(msg_obj.get('sender')).toEqual('me');
                expect(msg_obj.get('is_delayed')).toEqual(false);
                // Now check that the message appears inside the chatbox in the DOM
                const msg_txt = chatboxview.el.querySelector('.chat-content .chat-msg .chat-msg__text').textContent;
                expect(msg_txt).toEqual(msgtext);
                done();
            });
        }));

        it("will be discarded if it's a malicious message meant to look like a carbon copy",
        mock.initConverseWithPromises(
            null, ['rosterGroupsFetched'], {},
            function (done, _converse) {

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
            var msgtext = 'Please come to Creepy Valley tonight, alone!';
            var sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@localhost';
            var impersonated_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@localhost';
            var msg = $msg({
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
            _converse.chatboxes.onMessage(msg);

            // Check that chatbox for impersonated user is not created.
            var chatbox = _converse.chatboxes.get(impersonated_jid);
            expect(chatbox).not.toBeDefined();

            // Check that the chatbox for the malicous user is not created
            chatbox = _converse.chatboxes.get(sender_jid);
            expect(chatbox).not.toBeDefined();
            done();
        }));

        it("received for a minimized chat box will increment a counter on its header",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            if (_converse.view_mode === 'fullscreen') {
                return done();
            }
            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            const contact_name = mock.cur_names[0];
            const contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openControlBox();
            spyOn(_converse, 'emit').and.callThrough();

            test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length)
            .then(() => test_utils.openChatBoxFor(_converse, contact_jid))
            .then(() => {
                var chatview = _converse.chatboxviews.get(contact_jid);
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
                _converse.chatboxes.onMessage(msg);
                expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                var trimmed_chatboxes = _converse.minimized_chats;
                var trimmedview = trimmed_chatboxes.get(contact_jid);
                var $count = $(trimmedview.el).find('.message-count');
                expect(u.isVisible(chatview.el)).toBeFalsy();
                expect(trimmedview.model.get('minimized')).toBeTruthy();
                expect(u.isVisible($count[0])).toBeTruthy();
                expect($count.html()).toBe('1');
                _converse.chatboxes.onMessage(
                    $msg({
                        from: mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost',
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: (new Date()).getTime()
                    }).c('body').t('This message is also sent to a minimized chatbox').up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
                );
                expect(u.isVisible(chatview.el)).toBeFalsy();
                expect(trimmedview.model.get('minimized')).toBeTruthy();
                $count = $(trimmedview.el).find('.message-count');
                expect(u.isVisible($count[0])).toBeTruthy();
                expect($count.html()).toBe('2');
                trimmedview.el.querySelector('.restore-chat').click();
                expect(trimmed_chatboxes.keys().length).toBe(0);
                done();
            });
        }));

        it("will indicate when it has a time difference of more than a day between it and its predecessor",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();
            spyOn(_converse, 'emit');
            const contact_name = mock.cur_names[1];
            const contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length)
            .then(() => test_utils.openChatBoxFor(_converse, contact_jid))
            .then(() => {
                test_utils.clearChatBoxMessages(_converse, contact_jid);
                var one_day_ago = moment();
                one_day_ago.subtract('days', 1);
                var message = 'This is a day old message';
                var chatbox = _converse.chatboxes.get(contact_jid);
                var chatboxview = _converse.chatboxviews.get(contact_jid);
                var msg_obj;
                var msg_txt;
                var sender_txt;

                var msg = $msg({
                    from: contact_jid,
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: one_day_ago.unix()
                }).c('body').t(message).up()
                .c('delay', { xmlns:'urn:xmpp:delay', from: 'localhost', stamp: one_day_ago.format() })
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                _converse.chatboxes.onMessage(msg);
                expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                expect(chatbox.messages.length).toEqual(1);
                msg_obj = chatbox.messages.models[0];
                expect(msg_obj.get('message')).toEqual(message);
                expect(msg_obj.get('fullname')).toEqual(contact_name);
                expect(msg_obj.get('sender')).toEqual('them');
                expect(msg_obj.get('is_delayed')).toEqual(true);

                return test_utils.waitUntil(() => chatbox.vcard.get('fullname') === 'Candice van der Knijff')
                .then(function () {
                    const chat_content = chatboxview.el.querySelector('.chat-content');
                    expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(message);
                    expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                    expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Candice van der Knijff');

                    expect(chat_content.querySelectorAll('.date-separator').length).toEqual(1);
                    const day = chat_content.querySelector('.date-separator');
                    expect(day.getAttribute('class')).toEqual('message date-separator');
                    expect(day.getAttribute('data-isodate')).toEqual(moment(one_day_ago.startOf('day')).format());

                    const $chat_content = $(chat_content);
                    var $time = $chat_content.find('time.separator-text');
                    expect($time.text()).toEqual(moment(one_day_ago.startOf('day')).format("dddd MMM Do YYYY"));

                    message = 'This is a current message';
                    msg = $msg({
                        from: contact_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: new Date().getTime()
                    }).c('body').t(message).up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                    _converse.chatboxes.onMessage(msg);
                    expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));
                    // Check that there is a <time> element, with the required
                    // props.
                    expect($chat_content[0].querySelectorAll('time.separator-text').length).toEqual(2); // There are now two time elements

                    var message_date = new Date();
                    const $day = $chat_content.find('.date-separator:last');
                    expect($day.length).toEqual(1);
                    expect($day.attr('class')).toEqual('message date-separator');
                    expect($day.data('isodate')).toEqual(moment(message_date).startOf('day').format());

                    $time = $chat_content.find('time.separator-text:last');
                    expect($time.text()).toEqual(moment(message_date).startOf('day').format("dddd MMM Do YYYY"));

                    // Normal checks for the 2nd message
                    expect(chatbox.messages.length).toEqual(2);
                    msg_obj = chatbox.messages.models[1];
                    expect(msg_obj.get('message')).toEqual(message);
                    expect(msg_obj.get('fullname')).toEqual(contact_name);
                    expect(msg_obj.get('sender')).toEqual('them');
                    expect(msg_obj.get('is_delayed')).toEqual(false);
                    msg_txt = $chat_content.find('.chat-msg').last().find('.chat-msg__text').text();
                    expect(msg_txt).toEqual(message);

                    expect(chat_content.querySelector('.chat-msg:last-child .chat-msg__text').textContent).toEqual(message);
                    expect(chat_content.querySelector('.chat-msg:last-child .chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                    expect(chat_content.querySelector('.chat-msg:last-child .chat-msg__author').textContent.trim()).toBe('Candice van der Knijff');
                    done();
                });
            });
        }));

        it("can be sent from a chatbox, and will appear inside it",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();

            spyOn(_converse, 'emit');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                expect(_converse.emit).toHaveBeenCalledWith('chatBoxFocused', jasmine.any(Object));
                const view = _converse.chatboxviews.get(contact_jid);
                const message = 'This message is sent from this chatbox';
                spyOn(view.model, 'sendMessage').and.callThrough();
                test_utils.sendMessage(view, message);
                expect(view.model.sendMessage).toHaveBeenCalled();
                expect(view.model.messages.length, 2);
                expect(_converse.emit.calls.mostRecent().args, ['messageSend', message]);
                expect($(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text').text()).toEqual(message);
                done();
            });
        }));

        it("is sanitized to prevent Javascript injection attacks",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                const view = _converse.chatboxviews.get(contact_jid);
                const message = '<p>This message contains <em>some</em> <b>markup</b></p>';
                spyOn(view.model, 'sendMessage').and.callThrough();
                test_utils.sendMessage(view, message);
                expect(view.model.sendMessage).toHaveBeenCalled();
                const msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
                expect(msg.text()).toEqual(message);
                expect(msg.html()).toEqual('&lt;p&gt;This message contains &lt;em&gt;some&lt;/em&gt; &lt;b&gt;markup&lt;/b&gt;&lt;/p&gt;');
                done();
            });
        }));

        it("can contain hyperlinks, which will be clickable",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                const view = _converse.chatboxviews.get(contact_jid);
                const message = 'This message contains a hyperlink: www.opkode.com';
                spyOn(view.model, 'sendMessage').and.callThrough();
                test_utils.sendMessage(view, message);
                expect(view.model.sendMessage).toHaveBeenCalled();
                const msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
                expect(msg.text()).toEqual(message);
                expect(msg.html()).toEqual('This message contains a hyperlink: <a target="_blank" rel="noopener" href="http://www.opkode.com">www.opkode.com</a>');
                done();
            });
        }));

        it("will have properly escaped URLs",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            test_utils.openControlBox();

            let message, msg;
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                var view = _converse.chatboxviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();
                message = "http://www.opkode.com/'onmouseover='alert(1)'whatever";
                test_utils.sendMessage(view, message);
                expect(view.model.sendMessage).toHaveBeenCalled();
                msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
                expect(msg.text()).toEqual(message);
                expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%27onmouseover=%27alert%281%29%27whatever">http://www.opkode.com/\'onmouseover=\'alert(1)\'whatever</a>');
                message = 'http://www.opkode.com/"onmouseover="alert(1)"whatever';
                test_utils.sendMessage(view, message);

                expect(view.model.sendMessage).toHaveBeenCalled();
                msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
                expect(msg.text()).toEqual(message);
                expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%22onmouseover=%22alert%281%29%22whatever">http://www.opkode.com/"onmouseover="alert(1)"whatever</a>');

                message = "https://en.wikipedia.org/wiki/Ender's_Game";
                test_utils.sendMessage(view, message);

                expect(view.model.sendMessage).toHaveBeenCalled();
                msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
                expect(msg.text()).toEqual(message);
                expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">'+message+'</a>');

                message = "https://en.wikipedia.org/wiki/Ender's_Game";
                test_utils.sendMessage(view, message);

                expect(view.model.sendMessage).toHaveBeenCalled();
                msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
                expect(msg.text()).toEqual(message);
                expect(msg.html()).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">'+message+'</a>');
                done();
            });
        }));

        it("will render newlines",
                mock.initConverseWithPromises(null, ['rosterGroupsFetched', 'chatBoxesFetched'], {}, function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);

            let stanza = Strophe.xmlHtmlNode(
                "<message from='"+contact_jid+"'"+
                "         type='chat'"+
                "         to='dummy@localhost/resource'>"+
                "    <body>Hey\nHave you heard the news?</body>"+
                "</message>").firstChild;
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            const view = _converse.chatboxviews.get(contact_jid);
            const chat_content = view.el.querySelector('.chat-content');
            expect(chat_content.querySelector('.chat-msg__text').innerHTML).toBe('Hey<br>Have you heard the news?');

            stanza = Strophe.xmlHtmlNode(
                "<message from='"+contact_jid+"'"+
                "         type='chat'"+
                "         to='dummy@localhost/resource'>"+
                "    <body>Hey\n\n\nHave you heard the news?</body>"+
                "</message>").firstChild;
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(chat_content.querySelector('.message:last-child .chat-msg__text').innerHTML).toBe('Hey<br><br>Have you heard the news?');

            stanza = Strophe.xmlHtmlNode(
                "<message from='"+contact_jid+"'"+
                "         type='chat'"+
                "         to='dummy@localhost/resource'>"+
                "    <body>Hey\nHave you heard\nthe news?</body>"+
                "</message>").firstChild;
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(chat_content.querySelector('.message:last-child .chat-msg__text').innerHTML).toBe('Hey<br>Have you heard<br>the news?');
            done();
        }));

        it("will render images from their URLs",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    function (done, _converse) {

            test_utils.createContacts(_converse, 'current', 1);
            _converse.emit('rosterContactsFetched');
            const base_url = document.URL.split(window.location.pathname)[0];
            let message = base_url+"/logo/conversejs-filled.svg";
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            let view;
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                view = _converse.chatboxviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();
                test_utils.sendMessage(view, message);
                return test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length, 1000)
            }).then(() => {
                expect(view.model.sendMessage).toHaveBeenCalled();
                const msg = $(view.el).find('.chat-content .chat-msg').last().find('.chat-msg__text');
                expect(msg.html().trim()).toEqual(
                    '<!-- src/templates/image.html -->\n'+
                    '<a href="'+base_url+'/logo/conversejs-filled.svg" target="_blank" rel="noopener"><img class="chat-image img-thumbnail"'+
                    ' src="' + message + '"></a>');
                message += "?param1=val1&param2=val2";
                test_utils.sendMessage(view, message);
                return test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length === 2, 1000);
            }).then(() => {
                expect(view.model.sendMessage).toHaveBeenCalled();
                const msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
                expect(msg.html().trim()).toEqual(
                    '<!-- src/templates/image.html -->\n'+
                    '<a href="'+base_url+'/logo/conversejs-filled.svg?param1=val1&amp;param2=val2" target="_blank" rel="noopener"><img'+
                    ' class="chat-image img-thumbnail" src="'+message.replace(/&/g, '&amp;')+'"></a>')

                // Test now with two images in one message
                message += ' hello world '+base_url+"/logo/conversejs-filled.svg";
                test_utils.sendMessage(view, message);
                return test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length === 4, 1000);
            }).then(function () {
                expect(view.model.sendMessage).toHaveBeenCalled();
                const msg = $(view.el).find('.chat-content').find('.chat-msg').last().find('.chat-msg__text');
                expect(msg[0].textContent.trim()).toEqual('hello world');
                expect(msg[0].querySelectorAll('img').length).toEqual(2);
                done();
            });
        }));

        it("will render the message time as configured",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'],
                    {}, function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');

            _converse.time_format = 'hh:mm';
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                const view = _converse.chatboxviews.get(contact_jid);
                const message = 'This message is sent from this chatbox';
                test_utils.sendMessage(view, message);

                const chatbox = _converse.chatboxes.get(contact_jid);
                expect(chatbox.messages.models.length, 1);
                const msg_object = chatbox.messages.models[0];

                const msg_author = view.el.querySelector('.chat-content .chat-msg:last-child .chat-msg__author');
                expect(msg_author.textContent.trim()).toBe('Max Mustermann');

                const msg_time = view.el.querySelector('.chat-content .chat-msg:last-child .chat-msg__time');
                const time = moment(msg_object.get('time')).format(_converse.time_format);
                expect(msg_time.textContent).toBe(time);
                done();
            });
        }));

        it("will be correctly identified and rendered as a followup message",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openControlBox();

            test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 300)
            .then(function () {
                const base_time = new Date();
                const ONE_MINUTE_LATER = 60000;

                jasmine.clock().install();
                jasmine.clock().mockDate(base_time);

                var message, msg;
                spyOn(_converse, 'log');
                spyOn(_converse.chatboxes, 'getChatBox').and.callThrough();
                _converse.filter_by_resource = true;
                var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';

                _converse.chatboxes.onMessage($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': (new Date()).getTime()
                    }).c('body').t('A message').up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());

                jasmine.clock().tick(3*ONE_MINUTE_LATER);

                _converse.chatboxes.onMessage($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': (new Date()).getTime()
                    }).c('body').t("Another message 3 minutes later").up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());

                jasmine.clock().tick(11*ONE_MINUTE_LATER);

                _converse.chatboxes.onMessage($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': (new Date()).getTime()
                    }).c('body').t("Another message 14 minutes since we started").up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());

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

                jasmine.clock().tick(1*ONE_MINUTE_LATER);

                _converse.chatboxes.onMessage($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': (new Date()).getTime()
                    }).c('body').t("Another message 1 minute and 1 second since the previous one").up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());

                jasmine.clock().tick(1*ONE_MINUTE_LATER);

                var view = _converse.chatboxviews.get(sender_jid);
                test_utils.sendMessage(view, "Another message within 10 minutes, but from a different person");

                var chat_content = view.el.querySelector('.chat-content');
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
            });
        }));

        describe("in which someone is mentioned", function () {

            it("includes XEP-0372 references to that person",
                mock.initConverseWithPromises(
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

                    let [text, references] = view.model.parseForReferences('hello z3r0')
                    expect(references.length).toBe(0);
                    expect(text).toBe('hello z3r0');

                    [text, references] = view.model.parseForReferences('hello @z3r0')
                    expect(references.length).toBe(1);
                    expect(text).toBe('hello z3r0');
                    expect(JSON.stringify(references))
                        .toBe('[{"begin":6,"end":10,"type":"mention","uri":"xmpp:z3r0@localhost"}]');

                    [text, references] = view.model.parseForReferences('hello @some1 @z3r0 @gibson @mr.robot, how are you?')
                    expect(text).toBe('hello @some1 z3r0 gibson mr.robot, how are you?');
                    expect(JSON.stringify(references))
                        .toBe('[{"begin":13,"end":17,"type":"mention","uri":"xmpp:z3r0@localhost"},'+
                               '{"begin":18,"end":24,"type":"mention","uri":"xmpp:gibson@localhost"},'+
                               '{"begin":25,"end":33,"type":"mention","uri":"xmpp:mr.robot@localhost"}]');

                    [text, references] = view.model.parseForReferences('yo @gib')
                    expect(text).toBe('yo @gib');
                    expect(references.length).toBe(0);

                    [text, references] = view.model.parseForReferences('yo @gibsonian')
                    expect(text).toBe('yo @gibsonian');
                    expect(references.length).toBe(0);
                    done();
                }).catch(_.partial(console.error, _));
            }));
        });


        describe("when received from someone else", function () {

            it("will open a chatbox and be displayed inside it",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();
                test_utils.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 300)
                .then(function () {
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

                    expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

                    // Check that the chatbox and its view now exist
                    const chatbox = _converse.chatboxes.get(sender_jid);
                    const chatboxview = _converse.chatboxviews.get(sender_jid);
                    expect(chatbox).toBeDefined();
                    expect(chatboxview).toBeDefined();
                    // Check that the message was received and check the message parameters
                    expect(chatbox.messages.length).toEqual(1);
                    const msg_obj = chatbox.messages.models[0];
                    expect(msg_obj.get('message')).toEqual(message);
                    expect(msg_obj.get('fullname')).toEqual(mock.cur_names[0]);
                    expect(msg_obj.get('sender')).toEqual('them');
                    expect(msg_obj.get('is_delayed')).toEqual(false);
                    // Now check that the message appears inside the chatbox in the DOM
                    const chat_content = chatboxview.el.querySelector('.chat-content');
                    expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(message);
                    expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                    return test_utils.waitUntil(() => chatbox.vcard.get('fullname') === mock.cur_names[0])
                    .then(function () {
                        expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Max Frankfurter');
                        done();
                    });
                });
            }));

            it("can be replaced with a correction",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current', 1);
                _converse.emit('rosterContactsFetched');
                test_utils.openControlBox();
                const message = 'This is a received message';
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, sender_jid)
                .then(() => {
                    const msg_id = u.getUniqueId();
                    _converse.chatboxes.onMessage($msg({
                            'from': sender_jid,
                            'to': _converse.connection.jid,
                            'type': 'chat',
                            'id': msg_id,
                        }).c('body').t('But soft, what light through yonder airlock breaks?').tree());

                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    expect(chatboxview.el.querySelectorAll('.chat-msg').length).toBe(1);
                    expect(chatboxview.el.querySelector('.chat-msg__text').textContent)
                        .toBe('But soft, what light through yonder airlock breaks?');

                    _converse.chatboxes.onMessage($msg({
                            'from': sender_jid,
                            'to': _converse.connection.jid,
                            'type': 'chat',
                            'id': u.getUniqueId(),
                        }).c('body').t('But soft, what light through yonder chimney breaks?').up()
                        .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());

                    test_utils.waitUntil(() => chatboxview.el.querySelector('.chat-msg__text').textContent ===
                        'But soft, what light through yonder chimney breaks?').then(() => {

                        expect(chatboxview.el.querySelectorAll('.chat-msg').length).toBe(1);
                        expect(chatboxview.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);

                        _converse.chatboxes.onMessage($msg({
                                'from': sender_jid,
                                'to': _converse.connection.jid,
                                'type': 'chat',
                                'id': u.getUniqueId(),
                            }).c('body').t('But soft, what light through yonder window breaks?').up()
                            .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());

                        return test_utils.waitUntil(() => chatboxview.el.querySelector('.chat-msg__text').textContent ===
                            'But soft, what light through yonder window breaks?');
                    }).then(() => {
                        expect(chatboxview.el.querySelectorAll('.chat-msg').length).toBe(1);
                        expect(chatboxview.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
                        chatboxview.el.querySelector('.chat-msg__content .fa-edit').click();
                        const modal = chatboxview.model.messages.at(0).message_versions_modal;
                        return test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
                    }).then(() => {
                        const modal = chatboxview.model.messages.at(0).message_versions_modal;
                        const older_msgs = modal.el.querySelectorAll('.older-msg');
                        expect(older_msgs.length).toBe(2);
                        expect(older_msgs[0].textContent).toBe('But soft, what light through yonder airlock breaks?');
                        expect(older_msgs[1].textContent).toBe('But soft, what light through yonder chimney breaks?');
                        done();
                    });
                });
            }));


            describe("when a chatbox is opened for someone who is not in the roster", function () {

                it("the VCard for that user is fetched and the chatbox updated with the results",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    _converse.allow_non_roster_messaging = true;
                    spyOn(_converse, 'emit').and.callThrough();

                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var vcard_fetched = false;
                    spyOn(_converse.api.vcard, "get").and.callFake(function () {
                        vcard_fetched = true;
                        return Promise.resolve({
                            'fullname': mock.cur_names[0],
                            'vcard_updated': moment().format(),
                            'jid': sender_jid
                        });
                    });
                    var message = 'This is a received message from someone not on the roster';
                    var msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                    // We don't already have an open chatbox for this user
                    expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();

                    _converse.chatboxes.onMessage(msg);
                    expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

                    // Check that the chatbox and its view now exist
                    var chatbox = _converse.chatboxes.get(sender_jid);
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    expect(chatbox).toBeDefined();
                    expect(chatboxview).toBeDefined();

                    var author_el = chatboxview.el.querySelector('.chat-msg__author');
                    expect(chatbox.get('fullname') === sender_jid);
                    expect( _.includes(author_el.textContent.trim(), 'max.frankfurter@localhost')).toBeTruthy();

                    test_utils.waitUntil(function () { return vcard_fetched; }, 100)
                    .then(function () {
                        expect(_converse.api.vcard.get).toHaveBeenCalled();
                        return test_utils.waitUntil(() => chatbox.vcard.get('fullname') === mock.cur_names[0])
                    }).then(function () {
                        var author_el = chatboxview.el.querySelector('.chat-msg__author');
                        expect( _.includes(author_el.textContent.trim(), 'Max Frankfurter')).toBeTruthy();
                        done();
                    });
                }));
            });


            describe("who is not on the roster", function () {

                it("will open a chatbox and be displayed inside it if allow_non_roster_messaging is true",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched'], {},
                        function (done, _converse) {

                    _converse.allow_non_roster_messaging = false;

                    spyOn(_converse, 'emit');
                    var message = 'This is a received message from someone not on the roster';
                    var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                    // We don't already have an open chatbox for this user
                    expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();

                    var chatbox = _converse.chatboxes.get(sender_jid);
                    expect(chatbox).not.toBeDefined();

                    // onMessage is a handler for received XMPP messages
                    _converse.chatboxes.onMessage(msg);
                    expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

                    // onMessage is a handler for received XMPP messages
                    _converse.allow_non_roster_messaging =true;
                    _converse.chatboxes.onMessage(msg);
                    expect(_converse.emit).toHaveBeenCalledWith('message', jasmine.any(Object));

                    // Check that the chatbox and its view now exist
                    chatbox = _converse.chatboxes.get(sender_jid);
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    expect(chatbox).toBeDefined();
                    expect(chatboxview).toBeDefined();
                    // Check that the message was received and check the message parameters
                    expect(chatbox.messages.length).toEqual(1);
                    var msg_obj = chatbox.messages.models[0];
                    expect(msg_obj.get('message')).toEqual(message);
                    expect(msg_obj.get('fullname')).toEqual(undefined);
                    expect(msg_obj.get('sender')).toEqual('them');
                    expect(msg_obj.get('is_delayed')).toEqual(false);
                    // Now check that the message appears inside the chatbox in the DOM
                    var chat_content = chatboxview.el.querySelector('.chat-content');
                    expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(message);
                    expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                    expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('max.frankfurter@localhost');
                    done();
                }));
            });


            describe("and for which then an error message is received from the server", function () {

                it("will have the error message displayed after itself",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

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
                    var sender_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@localhost';
                    var fullname = _converse.xmppstatus.get('fullname');
                    fullname = _.isEmpty(fullname)? _converse.bare_jid: fullname;
                    _converse.api.chats.open(sender_jid)
                    .then(() => {
                        var msg_text = 'This message will not be sent, due to an error';
                        var view = _converse.chatboxviews.get(sender_jid);
                        var message = view.model.messages.create({
                            'msgid': '82bc02ce-9651-4336-baf0-fa04762ed8d2',
                            'fullname': fullname,
                            'sender': 'me',
                            'time': moment().format(),
                            'message': msg_text
                        });
                        view.model.sendMessage(message);
                        var $chat_content = $(view.el).find('.chat-content');
                        var msg_txt = $chat_content.find('.chat-msg:last').find('.chat-msg__text').text();
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
                        msg_txt = $chat_content.find('.chat-msg:last').find('.chat-msg__text').text();
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
                        var error_txt = 'Server-to-server connection failed: Connecting failed: connection timeout';
                        var stanza = $msg({
                                'to': _converse.connection.jid,
                                'type':'error',
                                'id':'82bc02ce-9651-4336-baf0-fa04762ed8d2',
                                'from': sender_jid
                            })
                            .c('error', {'type': 'cancel'})
                            .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                            .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                                .t('Server-to-server connection failed: Connecting failed: connection timeout');
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));
                        expect($chat_content.find('.chat-error').text()).toEqual(error_txt);

                        stanza = $msg({
                                'to': _converse.connection.jid,
                                'type':'error',
                                'id':'some-other-unused-id',
                                'from': sender_jid
                            })
                            .c('error', {'type': 'cancel'})
                            .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                            .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                                .t('Server-to-server connection failed: Connecting failed: connection timeout');
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));
                        expect($chat_content.find('.chat-error').length).toEqual(2);

                        // If the last message is already an error message,
                        // then we don't render it another time.
                        stanza = $msg({
                                'to': _converse.connection.jid,
                                'type':'error',
                                'id':'another-unused-id',
                                'from': sender_jid
                            })
                            .c('error', {'type': 'cancel'})
                            .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                            .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                                .t('Server-to-server connection failed: Connecting failed: connection timeout');
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));
                        expect($chat_content.find('.chat-error').length).toEqual(2);

                        // A different error message will however render
                        stanza = $msg({
                                'to': _converse.connection.jid,
                                'type':'error',
                                'id':'another-id',
                                'from': sender_jid
                            })
                            .c('error', {'type': 'cancel'})
                            .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                            .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                                .t('Something else went wrong as well');
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));
                        expect($chat_content.find('.chat-error').length).toEqual(3);
                        done();
                    });
                }));
            });


            it("will cause the chat area to be scrolled down only if it was at the bottom originally",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                _converse.emit('rosterContactsFetched');
                test_utils.openControlBox();

                let chatboxview;
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                const message = 'This message is received while the chat area is scrolled up';
                test_utils.openChatBoxFor(_converse, sender_jid)
                .then(() => {
                    chatboxview = _converse.chatboxviews.get(sender_jid);
                    spyOn(chatboxview, 'onScrolledDown').and.callThrough();

                    // Create enough messages so that there's a scrollbar.
                    for (var i=0; i<20; i++) {
                        _converse.chatboxes.onMessage($msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: (new Date()).getTime()
                            }).c('body').t('Message: '+i).up()
                            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                    }
                    return test_utils.waitUntil(() => chatboxview.content.scrollTop, 1000)
                .then(() => test_utils.waitUntil(() => !chatboxview.model.get('auto_scrolled'), 500))
                }).then(() => {
                    chatboxview.content.scrollTop = 0;
                    return test_utils.waitUntil(() => chatboxview.model.get('scrolled'), 900);
                }).then(() => {
                    _converse.chatboxes.onMessage($msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());

                    // Now check that the message appears inside the chatbox in the DOM
                    const $chat_content = $(chatboxview.el).find('.chat-content');
                    const  msg_txt = $chat_content.find('.chat-msg:last').find('.chat-msg__text').text();
                    expect(msg_txt).toEqual(message);
                    return test_utils.waitUntil(() => u.isVisible(chatboxview.el.querySelector('.new-msgs-indicator')), 900);
                }).then(() => {
                    expect(chatboxview.model.get('scrolled')).toBe(true);
                    expect(chatboxview.content.scrollTop).toBe(0);
                    expect(u.isVisible(chatboxview.el.querySelector('.new-msgs-indicator'))).toBeTruthy();
                    // Scroll down again
                    chatboxview.content.scrollTop = chatboxview.content.scrollHeight;
                    return test_utils.waitUntil(() => !u.isVisible(chatboxview.el.querySelector('.new-msgs-indicator')), 900);
                }).then(done);
            }));

            it("is ignored if it's intended for a different resource and filter_by_resource is set to true",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                test_utils.openControlBox();

                test_utils.waitUntil(function () {
                        return $(_converse.rosterview.el).find('.roster-group').length;
                    }, 300)
                .then(function () {
                    // Send a message from a different resource
                    var message, sender_jid, msg;
                    spyOn(_converse, 'log');
                    spyOn(_converse.chatboxes, 'getChatBox').and.callThrough();
                    _converse.filter_by_resource = true;
                    sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                    msg = $msg({
                            from: sender_jid,
                            to: _converse.bare_jid+"/some-other-resource",
                            type: 'chat',
                            id: (new Date()).getTime()
                        }).c('body').t("This message will not be shown").up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                    _converse.chatboxes.onMessage(msg);

                    expect(_converse.log).toHaveBeenCalledWith(
                            "onMessage: Ignoring incoming message intended for a different resource: dummy@localhost/some-other-resource",
                            Strophe.LogLevel.INFO);
                    expect(_converse.chatboxes.getChatBox).not.toHaveBeenCalled();
                    _converse.filter_by_resource = false;

                    message = "This message sent to a different resource will be shown";
                    msg = $msg({
                            from: sender_jid,
                            to: _converse.bare_jid+"/some-other-resource",
                            type: 'chat',
                            id: '134234623462346'
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                    _converse.chatboxes.onMessage(msg);

                    expect(_converse.chatboxes.getChatBox).toHaveBeenCalled();
                    var chatboxview = _converse.chatboxviews.get(sender_jid);
                    var $chat_content = $(chatboxview.el).find('.chat-content:last');
                    var msg_txt = $chat_content.find('.chat-msg').find('.chat-msg__text').text();
                    expect(msg_txt).toEqual(message);
                    done();
                });
            }));
        });


        describe("which contains an OOB URL", function () {

            it("will render audio from oob mp3 URLs",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                test_utils.createContacts(_converse, 'current', 1);
                _converse.emit('rosterContactsFetched');
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                let view;
                test_utils.openChatBoxFor(_converse, contact_jid)
                .then(() => {
                    view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();

                    const stanza = Strophe.xmlHtmlNode(
                        "<message from='"+contact_jid+"'"+
                        "         type='chat'"+
                        "         to='dummy@localhost/resource'>"+
                        "    <body>Have you heard this funny audio?</body>"+
                        "    <x xmlns='jabber:x:oob'><url>http://localhost/audio.mp3</url></x>"+
                        "</message>").firstChild
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    return test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg audio').length, 1000);
                }).then(() => {
                    let msg = view.el.querySelector('.chat-msg .chat-msg__text');
                    expect(msg.outerHTML).toEqual('<div class="chat-msg__text">Have you heard this funny audio?</div>');
                    let media = view.el.querySelector('.chat-msg .chat-msg__media');
                    expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                        '<!-- src/templates/audio.html -->'+
                        '<audio controls=""><source src="http://localhost/audio.mp3" type="audio/mpeg"></audio>'+
                        '<a target="_blank" rel="noopener" href="http://localhost/audio.mp3">Download audio file</a>');

                    // If the <url> and <body> contents is the same, don't duplicate.
                    const stanza = Strophe.xmlHtmlNode(
                        "<message from='"+contact_jid+"'"+
                        "         type='chat'"+
                        "         to='dummy@localhost/resource'>"+
                        "    <body>http://localhost/audio.mp3</body>"+
                        "    <x xmlns='jabber:x:oob'><url>http://localhost/audio.mp3</url></x>"+
                        "</message>").firstChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    msg = view.el.querySelector('.chat-msg:last-child .chat-msg__text');
                    expect(msg.innerHTML).toEqual('<!-- message gets added here via renderMessage -->'); // Emtpy
                    media = view.el.querySelector('.chat-msg:last-child .chat-msg__media');
                    expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                        '<!-- src/templates/audio.html -->'+
                        '<audio controls=""><source src="http://localhost/audio.mp3" type="audio/mpeg"></audio>'+
                        '<a target="_blank" rel="noopener" href="http://localhost/audio.mp3">Download audio file</a>');
                    done();
                });
            }));

            it("will render video from oob mp4 URLs",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                _converse.emit('rosterContactsFetched');
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                test_utils.openChatBoxFor(_converse, contact_jid)
                .then(() => {
                    const view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();

                    const stanza = Strophe.xmlHtmlNode(
                        "<message from='"+contact_jid+"'"+
                        "         type='chat'"+
                        "         to='dummy@localhost/resource'>"+
                        "    <body>Have you seen this funny video?</body>"+
                        "    <x xmlns='jabber:x:oob'><url>http://localhost/video.mp4</url></x>"+
                        "</message>").firstChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg video').length, 2000).then(function () {
                        let msg = view.el.querySelector('.chat-msg .chat-msg__text');
                        expect(msg.outerHTML).toEqual('<div class="chat-msg__text">Have you seen this funny video?</div>');
                        let media = view.el.querySelector('.chat-msg .chat-msg__media');
                        expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                            '<!-- src/templates/video.html -->'+
                            '<video controls=""><source src="http://localhost/video.mp4" type="video/mp4"></video>'+
                            '<a target="_blank" rel="noopener" href="http://localhost/video.mp4">Download video file</a>');

                        // If the <url> and <body> contents is the same, don't duplicate.
                        const stanza = Strophe.xmlHtmlNode(
                            "<message from='"+contact_jid+"'"+
                            "         type='chat'"+
                            "         to='dummy@localhost/resource'>"+
                            "    <body>http://localhost/video.mp4</body>"+
                            "    <x xmlns='jabber:x:oob'><url>http://localhost/video.mp4</url></x>"+
                            "</message>").firstChild;
                        _converse.connection._dataRecv(test_utils.createRequest(stanza));

                        msg = view.el.querySelector('.chat-msg:last-child .chat-msg__text');
                        expect(msg.innerHTML).toEqual('<!-- message gets added here via renderMessage -->'); // Emtpy
                        media = view.el.querySelector('.chat-msg:last-child .chat-msg__media');
                        expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                            '<!-- src/templates/video.html -->'+
                            '<video controls=""><source src="http://localhost/video.mp4" type="video/mp4"></video>'+
                            '<a target="_blank" rel="noopener" href="http://localhost/video.mp4">Download video file</a>');
                        done();
                    });
                });
            }));

            it("will render download links for files from oob URLs",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    function (done, _converse) {

                test_utils.createContacts(_converse, 'current', 1);
                _converse.emit('rosterContactsFetched');
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                let view;
                test_utils.openChatBoxFor(_converse, contact_jid)
                .then(() => {
                    view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();

                    const stanza = Strophe.xmlHtmlNode(
                        "<message from='"+contact_jid+"'"+
                        "         type='chat'"+
                        "         to='dummy@localhost/resource'>"+
                        "    <body>Have you downloaded this funny file?</body>"+
                        "    <x xmlns='jabber:x:oob'><url>http://localhost/funny.pdf</url></x>"+
                        "</message>").firstChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg a').length, 1000);
                }).then(function () {
                    const msg = view.el.querySelector('.chat-msg .chat-msg__text');
                    expect(msg.outerHTML).toEqual('<div class="chat-msg__text">Have you downloaded this funny file?</div>');
                    const media = view.el.querySelector('.chat-msg .chat-msg__media');
                    expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                        '<!-- src/templates/file.html -->'+
                        '<a target="_blank" rel="noopener" href="http://localhost/funny.pdf">Download "funny.pdf"</a>');
                    done();
                });
            }));

            it("will render images from oob URLs",
                    mock.initConverseWithPromises(
                        null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        function (done, _converse) {

                test_utils.createContacts(_converse, 'current');
                _converse.emit('rosterContactsFetched');
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
                let view;
                test_utils.openChatBoxFor(_converse, contact_jid)
                .then(() => {
                    view = _converse.chatboxviews.get(contact_jid);
                    spyOn(view.model, 'sendMessage').and.callThrough();
                    const base_url = document.URL.split(window.location.pathname)[0];
                    const url = base_url+"/logo/conversejs-filled.svg";

                    const stanza = Strophe.xmlHtmlNode(
                        "<message from='"+contact_jid+"'"+
                        "         type='chat'"+
                        "         to='dummy@localhost/resource'>"+
                        "    <body>Have you seen this funny image?</body>"+
                        "    <x xmlns='jabber:x:oob'><url>"+url+"</url></x>"+
                        "</message>").firstChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    return test_utils.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg img').length, 2000);
                }).then(function () {
                    const msg = view.el.querySelector('.chat-msg .chat-msg__text');
                    expect(msg.outerHTML).toEqual('<div class="chat-msg__text">Have you seen this funny image?</div>');
                    const media = view.el.querySelector('.chat-msg .chat-msg__media');
                    expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                        `<!-- src/templates/image.html -->`+
                        `<a href="${window.location.origin}/logo/conversejs-filled.svg" target="_blank" rel="noopener">`+
                            `<img class="chat-image img-thumbnail" src="${window.location.origin}/logo/conversejs-filled.svg">`+
                        `</a>`);
                    done();
                }).catch(_.partial(console.error, _));
            }));
        });
    });


    describe("A Groupchat Message", function () {

        it("is specially marked when you are mentioned in it",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                const view = _converse.chatboxviews.get('lounge@localhost');
                if (!$(view.el).find('.chat-area').length) { view.renderChatArea(); }
                const message = 'dummy: Your attention is required';
                const nick = mock.chatroom_names[0],
                    msg = $msg({
                        from: 'lounge@localhost/'+nick,
                        id: (new Date()).getTime(),
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t(message).tree();
                view.model.onMessage(msg);
                expect($(view.el).find('.chat-msg').hasClass('mentioned')).toBeTruthy();
                done();
            }).catch(_.partial(console.error, _));
        }));


        it("keeps track whether you are the sender or not",
                mock.initConverseWithPromises(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy').then(function () {
                const view = _converse.chatboxviews.get('lounge@localhost');
                const msg = $msg({
                        from: 'lounge@localhost/dummy',
                        id: (new Date()).getTime(),
                        to: 'dummy@localhost',
                        type: 'groupchat'
                    }).c('body').t('I wrote this message!').tree();
                view.model.onMessage(msg);
                expect(view.model.messages.last().get('sender')).toBe('me');
                done();
            });
        }));

        it("can be replaced with a correction",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            let msg_id, view;
            test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy')
            .then(() => {
                const jid = 'lounge@localhost';
                const room = _converse.api.rooms.get(jid);
                view = _converse.chatboxviews.get(jid);

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

                msg_id = u.getUniqueId();
                view.model.onMessage($msg({
                        'from': 'lounge@localhost/newguy',
                        'to': _converse.connection.jid,
                        'type': 'groupchat',
                        'id': msg_id,
                    }).c('body').t('But soft, what light through yonder airlock breaks?').tree());

                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(view.el.querySelector('.chat-msg__text').textContent)
                    .toBe('But soft, what light through yonder airlock breaks?');

                view.model.onMessage($msg({
                        'from': 'lounge@localhost/newguy',
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': u.getUniqueId(),
                    }).c('body').t('But soft, what light through yonder chimney breaks?').up()
                        .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());

                return test_utils.waitUntil(() => view.el.querySelector('.chat-msg__text').textContent ===
                    'But soft, what light through yonder chimney breaks?');
            }).then(() => {
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(view.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);

                view.model.onMessage($msg({
                        'from': 'lounge@localhost/newguy',
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': u.getUniqueId(),
                    }).c('body').t('But soft, what light through yonder window breaks?').up()
                        .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());

            return test_utils.waitUntil(() => view.el.querySelector('.chat-msg__text').textContent ===
                'But soft, what light through yonder window breaks?');
            }).then(() => {
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(view.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
                view.el.querySelector('.chat-msg__content .fa-edit').click();
                const modal = view.model.messages.at(0).message_versions_modal;
                return test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
            }).then(() => {
                const modal = view.model.messages.at(0).message_versions_modal;
                const older_msgs = modal.el.querySelectorAll('.older-msg');
                expect(older_msgs.length).toBe(2);
                expect(older_msgs[0].textContent).toBe('But soft, what light through yonder airlock breaks?');
                expect(older_msgs[1].textContent).toBe('But soft, what light through yonder chimney breaks?');
                done();
            }).catch(_.partial(console.error, _));
        }));

        it("can be sent as a correction by using the up arrow",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            let msg_id, view;
            test_utils.openAndEnterChatRoom(_converse, 'lounge', 'localhost', 'dummy')
            .then(() => {
                const room_jid = 'lounge@localhost';
                const room = _converse.api.rooms.get(room_jid);
                view = _converse.chatboxviews.get(room_jid);

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
                expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(true);

                spyOn(_converse.connection, 'send');
                textarea.value = 'But soft, what light through yonder window breaks?';
                view.keyPressed({
                    target: textarea,
                    preventDefault: _.noop,
                    keyCode: 13 // Enter
                });
                expect(_converse.connection.send).toHaveBeenCalled();

                const msg = _converse.connection.send.calls.all()[0].args[0];
                expect(msg.toLocaleString())
                .toBe(`<message from='dummy@localhost/resource' `+
                        `to='lounge@localhost' type='groupchat' id='${msg.nodeTree.getAttribute('id')}' `+
                        `xmlns='jabber:client'>`+
                            `<body>But soft, what light through yonder window breaks?</body>`+
                            `<active xmlns='http://jabber.org/protocol/chatstates'/>`+
                            `<replace xmlns='urn:xmpp:message-correct:0' id='${first_msg.get('msgid')}'/>`+
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
                view.model.onMessage($msg({
                    'from': room_jid+'/someone-else',
                    'id': (new Date()).getTime(),
                    'to': 'dummy@localhost',
                    'type': 'groupchat'
                }).c('body').t('Hello world').tree());
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
                expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(true);
                expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
                view.keyPressed({
                    target: textarea,
                    keyCode: 40 // Down arrow
                });
                expect(textarea.value).toBe('');
                expect(view.model.messages.at(0).get('correcting')).toBe(false);
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);
                expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(false);
                done();
            }).catch(_.partial(console.error, _));
        }));
    });
}));
