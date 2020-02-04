(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const { Promise, Strophe, $msg, dayjs, sizzle, _ } = converse.env;
    const u = converse.env.utils;


    describe("A Chat Message", function () {

        it("is rejected if it's an unencapsulated forwarded message",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current', 2);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const forwarded_contact_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            let models = await _converse.api.chats.get();
            expect(models.length).toBe(1);
            const received_stanza = u.toStanza(`
                <message to='${_converse.jid}' from='${contact_jid}' type='chat' id='${_converse.connection.getUniqueId()}'>
                    <body>A most courteous exposition!</body>
                    <forwarded xmlns='urn:xmpp:forward:0'>
                        <delay xmlns='urn:xmpp:delay' stamp='2019-07-10T23:08:25Z'/>
                        <message from='${forwarded_contact_jid}'
                                id='0202197'
                                to='${_converse.bare_jid}'
                                type='chat'
                                xmlns='jabber:client'>
                        <body>Yet I should kill thee with much cherishing.</body>
                        <mood xmlns='http://jabber.org/protocol/mood'>
                            <amorous/>
                        </mood>
                        </message>
                    </forwarded>
                </message>
            `);
            _converse.connection._dataRecv(test_utils.createRequest(received_stanza));
            const sent_stanzas = _converse.connection.sent_stanzas;
            const sent_stanza = await u.waitUntil(() => sent_stanzas.filter(s => s.querySelector('error')).pop());
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<message id="${received_stanza.getAttribute('id')}" to="${contact_jid}" type="error" xmlns="jabber:client">`+
                    '<error type="cancel">'+
                        '<not-allowed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>'+
                        '<text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">'+
                            'Forwarded messages not part of an encapsulating protocol are not supported</text>'+
                    '</error>'+
                '</message>');
            models = await _converse.api.chats.get();
            expect(models.length).toBe(1);
            done();
        }));

        it("can be sent as a correction by clicking the pencil icon",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current', 1);
            await test_utils.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const view = _converse.api.chatviews.get(contact_jid);
            const textarea = view.el.querySelector('textarea.chat-textarea');

            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder airlock breaks?');
            expect(textarea.value).toBe('');

            const first_msg = view.model.messages.findWhere({'message': 'But soft, what light through yonder airlock breaks?'});
            expect(view.el.querySelectorAll('.chat-msg .chat-msg__action').length).toBe(2);
            let action = view.el.querySelector('.chat-msg .chat-msg__action');
            expect(action.getAttribute('title')).toBe('Edit this message');

            action.style.opacity = 1;
            action.click();

            expect(textarea.value).toBe('But soft, what light through yonder airlock breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')));

            spyOn(_converse.connection, 'send');
            textarea.value = 'But soft, what light through yonder window breaks?';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            expect(_converse.connection.send).toHaveBeenCalled();
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            const msg = _converse.connection.send.calls.all()[0].args[0];
            expect(msg.toLocaleString())
            .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.nodeTree.getAttribute("id")}" `+
                    `to="mercutio@montague.lit" type="chat" `+
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

            const older_versions = corrected_message.get('older_versions');
            const keys = Object.keys(older_versions);
            expect(keys.length).toBe(1);
            expect(older_versions[keys[0]]).toBe('But soft, what light through yonder airlock breaks?');

            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(false);

            // Test that clicking the pencil icon a second time cancels editing.
            action = view.el.querySelector('.chat-msg .chat-msg__action');
            action.style.opacity = 1;
            action.click();
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await u.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')) === true);

            action = view.el.querySelector('.chat-msg .chat-msg__action');
            action.style.opacity = 1;
            action.click();
            expect(textarea.value).toBe('');
            expect(view.model.messages.at(0).get('correcting')).toBe(false);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await u.waitUntil(() => (u.hasClass('correcting', view.el.querySelector('.chat-msg')) === false), 500);

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
            expect(view.el.querySelectorAll('.chat-msg .chat-msg__action').length).toBe(2);

            // Test confirmation dialog
            spyOn(window, 'confirm').and.returnValue(true);
            textarea.value = 'But soft, what light through yonder airlock breaks?';
            action = view.el.querySelector('.chat-msg .chat-msg__action');
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
            done();
        }));


        it("can be sent as a correction by using the up arrow",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current', 1);
            await test_utils.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.api.chatviews.get(contact_jid);
            const textarea = view.el.querySelector('textarea.chat-textarea');
            expect(textarea.value).toBe('');
            view.onKeyDown({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('');

            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder airlock breaks?');

            const first_msg = view.model.messages.findWhere({'message': 'But soft, what light through yonder airlock breaks?'});
            expect(textarea.value).toBe('');
            view.onKeyDown({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('But soft, what light through yonder airlock breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await u.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')), 500);

            spyOn(_converse.connection, 'send');
            textarea.value = 'But soft, what light through yonder window breaks?';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            expect(_converse.connection.send).toHaveBeenCalled();
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            const msg = _converse.connection.send.calls.all()[0].args[0];
            expect(msg.toLocaleString())
            .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.nodeTree.getAttribute("id")}" `+
                    `to="mercutio@montague.lit" type="chat" `+
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

            const older_versions = corrected_message.get('older_versions');
            const keys = Object.keys(older_versions);
            expect(keys.length).toBe(1);
            expect(older_versions[keys[0]]).toBe('But soft, what light through yonder airlock breaks?');

            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await u.waitUntil(() => (u.hasClass('correcting', view.el.querySelector('.chat-msg')) === false), 500);

            // Test that pressing the down arrow cancels message correction
            expect(textarea.value).toBe('');
            view.onKeyDown({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await u.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')), 500);
            expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
            view.onKeyDown({
                target: textarea,
                keyCode: 40 // Down arrow
            });
            expect(textarea.value).toBe('');
            expect(view.model.messages.at(0).get('correcting')).toBe(false);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            await u.waitUntil(() => (u.hasClass('correcting', view.el.querySelector('.chat-msg')) === false), 500);

            textarea.value = 'It is the east, and Juliet is the one.';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);

            textarea.value =  'Arise, fair sun, and kill the envious moon';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(3);

            view.onKeyDown({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('Arise, fair sun, and kill the envious moon');
            expect(view.model.messages.at(0).get('correcting')).toBeFalsy();
            expect(view.model.messages.at(1).get('correcting')).toBeFalsy();
            expect(view.model.messages.at(2).get('correcting')).toBe(true);
            await u.waitUntil(() => u.hasClass('correcting', sizzle('.chat-msg:last', view.el).pop()), 500);

            textarea.selectionEnd = 0; // Happens by pressing up,
                                    // but for some reason not in tests, so we set it manually.
            view.onKeyDown({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('It is the east, and Juliet is the one.');
            expect(view.model.messages.at(0).get('correcting')).toBeFalsy();
            expect(view.model.messages.at(1).get('correcting')).toBe(true);
            expect(view.model.messages.at(2).get('correcting')).toBeFalsy();
            await u.waitUntil(() => u.hasClass('correcting', sizzle('.chat-msg', view.el)[1]), 500);

            textarea.value = 'It is the east, and Juliet is the sun.';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

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
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);

            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length)
            _converse.filter_by_resource = true;

            let msg = $msg({
                    'xmlns': 'jabber:client',
                    'id': _converse.connection.getUniqueId(),
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'})
                .c('body').t("message").up()
                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-02T13:08:25Z'})
                .tree();
            await _converse.handleMessageStanza(msg);
            const view = _converse.api.chatviews.get(sender_jid);

            msg = $msg({
                    'xmlns': 'jabber:client',
                    'id': _converse.connection.getUniqueId(),
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'})
                .c('body').t("Older message").up()
                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2017-12-31T22:08:25Z'})
                .tree();
            await _converse.handleMessageStanza(msg);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            msg = $msg({
                    'xmlns': 'jabber:client',
                    'id': _converse.connection.getUniqueId(),
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'})
                .c('body').t("Inbetween message").up()
                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-01T13:18:23Z'})
                .tree();
            await _converse.handleMessageStanza(msg);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            msg = $msg({
                    'xmlns': 'jabber:client',
                    'id': _converse.connection.getUniqueId(),
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'})
                .c('body').t("another inbetween message").up()
                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-01T13:18:23Z'})
                .tree();
            await _converse.handleMessageStanza(msg);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            msg = $msg({
                    'xmlns': 'jabber:client',
                    'id': _converse.connection.getUniqueId(),
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'})
                .c('body').t("An earlier message on the next day").up()
                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-02T12:18:23Z'})
                .tree();
            await _converse.handleMessageStanza(msg);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            msg = $msg({
                    'xmlns': 'jabber:client',
                    'id': _converse.connection.getUniqueId(),
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'})
                .c('body').t("newer message from the next day").up()
                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':'2018-01-02T22:28:23Z'})
                .tree();
            await _converse.handleMessageStanza(msg);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            // Insert <composing> message, to also check that
            // text messages are inserted correctly with
            // temporary chat events in the chat contents.
            msg = $msg({
                    'id': _converse.connection.getUniqueId(),
                    'to': _converse.bare_jid,
                    'xmlns': 'jabber:client',
                    'from': sender_jid,
                    'type': 'chat'})
                .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                .tree();
            await _converse.handleMessageStanza(msg);

            msg = $msg({
                    'id': _converse.connection.getUniqueId(),
                    'to': _converse.bare_jid,
                    'xmlns': 'jabber:client',
                    'from': sender_jid,
                    'type': 'chat'})
                .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                .c('body').t("latest message")
                .tree();
            await _converse.handleMessageStanza(msg);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            const chat_content = view.el.querySelector('.chat-content');
            view.clearSpinner(); //cleanup
            expect(chat_content.querySelectorAll('.date-separator').length).toEqual(4);

            let day = sizzle('.date-separator:first', chat_content).pop();
            expect(day.getAttribute('data-isodate')).toEqual(dayjs('2017-12-31T00:00:00').toISOString());

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
            expect(day.getAttribute('data-isodate')).toEqual(dayjs('2018-01-01T00:00:00').toISOString());
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
            expect(day.getAttribute('data-isodate')).toEqual(dayjs('2018-01-02T00:00:00').toISOString());
            expect(day.nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('An earlier message on the next day');

            el = sizzle('.chat-msg:eq(3)', chat_content).pop();
            expect(el.querySelector('.chat-msg__text').textContent).toEqual('An earlier message on the next day');
            expect(u.hasClass('chat-msg--followup', el)).toBe(false);

            el = sizzle('.chat-msg:eq(4)', chat_content).pop();
            expect(el.querySelector('.chat-msg__text').textContent).toEqual('message');
            expect(el.nextElementSibling.querySelector('.chat-msg__text').textContent).toEqual('newer message from the next day');
            expect(u.hasClass('chat-msg--followup', el)).toBe(false);

            day = sizzle('.date-separator:last', chat_content).pop();
            expect(day.getAttribute('data-isodate')).toEqual(dayjs().startOf('day').toISOString());
            expect(day.nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('latest message');
            expect(u.hasClass('chat-msg--followup', el)).toBe(false);
            done();
        }));

        it("is ignored if it's a malformed headline message",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);

            // Ideally we wouldn't have to filter out headline
            // messages, but Prosody gives them the wrong 'type' :(
            sinon.spy(converse.env.log, 'info');
            sinon.spy(_converse.api.chatboxes, 'get');
            sinon.spy(u, 'isHeadlineMessage');
            const msg = $msg({
                    from: 'montague.lit',
                    to: _converse.bare_jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t("This headline message will not be shown").tree();
            await _converse.handleMessageStanza(msg);
            expect(converse.env.log.info.calledWith(
                "onMessage: Ignoring incoming headline message from JID: montague.lit"
            )).toBeTruthy();
            expect(u.isHeadlineMessage.called).toBeTruthy();
            expect(u.isHeadlineMessage.returned(true)).toBeTruthy();
            expect(_converse.api.chatboxes.get.called).toBeFalsy();
            // Remove sinon spies
            converse.env.log.info.restore();
            _converse.api.chatboxes.get.restore();
            u.isHeadlineMessage.restore();
            done();
        }));


        it("can be a carbon message, as defined in XEP-0280",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const include_nick = false;
            await test_utils.waitForRoster(_converse, 'current', 2, include_nick);
            await test_utils.openControlBox(_converse);

            // Send a message from a different resource
            const msgtext = 'This is a carbon message';
            const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const msg = $msg({
                    'from': _converse.bare_jid,
                    'id': u.getUniqueId(),
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

            await _converse.handleMessageStanza(msg);
            const chatbox = _converse.chatboxes.get(sender_jid);
            const view = _converse.chatboxviews.get(sender_jid);

            expect(chatbox).toBeDefined();
            expect(view).toBeDefined();
            // Check that the message was received and check the message parameters
            expect(chatbox.messages.length).toEqual(1);
            const msg_obj = chatbox.messages.models[0];
            expect(msg_obj.get('message')).toEqual(msgtext);
            expect(msg_obj.get('fullname')).toBeUndefined();
            expect(msg_obj.get('nickname')).toBe(null);
            expect(msg_obj.get('sender')).toEqual('them');
            expect(msg_obj.get('is_delayed')).toEqual(false);
            // Now check that the message appears inside the chatbox in the DOM
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            const chat_content = view.el.querySelector('.chat-content');
            expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(msgtext);
            expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
            await u.waitUntil(() => chatbox.vcard.get('fullname') === 'Juliet Capulet')
            expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Juliet Capulet');
            done();
        }));

        it("can be a carbon message that this user sent from a different client, as defined in XEP-0280",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);

            // Send a message from a different resource
            const msgtext = 'This is a sent carbon message';
            const recipient_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const msg = $msg({
                    'from': _converse.bare_jid,
                    'id': u.getUniqueId(),
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

            await _converse.handleMessageStanza(msg);
            // Check that the chatbox and its view now exist
            const chatbox = await _converse.api.chats.get(recipient_jid);
            const view = _converse.api.chatviews.get(recipient_jid);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(chatbox).toBeDefined();
            expect(view).toBeDefined();

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
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);
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
            const msgtext = 'Please come to Creepy Valley tonight, alone!';
            const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const impersonated_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const msg = $msg({
                    'from': sender_jid,
                    'id': u.getUniqueId(),
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
            await _converse.handleMessageStanza(msg);

            // Check that chatbox for impersonated user is not created.
            let chatbox = await _converse.api.chats.get(impersonated_jid);
            expect(chatbox).toBe(null);

            // Check that the chatbox for the malicous user is not created
            chatbox = await _converse.api.chats.get(sender_jid);
            expect(chatbox).toBe(null);
            done();
        }));

        it("received for a minimized chat box will increment a counter on its header",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            if (_converse.view_mode === 'fullscreen') {
                return done();
            }
            await test_utils.waitForRoster(_converse, 'current');
            const contact_name = mock.cur_names[0];
            const contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openControlBox(_converse);
            spyOn(_converse.api, "trigger").and.callThrough();

            await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const chatview = _converse.api.chatviews.get(contact_jid);
            expect(u.isVisible(chatview.el)).toBeTruthy();
            expect(chatview.model.get('minimized')).toBeFalsy();
            chatview.el.querySelector('.toggle-chatbox-button').click();
            expect(chatview.model.get('minimized')).toBeTruthy();
            var message = 'This message is sent to a minimized chatbox';
            var sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            var msg = $msg({
                from: sender_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: u.getUniqueId()
            }).c('body').t(message).up()
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            await _converse.handleMessageStanza(msg);

            await u.waitUntil(() => chatview.model.messages.length);
            expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
            const trimmed_chatboxes = _converse.minimized_chats;
            const trimmedview = trimmed_chatboxes.get(contact_jid);
            let count = trimmedview.el.querySelector('.message-count');
            expect(u.isVisible(chatview.el)).toBeFalsy();
            expect(trimmedview.model.get('minimized')).toBeTruthy();
            expect(u.isVisible(count)).toBeTruthy();
            expect(count.textContent).toBe('1');
            _converse.handleMessageStanza(
                $msg({
                    from: mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                    to: _converse.connection.jid,
                    type: 'chat',
                    id: u.getUniqueId()
                }).c('body').t('This message is also sent to a minimized chatbox').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
            );

            await u.waitUntil(() => (chatview.model.messages.length > 1));
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
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const include_nick = false;
            await test_utils.waitForRoster(_converse, 'current', 2, include_nick);
            await test_utils.openControlBox(_converse);
            spyOn(_converse.api, "trigger").and.callThrough();
            const contact_name = mock.cur_names[1];
            const contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@montague.lit';

            await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
            await test_utils.openChatBoxFor(_converse, contact_jid);
            await test_utils.clearChatBoxMessages(_converse, contact_jid);
            const one_day_ago = dayjs().subtract(1, 'day');
            const chatbox = _converse.chatboxes.get(contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);

            let message = 'This is a day old message';
            let msg = $msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: one_day_ago.toDate().getTime()
            }).c('body').t(message).up()
            .c('delay', { xmlns:'urn:xmpp:delay', from: 'montague.lit', stamp: one_day_ago.toISOString() })
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            await _converse.handleMessageStanza(msg);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
            expect(chatbox.messages.length).toEqual(1);
            let msg_obj = chatbox.messages.models[0];
            expect(msg_obj.get('message')).toEqual(message);
            expect(msg_obj.get('fullname')).toBeUndefined();
            expect(msg_obj.get('nickname')).toBe(null);
            expect(msg_obj.get('sender')).toEqual('them');
            expect(msg_obj.get('is_delayed')).toEqual(true);
            await u.waitUntil(() => chatbox.vcard.get('fullname') === 'Juliet Capulet')
            const chat_content = view.el.querySelector('.chat-content');
            expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(message);
            expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
            expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Juliet Capulet');

            expect(chat_content.querySelectorAll('.date-separator').length).toEqual(1);
            let day = chat_content.querySelector('.date-separator');
            expect(day.getAttribute('class')).toEqual('message date-separator');
            expect(day.getAttribute('data-isodate')).toEqual(dayjs(one_day_ago.startOf('day')).toISOString());

            let time = chat_content.querySelector('time.separator-text');
            expect(time.textContent).toEqual(dayjs(one_day_ago.startOf('day')).format("dddd MMM Do YYYY"));

            message = 'This is a current message';
            msg = $msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: new Date().getTime()
            }).c('body').t(message).up()
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            await _converse.handleMessageStanza(msg);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
            // Check that there is a <time> element, with the required props.
            expect(chat_content.querySelectorAll('time.separator-text').length).toEqual(2); // There are now two time elements

            const message_date = new Date();
            day = sizzle('.date-separator:last', chat_content);
            expect(day.length).toEqual(1);
            expect(day[0].getAttribute('class')).toEqual('message date-separator');
            expect(day[0].getAttribute('data-isodate')).toEqual(dayjs(message_date).startOf('day').toISOString());

            time = sizzle('time.separator-text:last', chat_content).pop();
            expect(time.textContent).toEqual(dayjs(message_date).startOf('day').format("dddd MMM Do YYYY"));

            // Normal checks for the 2nd message
            expect(chatbox.messages.length).toEqual(2);
            msg_obj = chatbox.messages.models[1];
            expect(msg_obj.get('message')).toEqual(message);
            expect(msg_obj.get('fullname')).toBeUndefined();
            expect(msg_obj.get('sender')).toEqual('them');
            expect(msg_obj.get('is_delayed')).toEqual(false);
            const msg_txt = sizzle('.chat-msg:last .chat-msg__text', chat_content).pop().textContent;
            expect(msg_txt).toEqual(message);

            expect(chat_content.querySelector('.chat-msg:last-child .chat-msg__text').textContent).toEqual(message);
            expect(chat_content.querySelector('.chat-msg:last-child .chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
            expect(chat_content.querySelector('.chat-msg:last-child .chat-msg__author').textContent.trim()).toBe('Juliet Capulet');
            done();
        }));

        it("is sanitized to prevent Javascript injection attacks",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.api.chatviews.get(contact_jid);
            const message = '<p>This message contains <em>some</em> <b>markup</b></p>';
            spyOn(view.model, 'sendMessage').and.callThrough();
            await test_utils.sendMessage(view, message);
            expect(view.model.sendMessage).toHaveBeenCalled();
            const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
            expect(msg.textContent).toEqual(message);
            expect(msg.innerHTML).toEqual('&lt;p&gt;This message contains &lt;em&gt;some&lt;/em&gt; &lt;b&gt;markup&lt;/b&gt;&lt;/p&gt;');
            done();
        }));

        it("can contain hyperlinks, which will be clickable",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.api.chatviews.get(contact_jid);
            const message = 'This message contains a hyperlink: www.opkode.com';
            spyOn(view.model, 'sendMessage').and.callThrough();
            test_utils.sendMessage(view, message);
            expect(view.model.sendMessage).toHaveBeenCalled();
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
            expect(msg.textContent).toEqual(message);
            expect(msg.innerHTML)
                .toEqual('This message contains a hyperlink: <a target="_blank" rel="noopener" href="http://www.opkode.com">www.opkode.com</a>');
            done();
        }));

        it("will have properly escaped URLs",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.api.chatviews.get(contact_jid);

            let message = "http://www.opkode.com/'onmouseover='alert(1)'whatever";
            await test_utils.sendMessage(view, message);

            let msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
            expect(msg.textContent).toEqual(message);
            expect(msg.innerHTML)
                .toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%27onmouseover=%27alert%281%29%27whatever">http://www.opkode.com/\'onmouseover=\'alert(1)\'whatever</a>');

            message = 'http://www.opkode.com/"onmouseover="alert(1)"whatever';
            await test_utils.sendMessage(view, message);

            msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
            expect(msg.textContent).toEqual(message);
            expect(msg.innerHTML).toEqual('<a target="_blank" rel="noopener" href="http://www.opkode.com/%22onmouseover=%22alert%281%29%22whatever">http://www.opkode.com/"onmouseover="alert(1)"whatever</a>');

            message = "https://en.wikipedia.org/wiki/Ender's_Game";
            await test_utils.sendMessage(view, message);

            msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
            expect(msg.textContent).toEqual(message);
            expect(msg.innerHTML).toEqual('<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Ender%27s_Game">'+message+'</a>');

            message = "<https://bugs.documentfoundation.org/show_bug.cgi?id=123737>";
            await test_utils.sendMessage(view, message);

            msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
            expect(msg.textContent).toEqual(message);
            expect(msg.innerHTML).toEqual(
                `&lt;<a target="_blank" rel="noopener" href="https://bugs.documentfoundation.org/show_bug.cgi?id=123737">https://bugs.documentfoundation.org/show_bug.cgi?id=123737</a>&gt;`);

            message = '<http://www.opkode.com/"onmouseover="alert(1)"whatever>';
            await test_utils.sendMessage(view, message);

            msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
            expect(msg.textContent).toEqual(message);
            expect(msg.innerHTML).toEqual(
                '&lt;<a target="_blank" rel="noopener" href="http://www.opkode.com/%22onmouseover=%22alert%281%29%22whatever">http://www.opkode.com/"onmouseover="alert(1)"whatever</a>&gt;');

            message = `https://www.google.com/maps/place/Kochstraat+6,+2041+CE+Zandvoort/@52.3775999,4.548971,3a,15y,170.85h,88.39t/data=!3m6!1e1!3m4!1sQ7SdHo_bPLPlLlU8GSGWaQ!2e0!7i13312!8i6656!4m5!3m4!1s0x47c5ec1e56f845ad:0x1de0bc4a5771fb08!8m2!3d52.3773668!4d4.5489388!5m1!1e2`
            await test_utils.sendMessage(view, message);

            msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
            expect(msg.textContent).toEqual(message);
            expect(msg.innerHTML).toEqual(
                `<a target="_blank" rel="noopener" href="https://www.google.com/maps/place/Kochstraat+6,+2041+CE+Zandvoort/@52.3775999,4.548971,3a,15y,170.85h,88.39t/data=%213m6%211e1%213m4%211sQ7SdHo_bPLPlLlU8GSGWaQ%212e0%217i13312%218i6656%214m5%213m4%211s0x47c5ec1e56f845ad:0x1de0bc4a5771fb08%218m2%213d52.3773668%214d4.5489388%215m1%211e2">https://www.google.com/maps/place/Kochstraat+6,+2041+CE+Zandvoort/@52.3775999,4.548971,3a,15y,170.85h,88.39t/data=!3m6!1e1!3m4!1sQ7SdHo_bPLPlLlU8GSGWaQ!2e0!7i13312!8i6656!4m5!3m4!1s0x47c5ec1e56f845ad:0x1de0bc4a5771fb08!8m2!3d52.3773668!4d4.5489388!5m1!1e2</a>`);
            done();
        }));

        it("will render newlines",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const view = await test_utils.openChatBoxFor(_converse, contact_jid);
            let stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Hey\nHave you heard the news?</body>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            const chat_content = view.el.querySelector('.chat-content');
            expect(chat_content.querySelector('.chat-msg__text').innerHTML).toBe('Hey<br>Have you heard the news?');
            stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Hey\n\n\nHave you heard the news?</body>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(chat_content.querySelector('.message:last-child .chat-msg__text').innerHTML).toBe('Hey<br><br>Have you heard the news?');
            stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Hey\nHave you heard\nthe news?</body>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(chat_content.querySelector('.message:last-child .chat-msg__text').innerHTML).toBe('Hey<br>Have you heard<br>the news?');
            done();
        }));

        it("will render images from their URLs",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            const base_url = 'https://conversejs.org';
            let message = base_url+"/logo/conversejs-filled.svg";
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const view = _converse.api.chatviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();
            test_utils.sendMessage(view, message);
            await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length, 1000)
            expect(view.model.sendMessage).toHaveBeenCalled();
            let msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
            expect(msg.innerHTML.trim()).toEqual(
                `<a target="_blank" rel="noopener" href="${base_url}/logo/conversejs-filled.svg"><img src="${message}" class="chat-image img-thumbnail"></a>`);
            message += "?param1=val1&param2=val2";
            test_utils.sendMessage(view, message);
            await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length === 2, 1000);
            expect(view.model.sendMessage).toHaveBeenCalled();
            msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
            expect(msg.innerHTML.trim()).toEqual(
                '<a target="_blank" rel="noopener" href="'+base_url+'/logo/conversejs-filled.svg?param1=val1&amp;param2=val2"><img'+
                ' src="'+message.replace(/&/g, '&amp;')+'" class="chat-image img-thumbnail"></a>')

            // Test now with two images in one message
            message += ' hello world '+base_url+"/logo/conversejs-filled.svg";
            test_utils.sendMessage(view, message);
            await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length === 4, 1000);
            expect(view.model.sendMessage).toHaveBeenCalled();
            msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
            expect(msg.textContent.trim()).toEqual('hello world');
            expect(msg.querySelectorAll('img').length).toEqual(2);

            // Non-https images aren't rendered
            message = base_url+"/logo/conversejs-filled.svg";
            const chat_content = view.el.querySelector('.chat-content');
            expect(chat_content.querySelectorAll('img').length).toBe(4);
            test_utils.sendMessage(view, message);
            expect(chat_content.querySelectorAll('img').length).toBe(4);
            done();
        }));

        it("will render the message time as configured",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            _converse.time_format = 'hh:mm';
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.api.chatviews.get(contact_jid);
            const message = 'This message is sent from this chatbox';
            await test_utils.sendMessage(view, message);

            const chatbox = await _converse.api.chats.get(contact_jid);
            expect(chatbox.messages.models.length, 1);
            const msg_object = chatbox.messages.models[0];

            const msg_author = view.el.querySelector('.chat-content .chat-msg:last-child .chat-msg__author');
            expect(msg_author.textContent.trim()).toBe('Romeo Montague');

            const msg_time = view.el.querySelector('.chat-content .chat-msg:last-child .chat-msg__time');
            const time = dayjs(msg_object.get('time')).format(_converse.time_format);
            expect(msg_time.textContent).toBe(time);
            done();
        }));

        it("will be correctly identified and rendered as a followup message",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);

            const base_time = new Date();
            const ONE_MINUTE_LATER = 60000;

            await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 300);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            _converse.filter_by_resource = true;

            jasmine.clock().install();
            jasmine.clock().mockDate(base_time);

            _converse.handleMessageStanza($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': u.getUniqueId()
                }).c('body').t('A message').up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await new Promise(resolve => _converse.on('chatBoxViewInitialized', resolve));
            const view = _converse.api.chatviews.get(sender_jid);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            jasmine.clock().tick(3*ONE_MINUTE_LATER);
            _converse.handleMessageStanza($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': u.getUniqueId()
                }).c('body').t("Another message 3 minutes later").up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            jasmine.clock().tick(11*ONE_MINUTE_LATER);
            _converse.handleMessageStanza($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': u.getUniqueId()
                }).c('body').t("Another message 14 minutes since we started").up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            jasmine.clock().tick(1000);
            // Insert <composing> message, to also check that
            // text messages are inserted correctly with
            // temporary chat events in the chat contents.
            _converse.handleMessageStanza($msg({
                    'id': 'aeb219',
                    'to': _converse.bare_jid,
                    'xmlns': 'jabber:client',
                    'from': sender_jid,
                    'type': 'chat'})
                .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                .tree());
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            jasmine.clock().tick(1*ONE_MINUTE_LATER);
            _converse.handleMessageStanza($msg({
                    'from': sender_jid,
                    'to': _converse.connection.jid,
                    'type': 'chat',
                    'id': _converse.connection.getUniqueId()
                }).c('body').t("Another message 1 minute and 1 second since the previous one").up()
                .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

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
            _converse.handleMessageStanza(
                $msg({
                    'xmlns': 'jabber:client',
                    'id': _converse.connection.getUniqueId(),
                    'to': _converse.bare_jid,
                    'from': sender_jid,
                    'type': 'chat'
                }).c('body').t("A delayed message, sent 5 minutes since we started").up()
                  .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp': dayjs(base_time).add(5, 'minutes').toISOString()})
                  .tree());
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

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

            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(5)'))).toBe(false);
            expect(chat_content.querySelector('.message:nth-child(5) .chat-msg__text').textContent).toBe(
                "Another message 14 minutes since we started");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(6)'))).toBe(true);
            expect(chat_content.querySelector('.message:nth-child(6) .chat-msg__text').textContent).toBe(
                "Another message 1 minute and 1 second since the previous one");
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(7)'))).toBe(false);

            _converse.handleMessageStanza(
                $msg({
                    'xmlns': 'jabber:client',
                    'id': _converse.connection.getUniqueId(),
                    'to': sender_jid,
                    'from': _converse.bare_jid+"/some-other-resource",
                    'type': 'chat'})
                .c('body').t("A carbon message 4 minutes later").up()
                .c('delay', {'xmlns': 'urn:xmpp:delay', 'stamp':dayjs(base_time).add(4, 'minutes').toISOString()})
                .tree());
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

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
            expect(u.hasClass('chat-msg--followup', chat_content.querySelector('.message:nth-child(6)'))).toBe(false);
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
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
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
            await _converse.handleMessageStanza(msg);
            const sent_messages = sent_stanzas.map(s => _.isElement(s) ? s : s.nodeTree).filter(s => s.nodeName === 'message');
            expect(sent_messages.length).toBe(1);
            const receipt = sizzle(`received[xmlns="${Strophe.NS.RECEIPTS}"]`, sent_messages[0]).pop();
            expect(Strophe.serialize(receipt)).toBe(`<received id="${msg_id}" xmlns="${Strophe.NS.RECEIPTS}"/>`);
            done();
        }));

        it("carbon received does not emit a message delivery receipt",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {
            await test_utils.waitForRoster(_converse, 'current', 1);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const msg_id = u.getUniqueId();
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
            await _converse.handleMessageStanza(msg);
            expect(view.model.sendReceiptStanza).not.toHaveBeenCalled();
            done();
        }));

        describe("when sent", function () {

            it("can have its delivery acknowledged by a receipt",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                const textarea = view.el.querySelector('textarea.chat-textarea');
                textarea.value = 'But soft, what light through yonder airlock breaks?';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13 // Enter
                });
                const chatbox = _converse.chatboxes.get(contact_jid);
                expect(chatbox).toBeDefined();
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                let msg_obj = chatbox.messages.models[0];
                let msg_id = msg_obj.get('msgid');
                let msg = $msg({
                        'from': contact_jid,
                        'to': _converse.connection.jid,
                        'id': u.getUniqueId(),
                    }).c('received', {'id': msg_id, xmlns: Strophe.NS.RECEIPTS}).up().tree();
                _converse.connection._dataRecv(test_utils.createRequest(msg));
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(1);

                // Also handle receipts with type 'chat'. See #1353
                spyOn(_converse, 'handleMessageStanza').and.callThrough();
                textarea.value = 'Another message';
                view.onKeyDown({
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13 // Enter
                });
                await new Promise(resolve => view.model.messages.once('rendered', resolve));

                msg_obj = chatbox.messages.models[1];
                msg_id = msg_obj.get('msgid');
                msg = $msg({
                        'from': contact_jid,
                        'type': 'chat',
                        'to': _converse.connection.jid,
                        'id': u.getUniqueId(),
                    }).c('received', {'id': msg_id, xmlns: Strophe.NS.RECEIPTS}).up().tree();
                _converse.connection._dataRecv(test_utils.createRequest(msg));
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(2);
                expect(_converse.handleMessageStanza.calls.count()).toBe(1);
                done();
            }));


            it("will appear inside the chatbox it was sent from",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);
                spyOn(_converse.api, "trigger").and.callThrough();
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid)
                const view = _converse.chatboxviews.get(contact_jid);
                const message = 'This message is sent from this chatbox';
                spyOn(view.model, 'sendMessage').and.callThrough();
                await test_utils.sendMessage(view, message);
                expect(view.model.sendMessage).toHaveBeenCalled();
                expect(view.model.messages.length, 2);
                expect(_converse.api.trigger.calls.mostRecent().args, ['messageSend', message]);
                expect(sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop().textContent).toEqual(message);
                done();
            }));


            it("will be trimmed of leading and trailing whitespace",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid)
                const view = _converse.chatboxviews.get(contact_jid);
                const message = '   \nThis message is sent from this chatbox \n     \n';
                await test_utils.sendMessage(view, message);
                expect(view.model.messages.at(0).get('message')).toEqual(message.trim());
                const message_el = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
                expect(message_el.textContent).toEqual(message.trim());
                done();
            }));
        });


        describe("when received from someone else", function () {

            it("will open a chatbox and be displayed inside it",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const include_nick = false;
                await test_utils.waitForRoster(_converse, 'current', 1, include_nick);
                await test_utils.openControlBox(_converse);
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 300);
                spyOn(_converse.api, "trigger").and.callThrough();
                const message = 'This is a received message';
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                // We don't already have an open chatbox for this user
                expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();
                await _converse.handleMessageStanza(
                    $msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': u.getUniqueId()
                    }).c('body').t(message).up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
                );
                const chatbox = await _converse.chatboxes.get(sender_jid);
                expect(chatbox).toBeDefined();
                const view = _converse.api.chatviews.get(sender_jid);
                expect(view).toBeDefined();

                expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                // Check that the message was received and check the message parameters
                expect(chatbox.messages.length).toEqual(1);
                const msg_obj = chatbox.messages.models[0];
                expect(msg_obj.get('message')).toEqual(message);
                expect(msg_obj.get('fullname')).toBeUndefined();
                expect(msg_obj.get('sender')).toEqual('them');
                expect(msg_obj.get('is_delayed')).toEqual(false);
                // Now check that the message appears inside the chatbox in the DOM
                const chat_content = view.el.querySelector('.chat-content');
                const mel = await u.waitUntil(() => chat_content.querySelector('.chat-msg .chat-msg__text'));
                expect(mel.textContent).toEqual(message);
                expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                await u.waitUntil(() => chatbox.vcard.get('fullname') === mock.cur_names[0]);
                expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Mercutio');
                done();
            }));

            it("will be trimmed of leading and trailing whitespace",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1, false);
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 300);
                const message = '\n\n        This is a received message         \n\n';
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await _converse.handleMessageStanza(
                    $msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': u.getUniqueId()
                    }).c('body').t(message).up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree()
                );
                const view = _converse.api.chatviews.get(sender_jid);
                expect(view.model.messages.length).toEqual(1);
                const msg_obj = view.model.messages.at(0);
                expect(msg_obj.get('message')).toEqual(message.trim());
                const chat_content = view.el.querySelector('.chat-content');
                const mel = await u.waitUntil(() => chat_content.querySelector('.chat-msg .chat-msg__text'));
                expect(mel.textContent).toEqual(message.trim());
                done();
            }));


            it("can be replaced with a correction",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                await test_utils.openControlBox(_converse);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const msg_id = u.getUniqueId();
                const view = await test_utils.openChatBoxFor(_converse, sender_jid);
                _converse.handleMessageStanza($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': msg_id,
                    }).c('body').t('But soft, what light through yonder airlock breaks?').tree());
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(view.el.querySelector('.chat-msg__text').textContent)
                    .toBe('But soft, what light through yonder airlock breaks?');

                _converse.handleMessageStanza($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': u.getUniqueId(),
                    }).c('body').t('But soft, what light through yonder chimney breaks?').up()
                    .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());
                await new Promise(resolve => view.model.messages.once('rendered', resolve));

                expect(view.el.querySelector('.chat-msg__text').textContent)
                    .toBe('But soft, what light through yonder chimney breaks?');
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(view.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
                expect(view.model.messages.models.length).toBe(1);

                _converse.handleMessageStanza($msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': u.getUniqueId(),
                    }).c('body').t('But soft, what light through yonder window breaks?').up()
                    .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());
                await new Promise(resolve => view.model.messages.once('rendered', resolve));

                expect(view.el.querySelector('.chat-msg__text').textContent)
                    .toBe('But soft, what light through yonder window breaks?');
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                expect(view.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
                view.el.querySelector('.chat-msg__content .fa-edit').click();
                const modal = view.model.messages.at(0).message_versions_modal;
                await u.waitUntil(() => u.isVisible(modal.el), 1000);
                const older_msgs = modal.el.querySelectorAll('.older-msg');
                expect(older_msgs.length).toBe(2);
                expect(older_msgs[0].childNodes[0].nodeName).toBe('TIME');
                expect(older_msgs[0].childNodes[2].textContent).toBe('But soft, what light through yonder airlock breaks?');
                expect(view.model.messages.models.length).toBe(1);
                done();
            }));


            describe("when a chatbox is opened for someone who is not in the roster", function () {

                it("the VCard for that user is fetched and the chatbox updated with the results",
                    mock.initConverse(
                        ['rosterGroupsFetched'], {'allow_non_roster_messaging': true},
                        async function (done, _converse) {

                    await test_utils.waitForRoster(_converse, 'current', 0);
                    spyOn(_converse.api, "trigger").and.callThrough();

                    const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    var vcard_fetched = false;
                    spyOn(_converse.api.vcard, "get").and.callFake(function () {
                        vcard_fetched = true;
                        return Promise.resolve({
                            'fullname': mock.cur_names[0],
                            'vcard_updated': (new Date()).toISOString(),
                            'jid': sender_jid
                        });
                    });
                    const message = 'This is a received message from someone not on the roster';
                    const msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: u.getUniqueId()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                    // We don't already have an open chatbox for this user
                    expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();

                    await _converse.handleMessageStanza(msg);
                    expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));

                    // Check that the chatbox and its view now exist
                    const chatbox = await _converse.api.chats.get(sender_jid);
                    const view = _converse.api.chatviews.get(sender_jid);
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));

                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    expect(chatbox.get('fullname') === sender_jid);

                    await u.waitUntil(() => view.el.querySelector('.chat-msg__author').textContent.trim() === 'Mercutio');
                    let author_el = view.el.querySelector('.chat-msg__author');
                    expect( _.includes(author_el.textContent.trim(), 'Mercutio')).toBeTruthy();
                    await u.waitUntil(() => vcard_fetched, 100);
                    expect(_converse.api.vcard.get).toHaveBeenCalled();
                    await u.waitUntil(() => chatbox.vcard.get('fullname') === mock.cur_names[0])
                    author_el = view.el.querySelector('.chat-msg__author');
                    expect( _.includes(author_el.textContent.trim(), 'Mercutio')).toBeTruthy();
                    done();
                }));
            });


            describe("who is not on the roster", function () {

                it("will open a chatbox and be displayed inside it if allow_non_roster_messaging is true",
                    mock.initConverse(
                        ['rosterGroupsFetched'], {'allow_non_roster_messaging': false},
                        async function (done, _converse) {

                    await test_utils.waitForRoster(_converse, 'current', 0);

                    spyOn(_converse.api, "trigger").and.callThrough();
                    const message = 'This is a received message from someone not on the roster';
                    const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    const msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: u.getUniqueId()
                        }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                    // We don't already have an open chatbox for this user
                    expect(_converse.chatboxes.get(sender_jid)).not.toBeDefined();

                    let chatbox = await _converse.api.chats.get(sender_jid);
                    expect(chatbox).toBe(null);
                    // onMessage is a handler for received XMPP messages
                    await _converse.handleMessageStanza(msg);
                    let view = _converse.chatboxviews.get(sender_jid);
                    expect(view).not.toBeDefined();

                    // onMessage is a handler for received XMPP messages
                    _converse.allow_non_roster_messaging = true;
                    await _converse.handleMessageStanza(msg);
                    view = _converse.chatboxviews.get(sender_jid);
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
                    expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                    // Check that the chatbox and its view now exist
                    chatbox = await _converse.api.chats.get(sender_jid);
                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    // Check that the message was received and check the message parameters
                    expect(chatbox.messages.length).toEqual(1);
                    const msg_obj = chatbox.messages.models[0];
                    expect(msg_obj.get('message')).toEqual(message);
                    expect(msg_obj.get('fullname')).toEqual(undefined);
                    expect(msg_obj.get('sender')).toEqual('them');
                    expect(msg_obj.get('is_delayed')).toEqual(false);

                    await u.waitUntil(() => view.el.querySelector('.chat-msg__author').textContent.trim() === 'Mercutio');
                    // Now check that the message appears inside the chatbox in the DOM
                    const chat_content = view.el.querySelector('.chat-content');
                    expect(chat_content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(message);
                    expect(chat_content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                    expect(chat_content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Mercutio');
                    done();
                }));
            });


            describe("and for which then an error message is received from the server", function () {

                it("will have the error message displayed after itself",
                    mock.initConverse(
                        ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        async function (done, _converse) {

                    await test_utils.waitForRoster(_converse, 'current', 1);

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
                    const sender_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    let fullname = _converse.xmppstatus.get('fullname'); // eslint-disable-line no-unused-vars
                    fullname = _.isEmpty(fullname) ? _converse.bare_jid: fullname;
                    await _converse.api.chats.open(sender_jid)
                    let msg_text = 'This message will not be sent, due to an error';
                    const view = _converse.api.chatviews.get(sender_jid);
                    const message = await view.model.sendMessage(msg_text);
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
                    const chat_content = view.el.querySelector('.chat-content');
                    let msg_txt = sizzle('.chat-msg:last .chat-msg__text', chat_content).pop().textContent;
                    expect(msg_txt).toEqual(msg_text);

                    // We send another message, for which an error will
                    // not be received, to test that errors appear
                    // after the relevant message.
                    msg_text = 'This message will be sent, and also receive an error';
                    const second_message = await view.model.sendMessage(msg_text);
                    await u.waitUntil(() => sizzle('.chat-msg .chat-msg__text', chat_content).length === 2, 1000);
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
                            'id': message.get('msgid'),
                            'from': sender_jid
                        })
                        .c('error', {'type': 'cancel'})
                        .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                        .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                            .t('Server-to-server connection failed: Connecting failed: connection timeout');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
                    expect(chat_content.querySelector('.chat-error').textContent.trim()).toEqual(error_txt);
                    stanza = $msg({
                            'to': _converse.connection.jid,
                            'type': 'error',
                            'id': second_message.get('id'),
                            'from': sender_jid
                        })
                        .c('error', {'type': 'cancel'})
                        .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                        .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                            .t('Server-to-server connection failed: Connecting failed: connection timeout');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
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

                    msg_text = 'This message will be sent, and also receive an error';
                    const third_message = await view.model.sendMessage(msg_text);
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
                    msg_txt = sizzle('.chat-msg:last .chat-msg__text', chat_content).pop().textContent;
                    expect(msg_txt).toEqual(msg_text);

                    // A different error message will however render
                    stanza = $msg({
                            'to': _converse.connection.jid,
                            'type':'error',
                            'id': third_message.get('id'),
                            'from': sender_jid
                        })
                        .c('error', {'type': 'cancel'})
                        .c('not-allowed', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                        .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                            .t('Something else went wrong as well');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    await u.waitUntil(() => view.model.messages.length > 3);
                    await new Promise(resolve => view.model.messages.once('rendered', resolve));
                    expect(chat_content.querySelectorAll('.chat-error').length).toEqual(3);
                    done();
                }));

                it("will not show to the user an error message for a CSI message",
                    mock.initConverse(
                        ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        async function (done, _converse) {

                    // See #1317
                    // https://github.com/conversejs/converse.js/issues/1317
                    await test_utils.waitForRoster(_converse, 'current');
                    await test_utils.openControlBox(_converse);

                    const contact_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await test_utils.openChatBoxFor(_converse, contact_jid);

                    const messages = _converse.connection.sent_stanzas.filter(s => s.nodeName === 'message');
                    expect(messages.length).toBe(1);
                    expect(Strophe.serialize(messages[0])).toBe(
                        `<message id="${messages[0].getAttribute('id')}" to="tybalt@montague.lit" type="chat" xmlns="jabber:client">`+
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
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, sender_jid)
                const view = _converse.api.chatviews.get(sender_jid);
                // Create enough messages so that there's a scrollbar.
                const promises = [];
                for (let i=0; i<20; i++) {
                    _converse.handleMessageStanza($msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: _converse.connection.getUniqueId(),
                        }).c('body').t('Message: '+i).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                    promises.push(new Promise(resolve => view.once('messageInserted', resolve)));
                }
                await Promise.all(promises);
                // XXX Fails on Travis
                // await u.waitUntil(() => view.content.scrollTop, 1000)
                await u.waitUntil(() => !view.model.get('auto_scrolled'), 500);
                view.content.scrollTop = 0;
                // XXX Fails on Travis
                // await u.waitUntil(() => view.model.get('scrolled'), 900);
                view.model.set('scrolled', true);

                const message = 'This message is received while the chat area is scrolled up';
                _converse.handleMessageStanza($msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: u.getUniqueId()
                    }).c('body').t(message).up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                await u.waitUntil(() => view.model.messages.length > 20, 1000);
                // Now check that the message appears inside the chatbox in the DOM
                const  msg_txt = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop().textContent;
                expect(msg_txt).toEqual(message);
                await u.waitUntil(() => u.isVisible(view.el.querySelector('.new-msgs-indicator')), 900);
                expect(view.model.get('scrolled')).toBe(true);
                expect(view.content.scrollTop).toBe(0);
                expect(u.isVisible(view.el.querySelector('.new-msgs-indicator'))).toBeTruthy();
                // Scroll down again
                view.content.scrollTop = view.content.scrollHeight;
                // XXX Fails on Travis
                // await u.waitUntil(() => !u.isVisible(view.el.querySelector('.new-msgs-indicator')), 900);
                done();
            }));

            it("is ignored if it's intended for a different resource and filter_by_resource is set to true",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length)
                // Send a message from a different resource
                spyOn(converse.env.log, 'info');
                spyOn(_converse.api.chatboxes, 'create').and.callThrough();
                _converse.filter_by_resource = true;
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                let msg = $msg({
                        from: sender_jid,
                        to: _converse.bare_jid+"/some-other-resource",
                        type: 'chat',
                        id: u.getUniqueId()
                    }).c('body').t("This message will not be shown").up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                await _converse.handleMessageStanza(msg);

                expect(converse.env.log.info).toHaveBeenCalledWith(
                    "onMessage: Ignoring incoming message intended for a different resource: romeo@montague.lit/some-other-resource",
                );
                expect(_converse.api.chatboxes.create).not.toHaveBeenCalled();
                _converse.filter_by_resource = false;

                const message = "This message sent to a different resource will be shown";
                msg = $msg({
                        from: sender_jid,
                        to: _converse.bare_jid+"/some-other-resource",
                        type: 'chat',
                        id: '134234623462346'
                    }).c('body').t(message).up()
                        .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
                await _converse.handleMessageStanza(msg);
                await u.waitUntil(() => _converse.chatboxviews.keys().length > 1, 1000);
                const view = _converse.chatboxviews.get(sender_jid);
                await u.waitUntil(() => view.model.messages.length);
                expect(_converse.api.chatboxes.create).toHaveBeenCalled();
                const last_message = await u.waitUntil(() => sizzle('.chat-content:last .chat-msg__text', view.el).pop());
                const msg_txt = last_message.textContent;
                expect(msg_txt).toEqual(message);
                done();
            }));
        });


        describe("which contains an OOB URL", function () {

            it("will render audio from oob mp3 URLs",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid);
                const view = _converse.api.chatviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();

                let stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="romeo@montague.lit/orchard">
                        <body>Have you heard this funny audio?</body>
                        <x xmlns="jabber:x:oob"><url>https://montague.lit/audio.mp3</url></x>
                    </message>`)
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg audio').length, 1000);
                let msg = view.el.querySelector('.chat-msg .chat-msg__text');
                expect(msg.classList.length).toEqual(1);
                expect(u.hasClass('chat-msg__text', msg)).toBe(true);
                expect(msg.textContent).toEqual('Have you heard this funny audio?');
                let media = view.el.querySelector('.chat-msg .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    '<!-- src/templates/audio.html -->'+
                    '<audio controls="" src="https://montague.lit/audio.mp3"></audio>'+
                    '<a target="_blank" rel="noopener" href="https://montague.lit/audio.mp3">Download audio file "audio.mp3"</a>');

                // If the <url> and <body> contents is the same, don't duplicate.
                stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="romeo@montague.lit/orchard">
                        <body>https://montague.lit/audio.mp3</body>
                        <x xmlns="jabber:x:oob"><url>https://montague.lit/audio.mp3</url></x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                msg = view.el.querySelector('.chat-msg:last-child .chat-msg__text');
                expect(msg.innerHTML).toEqual('<!-- message gets added here via renderMessage -->'); // Emtpy
                media = view.el.querySelector('.chat-msg:last-child .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    '<!-- src/templates/audio.html -->'+
                    '<audio controls="" src="https://montague.lit/audio.mp3"></audio>'+
                    '<a target="_blank" rel="noopener" href="https://montague.lit/audio.mp3">Download audio file "audio.mp3"</a>'
                );
                done();
            }));

            it("will render video from oob mp4 URLs",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid)
                const view = _converse.api.chatviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();

                let stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="romeo@montague.lit/orchard">
                        <body>Have you seen this funny video?</body>
                        <x xmlns="jabber:x:oob"><url>https://montague.lit/video.mp4</url></x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg video').length, 2000)
                let msg = view.el.querySelector('.chat-msg .chat-msg__text');
                expect(msg.classList.length).toBe(1);
                expect(msg.textContent).toEqual('Have you seen this funny video?');
                let media = view.el.querySelector('.chat-msg .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    '<!-- src/templates/video.html -->'+
                    '<video controls="" preload="metadata" src="https://montague.lit/video.mp4" style="max-height: 50vh"></video>');

                // If the <url> and <body> contents is the same, don't duplicate.
                stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="romeo@montague.lit/orchard">
                        <body>https://montague.lit/video.mp4</body>
                        <x xmlns="jabber:x:oob"><url>https://montague.lit/video.mp4</url></x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                msg = view.el.querySelector('.chat-msg:last-child .chat-msg__text');
                expect(msg.innerHTML).toEqual('<!-- message gets added here via renderMessage -->'); // Emtpy
                media = view.el.querySelector('.chat-msg:last-child .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    '<!-- src/templates/video.html -->'+
                    '<video controls="" preload="metadata" src="https://montague.lit/video.mp4" style="max-height: 50vh"></video>');
                done();
            }));

            it("will render download links for files from oob URLs",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid);
                const view = _converse.api.chatviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();
                const stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="romeo@montague.lit/orchard">
                        <body>Have you downloaded this funny file?</body>
                        <x xmlns="jabber:x:oob"><url>https://montague.lit/funny.pdf</url></x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg a').length, 1000);
                const msg = view.el.querySelector('.chat-msg .chat-msg__text');
                expect(u.hasClass('chat-msg__text', msg)).toBe(true);
                expect(msg.textContent).toEqual('Have you downloaded this funny file?');
                const media = view.el.querySelector('.chat-msg .chat-msg__media');
                expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                    '<!-- src/templates/file.html -->'+
                    '<a target="_blank" rel="noopener" href="https://montague.lit/funny.pdf">Download file "funny.pdf"</a>');
                done();
            }));

            it("will render images from oob URLs",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const base_url = 'https://conversejs.org';
                await test_utils.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid)
                const view = _converse.api.chatviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();
                const url = base_url+"/logo/conversejs-filled.svg";

                const stanza = u.toStanza(`
                    <message from="${contact_jid}"
                             type="chat"
                             to="romeo@montague.lit/orchard">
                        <body>Have you seen this funny image?</body>
                        <x xmlns="jabber:x:oob"><url>${url}</url></x>
                    </message>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg img').length, 2000);

                const msg = view.el.querySelector('.chat-msg .chat-msg__text');
                expect(u.hasClass('chat-msg__text', msg)).toBe(true);
                expect(msg.textContent).toEqual('Have you seen this funny image?');
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
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const view = _converse.api.chatviews.get(contact_jid);
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
            await u.waitUntil(() => view.model.sendMarker.calls.count() === 1);
            expect(Strophe.serialize(sent_stanzas[0])).toBe(
                `<message from="romeo@montague.lit/orchard" `+
                        `id="${sent_stanzas[0].nodeTree.getAttribute('id')}" `+
                        `to="${contact_jid}" type="chat" xmlns="jabber:client">`+
                `<received id="${msgid}" xmlns="urn:xmpp:chat-markers:0"/>`+
                `</message>`);
            done();
        }));

        it("is not sent when a markable message is received from someone not on the roster",
            mock.initConverse(
                ['rosterGroupsFetched'], {'allow_non_roster_messaging': true},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current', 0);
            const contact_jid = 'someone@montague.lit';
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
            await _converse.handleMessageStanza(stanza);
            const sent_messages = sent_stanzas
                .map(s => _.isElement(s) ? s : s.nodeTree)
                .filter(e => e.nodeName === 'message');
            expect(sent_messages.length).toBe(0);
            done();
        }));

        it("is ignored if it's a carbon copy of one that I sent from a different client",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current', 1);
            await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.SID]);

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            const view = _converse.api.chatviews.get(contact_jid);

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
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.model.messages.length).toBe(1);

            stanza = u.toStanza(
                `<message xmlns="jabber:client" to="${_converse.bare_jid}" type="chat" from="${contact_jid}">
                    <sent xmlns="urn:xmpp:carbons:2">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <message xmlns="jabber:client" to="${contact_jid}" type="chat" from="${_converse.bare_jid}/other-resource">
                                <received xmlns="urn:xmpp:chat-markers:0" id="2e972ea0-0050-44b7-a830-f6638a2595b3"/>
                                <store xmlns="urn:xmpp:hints"/>
                                <stanza-id xmlns="urn:xmpp:sid:0" id="F4TC6CvHwzqRbeHb" by="${_converse.bare_jid}"/>
                            </message>
                        </forwarded>
                    </sent>
                </message>`);
            spyOn(_converse.api, "trigger").and.callThrough();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => _converse.api.trigger.calls.count(), 500);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.model.messages.length).toBe(1);
            done();
        }));
    });
}));
