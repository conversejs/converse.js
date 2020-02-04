(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const { Promise, Strophe, $msg, $pres, sizzle, stanza_utils } = converse.env;
    const u = converse.env.utils;

    describe("A Groupchat Message", function () {

        describe("an info message", function () {

            it("is not rendered as a followup message",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

                const view = _converse.api.chatviews.get(muc_jid);
                const presence = u.toStanza(`
                    <presence xmlns="jabber:client" to="${_converse.jid}" from="${muc_jid}/romeo">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <status code="201"/>
                            <item role="moderator" affiliation="owner" jid="${_converse.jid}"/>
                            <status code="110"/>
                        </x>
                    </presence>
                `);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                await u.waitUntil(() => view.el.querySelectorAll('.chat-info').length === 2);

                const messages = view.el.querySelectorAll('.chat-info');
                expect(u.hasClass('chat-msg--followup', messages[0])).toBe(false);
                expect(u.hasClass('chat-msg--followup', messages[1])).toBe(false);
                done();
            }));

            it("is not shown if its a duplicate",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.api.chatviews.get(muc_jid);
                await u.waitUntil(() => view.el.querySelectorAll('.chat-info').length);

                const presence = u.toStanza(`
                    <presence xmlns="jabber:client" to="${_converse.jid}" from="${muc_jid}/romeo">
                        <x xmlns="http://jabber.org/protocol/muc#user">
                            <status code="201"/>
                            <item role="moderator" affiliation="owner" jid="${_converse.jid}"/>
                            <status code="110"/>
                        </x>
                    </presence>
                `);
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                _converse.connection._dataRecv(test_utils.createRequest(presence));
                await u.waitUntil(() => view.el.querySelectorAll('.chat-info').length > 1);
                expect(view.el.querySelectorAll('.chat-info').length).toBe(2);
                done();
            }));
        });


        it("is rejected if it's an unencapsulated forwarded message",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const impersonated_jid = `${muc_jid}/alice`;
            const received_stanza = u.toStanza(`
                <message to='${_converse.jid}' from='${muc_jid}/mallory' type='groupchat' id='${_converse.connection.getUniqueId()}'>
                    <forwarded xmlns='urn:xmpp:forward:0'>
                        <delay xmlns='urn:xmpp:delay' stamp='2019-07-10T23:08:25Z'/>
                        <message from='${impersonated_jid}'
                                id='0202197'
                                to='${_converse.bare_jid}'
                                type='groupchat'
                                xmlns='jabber:client'>
                            <body>Yet I should kill thee with much cherishing.</body>
                        </message>
                    </forwarded>
                </message>
            `);
            const view = _converse.api.chatviews.get(muc_jid);
            await view.model.onMessage(received_stanza);
            spyOn(converse.env.log, 'warn');
            _converse.connection._dataRecv(test_utils.createRequest(received_stanza));
            expect(converse.env.log.warn).toHaveBeenCalledWith(
                'onMessage: Ignoring unencapsulated forwarded groupchat message'
            );
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(0);
            expect(view.model.messages.length).toBe(0);
            done();
        }));


        it("is specially marked when you are mentioned in it",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
            if (!view.el.querySelectorAll('.chat-area').length) { view.renderChatArea(); }
            const message = 'romeo: Your attention is required';
            const nick = mock.chatroom_names[0],
                msg = $msg({
                    from: 'lounge@montague.lit/'+nick,
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t(message).tree();
            await view.model.onMessage(msg);
            expect(u.hasClass('mentioned', view.el.querySelector('.chat-msg'))).toBeTruthy();
            done();
        }));

        it("can not be expected to have a unique id attribute",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
            if (!view.el.querySelectorAll('.chat-area').length) { view.renderChatArea(); }
            const id = u.getUniqueId();
            let msg = $msg({
                    from: 'lounge@montague.lit/some1',
                    id: id,
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t('First message').tree();
            await view.model.onMessage(msg);
            await u.waitUntil(() => view.el.querySelectorAll('.chat-msg').length === 1);

            msg = $msg({
                    from: 'lounge@montague.lit/some2',
                    id: id,
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t('Another message').tree();
            await view.model.onMessage(msg);
            await u.waitUntil(() => view.el.querySelectorAll('.chat-msg').length === 2);
            expect(view.model.messages.length).toBe(2);
            done();
        }));

        it("is ignored if it has the same archive-id of an already received one",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'room@muc.example.com';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
            spyOn(view.model, 'getDuplicateMessage').and.callThrough();
            let stanza = u.toStanza(`
                <message xmlns="jabber:client"
                         from="room@muc.example.com/some1"
                         to="${_converse.connection.jid}"
                         type="groupchat">
                    <body>Typical body text</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                               by="room@muc.example.com"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => view.model.messages.length === 1);
            await u.waitUntil(() => view.model.getDuplicateMessage.calls.count() === 1);
            let result = await view.model.getDuplicateMessage.calls.all()[0].returnValue;
            expect(result).toBe(undefined);

            stanza = u.toStanza(`
                <message xmlns="jabber:client"
                        to="${_converse.connection.jid}"
                        from="room@muc.example.com">
                    <result xmlns="urn:xmpp:mam:2" queryid="82d9db27-6cf8-4787-8c2c-5a560263d823" id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:17:23Z"/>
                            <message from="room@muc.example.com/some1" type="groupchat">
                                <body>Typical body text</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);

            spyOn(view.model, 'updateMessage');
            await view.model.onMessage(stanza);
            await u.waitUntil(() => view.model.getDuplicateMessage.calls.count() === 2);
            result = await view.model.getDuplicateMessage.calls.all()[1].returnValue;
            expect(result instanceof _converse.Message).toBe(true);
            expect(view.model.messages.length).toBe(1);
            await u.waitUntil(() => view.model.updateMessage.calls.count());
            done();
        }));

        it("is ignored if it has the same stanza-id of an already received one",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'room@muc.example.com';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
            spyOn(view.model, 'getStanzaIdQueryAttrs').and.callThrough();
            let stanza = u.toStanza(`
                <message xmlns="jabber:client"
                         from="room@muc.example.com/some1"
                         to="${_converse.connection.jid}"
                         type="groupchat">
                    <body>Typical body text</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                               by="room@muc.example.com"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => view.model.messages.length === 1);
            await u.waitUntil(() => view.model.getStanzaIdQueryAttrs.calls.count() === 1);
            let result = await view.model.getStanzaIdQueryAttrs.calls.all()[0].returnValue;
            expect(result instanceof Array).toBe(true);
            expect(result[0] instanceof Object).toBe(true);
            expect(result[0]['stanza_id room@muc.example.com']).toBe("5f3dbc5e-e1d3-4077-a492-693f3769c7ad");

            stanza = u.toStanza(`
                <message xmlns="jabber:client"
                         from="room@muc.example.com/some1"
                         to="${_converse.connection.jid}"
                         type="groupchat">
                    <body>Typical body text</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                               by="room@muc.example.com"/>
                </message>`);
            spyOn(view.model, 'updateMessage');
            spyOn(view.model, 'getDuplicateMessage').and.callThrough();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => view.model.getDuplicateMessage.calls.count());
            result = await view.model.getDuplicateMessage.calls.all()[0].returnValue;
            expect(result instanceof _converse.Message).toBe(true);
            expect(view.model.messages.length).toBe(1);
            await u.waitUntil(() => view.model.updateMessage.calls.count());
            done();
        }));

        it("will be discarded if it's a malicious message meant to look like a carbon copy",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            await test_utils.openControlBox(_converse);
            const muc_jid = 'xsf@muc.xmpp.org';
            const sender_jid = `${muc_jid}/romeo`;
            const impersonated_jid = `${muc_jid}/i_am_groot`
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const stanza = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    from: sender_jid
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newguy@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                }).tree();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            /*
             * <message to="romeo@montague.im/poezio" id="718d40df-3948-4798-a99b-35cc9f03cc4f-641" type="groupchat" from="xsf@muc.xmpp.org/romeo">
             *     <received xmlns="urn:xmpp:carbons:2">
             *         <forwarded xmlns="urn:xmpp:forward:0">
             *         <message xmlns="jabber:client" to="xsf@muc.xmpp.org" type="groupchat" from="xsf@muc.xmpp.org/i_am_groot">
             *             <body>I am groot.</body>
             *         </message>
             *         </forwarded>
             *     </received>
             * </message>
             */
            const msg = $msg({
                    'from': sender_jid,
                    'id': _converse.connection.getUniqueId(),
                    'to': _converse.connection.jid,
                    'type': 'groupchat',
                    'xmlns': 'jabber:client'
                }).c('received', {'xmlns': 'urn:xmpp:carbons:2'})
                  .c('forwarded', {'xmlns': 'urn:xmpp:forward:0'})
                  .c('message', {
                        'xmlns': 'jabber:client',
                        'from': impersonated_jid,
                        'to': muc_jid,
                        'type': 'groupchat'
                }).c('body').t('I am groot').tree();
            const view = _converse.api.chatviews.get(muc_jid);
            spyOn(converse.env.log, 'warn');
            await view.model.onMessage(msg);
            expect(converse.env.log.warn).toHaveBeenCalledWith(
                'onMessage: Ignoring XEP-0280 "groupchat" message carbon, '+
                'according to the XEP groupchat messages SHOULD NOT be carbon copied'
            );
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(0);
            expect(view.model.messages.length).toBe(0);
            done();
        }));

        it("keeps track of the sender's role and affiliation",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
            let msg = $msg({
                from: 'lounge@montague.lit/romeo',
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('I wrote this message!').tree();
            await view.model.onMessage(msg);
            await u.waitUntil(() => view.el.querySelectorAll('.chat-msg').length);
            expect(view.model.messages.last().occupant.get('affiliation')).toBe('owner');
            expect(view.model.messages.last().occupant.get('role')).toBe('moderator');
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(sizzle('.chat-msg', view.el).pop().classList.value.trim()).toBe('message chat-msg groupchat moderator owner');
            let presence = $pres({
                    to:'romeo@montague.lit/orchard',
                    from:'lounge@montague.lit/romeo',
                    id: u.getUniqueId()
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'member',
                    jid: 'romeo@montague.lit/orchard',
                    role: 'participant'
                }).up()
                .c('status').attrs({code:'110'}).up()
                .c('status').attrs({code:'210'}).nodeTree;
            _converse.connection._dataRecv(test_utils.createRequest(presence));

            msg = $msg({
                from: 'lounge@montague.lit/romeo',
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('Another message!').tree();
            await view.model.onMessage(msg);
            expect(view.model.messages.last().occupant.get('affiliation')).toBe('member');
            expect(view.model.messages.last().occupant.get('role')).toBe('participant');
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);
            expect(sizzle('.chat-msg', view.el).pop().classList.value.trim()).toBe('message chat-msg groupchat participant member');

            presence = $pres({
                    to:'romeo@montague.lit/orchard',
                    from:'lounge@montague.lit/romeo',
                    id: u.getUniqueId()
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'owner',
                    jid: 'romeo@montague.lit/orchard',
                    role: 'moderator'
                }).up()
                .c('status').attrs({code:'110'}).up()
                .c('status').attrs({code:'210'}).nodeTree;
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            view.model.sendMessage('hello world');
            await u.waitUntil(() => view.el.querySelectorAll('.chat-msg').length === 3);

            expect(view.model.messages.last().occupant.get('affiliation')).toBe('owner');
            expect(view.model.messages.last().occupant.get('role')).toBe('moderator');
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(3);
            expect(sizzle('.chat-msg', view.el).pop().classList.value.trim()).toBe('message chat-msg groupchat moderator owner');


            const add_events = view.model.occupants._events.add.length;
            msg = $msg({
                from: 'lounge@montague.lit/some1',
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('Message from someone not in the MUC right now').tree();
            await view.model.onMessage(msg);
            expect(view.model.messages.last().occupant).toBeUndefined();
            // Check that there's a new "add" event handler, for when the occupant appears.
            expect(view.model.occupants._events.add.length).toBe(add_events+1);

            // Check that the occupant gets added/removed to the message as it
            // gets removed or added.
            presence = $pres({
                    to:'romeo@montague.lit/orchard',
                    from:'lounge@montague.lit/some1',
                    id: u.getUniqueId()
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({jid: 'some1@montague.lit/orchard'});
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            await u.waitUntil(() => view.model.messages.last().occupant);
            expect(view.model.messages.last().get('message')).toBe('Message from someone not in the MUC right now');
            expect(view.model.messages.last().occupant.get('nick')).toBe('some1');
            // Check that the "add" event handler was removed.
            expect(view.model.occupants._events.add.length).toBe(add_events);

            presence = $pres({
                    to:'romeo@montague.lit/orchard',
                    type: 'unavailable',
                    from:'lounge@montague.lit/some1',
                    id: u.getUniqueId()
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({jid: 'some1@montague.lit/orchard'});
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            await u.waitUntil(() => !view.model.messages.last().occupant);
            expect(view.model.messages.last().get('message')).toBe('Message from someone not in the MUC right now');
            expect(view.model.messages.last().occupant).toBeUndefined();
            // Check that there's a new "add" event handler, for when the occupant appears.
            expect(view.model.occupants._events.add.length).toBe(add_events+1);

            presence = $pres({
                    to:'romeo@montague.lit/orchard',
                    from:'lounge@montague.lit/some1',
                    id: u.getUniqueId()
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({jid: 'some1@montague.lit/orchard'});
            _converse.connection._dataRecv(test_utils.createRequest(presence));
            await u.waitUntil(() => view.model.messages.last().occupant);
            expect(view.model.messages.last().get('message')).toBe('Message from someone not in the MUC right now');
            expect(view.model.messages.last().occupant.get('nick')).toBe('some1');
            // Check that the "add" event handler was removed.
            expect(view.model.occupants._events.add.length).toBe(add_events);
            done();
        }));


        it("keeps track whether you are the sender or not",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
            const msg = $msg({
                    from: 'lounge@montague.lit/romeo',
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t('I wrote this message!').tree();
            await view.model.onMessage(msg);
            expect(view.model.messages.last().get('sender')).toBe('me');
            done();
        }));

        it("can be replaced with a correction",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
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
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            const msg_id = u.getUniqueId();
            await view.model.onMessage($msg({
                    'from': 'lounge@montague.lit/newguy',
                    'to': _converse.connection.jid,
                    'type': 'groupchat',
                    'id': msg_id,
                }).c('body').t('But soft, what light through yonder airlock breaks?').tree());

            await u.waitUntil(() => view.el.querySelectorAll('.chat-msg').length);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder airlock breaks?');

            await view.model.onMessage($msg({
                    'from': 'lounge@montague.lit/newguy',
                    'to': _converse.connection.jid,
                    'type': 'groupchat',
                    'id': u.getUniqueId(),
                }).c('body').t('But soft, what light through yonder chimney breaks?').up()
                    .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());
            await u.waitUntil(() => view.el.querySelector('.chat-msg__text').textContent ===
                'But soft, what light through yonder chimney breaks?', 500);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);

            await view.model.onMessage($msg({
                    'from': 'lounge@montague.lit/newguy',
                    'to': _converse.connection.jid,
                    'type': 'groupchat',
                    'id': u.getUniqueId(),
                }).c('body').t('But soft, what light through yonder window breaks?').up()
                    .c('replace', {'id': msg_id, 'xmlns': 'urn:xmpp:message-correct:0'}).tree());

            await u.waitUntil(() => view.el.querySelector('.chat-msg__text').textContent ===
                'But soft, what light through yonder window breaks?', 500);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__content .fa-edit').length).toBe(1);
            view.el.querySelector('.chat-msg__content .fa-edit').click();
            const modal = view.model.messages.at(0).message_versions_modal;
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            const older_msgs = modal.el.querySelectorAll('.older-msg');
            expect(older_msgs.length).toBe(2);
            expect(older_msgs[0].childNodes[2].textContent).toBe('But soft, what light through yonder airlock breaks?');
            expect(older_msgs[0].childNodes[0].nodeName).toBe('TIME');
            expect(older_msgs[1].childNodes[0].nodeName).toBe('TIME');
            expect(older_msgs[1].childNodes[2].textContent).toBe('But soft, what light through yonder chimney breaks?');
            done();
        }));

        it("can be sent as a correction by using the up arrow",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'lounge@montague.lit';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
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
            await u.waitUntil(() => view.el.querySelectorAll('.chat-msg').length === 1);
            expect(view.el.querySelector('.chat-msg__text').textContent)
                .toBe('But soft, what light through yonder airlock breaks?');

            const first_msg = view.model.messages.findWhere({'message': 'But soft, what light through yonder airlock breaks?'});
            expect(textarea.value).toBe('');
            view.onKeyDown({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(textarea.value).toBe('But soft, what light through yonder airlock breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(true);

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
                    `to="lounge@montague.lit" type="groupchat" `+
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

            const older_versions = corrected_message.get('older_versions');
            const keys = Object.keys(older_versions);
            expect(keys.length).toBe(1);
            expect(older_versions[keys[0]]).toBe('But soft, what light through yonder airlock breaks?');

            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(u.hasClass('correcting', view.el.querySelector('.chat-msg'))).toBe(false);

            // Check that messages from other users are skipped
            await view.model.onMessage($msg({
                'from': muc_jid+'/someone-else',
                'id': u.getUniqueId(),
                'to': 'romeo@montague.lit',
                'type': 'groupchat'
            }).c('body').t('Hello world').tree());
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);

            // Test that pressing the down arrow cancels message correction
            expect(textarea.value).toBe('');
            view.onKeyDown({
                target: textarea,
                keyCode: 38 // Up arrow
            });
            expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
            expect(view.model.messages.at(0).get('correcting')).toBe(true);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);
            await u.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')), 500);
            expect(textarea.value).toBe('But soft, what light through yonder window breaks?');
            view.onKeyDown({
                target: textarea,
                keyCode: 40 // Down arrow
            });
            expect(textarea.value).toBe('');
            expect(view.model.messages.at(0).get('correcting')).toBe(false);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);
            await u.waitUntil(() => !u.hasClass('correcting', view.el.querySelector('.chat-msg')), 500);
            done();
        }));

        it("will be shown as received upon MUC reflection",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            const muc_jid = 'lounge@montague.lit';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.el.querySelectorAll('.chat-msg__body.chat-msg__body--received').length).toBe(0);

            const msg_obj = view.model.messages.at(0);
            const stanza = u.toStanza(`
                <message xmlns="jabber:client"
                         from="${msg_obj.get('from')}"
                         to="${_converse.connection.jid}"
                         type="groupchat">
                    <msg_body>${msg_obj.get('message')}</msg_body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                               by="lounge@montague.lit"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${msg_obj.get('origin_id')}"/>
                </message>`);
            await view.model.onMessage(stanza);
            await u.waitUntil(() => view.el.querySelectorAll('.chat-msg__body.chat-msg__body--received').length, 500);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);
            expect(view.el.querySelectorAll('.chat-msg__body.chat-msg__body--received').length).toBe(1);
            expect(view.model.messages.length).toBe(1);

            const message = view.model.messages.at(0);
            expect(message.get('stanza_id lounge@montague.lit')).toBe('5f3dbc5e-e1d3-4077-a492-693f3769c7ad');
            expect(message.get('origin_id')).toBe(msg_obj.get('origin_id'));
            done();
        }));

        it("gets updated with its stanza-id upon MUC reflection",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            const muc_jid = 'room@muc.example.com';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);

            view.model.sendMessage('hello world');
            await u.waitUntil(() => view.model.messages.length === 1);
            const msg = view.model.messages.at(0);
            expect(msg.get('stanza_id')).toBeUndefined();
            expect(msg.get('origin_id')).toBe(msg.get('origin_id'));

            const stanza = u.toStanza(`
                <message xmlns="jabber:client"
                         from="room@muc.example.com/romeo"
                         to="${_converse.connection.jid}"
                         type="groupchat">
                    <body>Hello world</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                               id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                               by="room@muc.example.com"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${msg.get('origin_id')}"/>
                </message>`);
            spyOn(view.model, 'updateMessage').and.callThrough();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => view.model.updateMessage.calls.count() === 1);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('stanza_id room@muc.example.com')).toBe("5f3dbc5e-e1d3-4077-a492-693f3769c7ad");
            expect(view.model.messages.at(0).get('origin_id')).toBe(msg.get('origin_id'));
            done();
        }));

        it("can cause a delivery receipt to be returned",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            const muc_jid = 'lounge@montague.lit';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);

            const msg_obj = view.model.messages.at(0);
            const stanza = u.toStanza(`
                <message xml:lang="en" to="romeo@montague.lit/orchard"
                         from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                    <received xmlns="urn:xmpp:receipts" id="${msg_obj.get('msgid')}"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="CE08D448-5ED8-4B6A-BB5B-07ED9DFE4FF0"/>
                </message>`);
            spyOn(_converse.api, "trigger").and.callThrough();
            spyOn(stanza_utils, "isReceipt").and.callThrough();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => stanza_utils.isReceipt.calls.count() === 1);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);
            expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
            done();
        }));

        it("can cause a chat marker to be returned",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current');
            const muc_jid = 'lounge@montague.lit';
            await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.api.chatviews.get(muc_jid);
            const textarea = view.el.querySelector('textarea.chat-textarea');
            textarea.value = 'But soft, what light through yonder airlock breaks?';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelector('.chat-msg .chat-msg__body').textContent.trim())
                .toBe("But soft, what light through yonder airlock breaks?");

            const msg_obj = view.model.messages.at(0);
            let stanza = u.toStanza(`
                <message xml:lang="en" to="romeo@montague.lit/orchard"
                         from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                    <received xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
                </message>`);
            const stanza_utils = converse.env.stanza_utils;
            spyOn(stanza_utils, "isChatMarker").and.callThrough();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => stanza_utils.isChatMarker.calls.count() === 1);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);

            stanza = u.toStanza(`
                <message xml:lang="en" to="romeo@montague.lit/orchard"
                         from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                    <displayed xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => stanza_utils.isChatMarker.calls.count() === 2);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);

            stanza = u.toStanza(`
                <message xml:lang="en" to="romeo@montague.lit/orchard"
                         from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                    <acknowledged xmlns="urn:xmpp:chat-markers:0" id="${msg_obj.get('msgid')}"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));

            await u.waitUntil(() => stanza_utils.isChatMarker.calls.count() === 3);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);

            stanza = u.toStanza(`
                <message xml:lang="en" to="romeo@montague.lit/orchard"
                         from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                    <body>'tis I!</body>
                    <markable xmlns="urn:xmpp:chat-markers:0"/>
                </message>`);
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            await u.waitUntil(() => stanza_utils.isChatMarker.calls.count() === 4);
            expect(view.el.querySelectorAll('.chat-msg').length).toBe(2);
            expect(view.el.querySelectorAll('.chat-msg__receipt').length).toBe(0);
            done();
        }));

        describe("when received", function () {

            it("highlights all users mentioned via XEP-0372 references",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'tom');
                const view = _converse.api.chatviews.get(muc_jid);
                ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh'].forEach((nick) => {
                    _converse.connection._dataRecv(test_utils.createRequest(
                        $pres({
                            'to': 'tom@montague.lit/resource',
                            'from': `lounge@montague.lit/${nick}`
                        })
                        .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': `${nick}@montague.lit/resource`,
                            'role': 'participant'
                        }))
                    );
                });
                const msg = $msg({
                        from: 'lounge@montague.lit/gibson',
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').t('hello z3r0 tom mr.robot, how are you?').up()
                        .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'6', 'end':'10', 'type':'mention', 'uri':'xmpp:z3r0@montague.lit'}).up()
                        .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'11', 'end':'14', 'type':'mention', 'uri':'xmpp:romeo@montague.lit'}).up()
                        .c('reference', {'xmlns':'urn:xmpp:reference:0', 'begin':'15', 'end':'23', 'type':'mention', 'uri':'xmpp:mr.robot@montague.lit'}).nodeTree;
                await view.model.onMessage(msg);
                const messages = view.el.querySelectorAll('.chat-msg__text');
                expect(messages.length).toBe(1);
                expect(messages[0].classList.length).toEqual(1);
                expect(messages[0].innerHTML).toBe(
                    'hello <span class="mention">z3r0</span> '+
                    '<span class="mention mention--self badge badge-info">tom</span> '+
                    '<span class="mention">mr.robot</span>, how are you?');
                done();
            }));
        });

        describe("in which someone is mentioned", function () {

            it("gets parsed for mentions which get turned into references",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'tom');
                const view = _converse.api.chatviews.get(muc_jid);
                ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh', 'Link Mauve'].forEach((nick) => {
                    _converse.connection._dataRecv(test_utils.createRequest(
                        $pres({
                            'to': 'tom@montague.lit/resource',
                            'from': `lounge@montague.lit/${nick}`
                        })
                        .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': `${nick.replace(/\s/g, '-')}@montague.lit/resource`,
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
                    .toBe('[{"begin":6,"end":10,"value":"z3r0","type":"mention","uri":"xmpp:z3r0@montague.lit"}]');

                [text, references] = view.model.parseTextForReferences('hello @some1 @z3r0 @gibson @mr.robot, how are you?')
                expect(text).toBe('hello @some1 z3r0 gibson mr.robot, how are you?');
                expect(JSON.stringify(references))
                    .toBe('[{"begin":13,"end":17,"value":"z3r0","type":"mention","uri":"xmpp:z3r0@montague.lit"},'+
                            '{"begin":18,"end":24,"value":"gibson","type":"mention","uri":"xmpp:gibson@montague.lit"},'+
                            '{"begin":25,"end":33,"value":"mr.robot","type":"mention","uri":"xmpp:mr.robot@montague.lit"}]');

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
                    .toBe('[{"begin":0,"end":6,"value":"gibson","type":"mention","uri":"xmpp:gibson@montague.lit"}]');

                [text, references] = view.model.parseTextForReferences('hi @Link Mauve how are you?')
                expect(text).toBe('hi Link Mauve how are you?');
                expect(references.length).toBe(1);
                expect(JSON.stringify(references))
                    .toBe('[{"begin":3,"end":13,"value":"Link Mauve","type":"mention","uri":"xmpp:Link-Mauve@montague.lit"}]');

                [text, references] = view.model.parseTextForReferences('https://example.org/@gibson')
                expect(text).toBe('https://example.org/@gibson');
                expect(references.length).toBe(0);
                expect(JSON.stringify(references))
                    .toBe('[]');

                [text, references] = view.model.parseTextForReferences('mail@gibson.com')
                expect(text).toBe('mail@gibson.com');
                expect(references.length).toBe(0);
                expect(JSON.stringify(references))
                    .toBe('[]');

                [text, references] = view.model.parseTextForReferences(
                    'https://linkmauve.fr@Link Mauve/ https://linkmauve.fr/@github/is_back gibson@gibson.com gibson@Link Mauve.fr')
                expect(text).toBe(
                    'https://linkmauve.fr@Link Mauve/ https://linkmauve.fr/@github/is_back gibson@gibson.com gibson@Link Mauve.fr');
                expect(references.length).toBe(0);
                expect(JSON.stringify(references))
                    .toBe('[]');
                done();
            }));

            it("parses for mentions as indicated with an @ preceded by a space or at the start of the text",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'tom');
                const view = _converse.api.chatviews.get(muc_jid);
                ['NotAnAdress', 'darnuria'].forEach((nick) => {
                    _converse.connection._dataRecv(test_utils.createRequest(
                        $pres({
                            'to': 'tom@montague.lit/resource',
                            'from': `lounge@montague.lit/${nick}`
                        })
                        .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': `${nick.replace(/\s/g, '-')}@montague.lit/resource`,
                            'role': 'participant'
                        })));
                });

                // Test that we don't match @nick in email adresses.
                let [text, references] = view.model.parseTextForReferences('contact contact@NotAnAdress.eu');
                expect(references.length).toBe(0);
                expect(text).toBe('contact contact@NotAnAdress.eu');

                // Test that we don't match @nick in url
                [text, references] = view.model.parseTextForReferences('nice website https://darnuria.eu/@darnuria');
                expect(references.length).toBe(0);
                expect(text).toBe('nice website https://darnuria.eu/@darnuria');
                done();
            }));


            it("properly encodes the URIs in sent out references",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'tom');
                const view = _converse.api.roomviews.get(muc_jid);
                _converse.connection._dataRecv(test_utils.createRequest(
                    $pres({
                        'to': 'tom@montague.lit/resource',
                        'from': `lounge@montague.lit/Link Mauve`
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'role': 'participant'
                    })));

                const textarea = view.el.querySelector('textarea.chat-textarea');
                textarea.value = 'hello @Link Mauve'
                const enter_event = {
                    'target': textarea,
                    'preventDefault': function preventDefault () {},
                    'stopPropagation': function stopPropagation () {},
                    'keyCode': 13 // Enter
                }
                spyOn(_converse.connection, 'send');
                view.onKeyDown(enter_event);
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                const msg = _converse.connection.send.calls.all()[0].args[0];
                expect(msg.toLocaleString())
                    .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.nodeTree.getAttribute("id")}" `+
                            `to="lounge@montague.lit" type="groupchat" `+
                            `xmlns="jabber:client">`+
                                `<body>hello Link Mauve</body>`+
                                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<reference begin="6" end="16" type="mention" uri="xmpp:lounge@montague.lit/Link%20Mauve" xmlns="urn:xmpp:reference:0"/>`+
                                `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                            `</message>`);
                done();
            }));

            it("can get corrected and given new references",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'tom');
                const view = _converse.api.chatviews.get(muc_jid);
                ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh'].forEach((nick) => {
                    _converse.connection._dataRecv(test_utils.createRequest(
                        $pres({
                            'to': 'tom@montague.lit/resource',
                            'from': `lounge@montague.lit/${nick}`
                        })
                        .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': `${nick}@montague.lit/resource`,
                            'role': 'participant'
                        })));
                });

                const textarea = view.el.querySelector('textarea.chat-textarea');
                textarea.value = 'hello @z3r0 @gibson @mr.robot, how are you?'
                const enter_event = {
                    'target': textarea,
                    'preventDefault': function preventDefault () {},
                    'stopPropagation': function stopPropagation () {},
                    'keyCode': 13 // Enter
                }
                spyOn(_converse.connection, 'send');
                view.onKeyDown(enter_event);
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                const msg = _converse.connection.send.calls.all()[0].args[0];
                expect(msg.toLocaleString())
                    .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.nodeTree.getAttribute("id")}" `+
                            `to="lounge@montague.lit" type="groupchat" `+
                            `xmlns="jabber:client">`+
                                `<body>hello z3r0 gibson mr.robot, how are you?</body>`+
                                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                                `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                                `<reference begin="18" end="26" type="mention" uri="xmpp:mr.robot@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                                `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                            `</message>`);

                const action = view.el.querySelector('.chat-msg .chat-msg__action');
                action.style.opacity = 1;
                action.click();

                expect(textarea.value).toBe('hello @z3r0 @gibson @mr.robot, how are you?');
                expect(view.model.messages.at(0).get('correcting')).toBe(true);
                expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
                await u.waitUntil(() => u.hasClass('correcting', view.el.querySelector('.chat-msg')), 500);

                textarea.value = 'hello @z3r0 @gibson @sw0rdf1sh, how are you?';
                view.onKeyDown(enter_event);
                await u.waitUntil(() => view.el.querySelector('.chat-msg__text').textContent ===
                    'hello z3r0 gibson sw0rdf1sh, how are you?', 500);

                const correction = _converse.connection.send.calls.all()[2].args[0];
                expect(correction.toLocaleString())
                    .toBe(`<message from="romeo@montague.lit/orchard" id="${correction.nodeTree.getAttribute("id")}" `+
                            `to="lounge@montague.lit" type="groupchat" `+
                            `xmlns="jabber:client">`+
                                `<body>hello z3r0 gibson sw0rdf1sh, how are you?</body>`+
                                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                                `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                                `<reference begin="18" end="27" type="mention" uri="xmpp:sw0rdf1sh@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                                `<replace id="${msg.nodeTree.getAttribute("id")}" xmlns="urn:xmpp:message-correct:0"/>`+
                                `<origin-id id="${correction.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                            `</message>`);
                done();
            }));

            it("includes XEP-0372 references to that person",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                        async function (done, _converse) {

                const muc_jid = 'lounge@montague.lit';
                await test_utils.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
                const view = _converse.api.chatviews.get(muc_jid);
                ['z3r0', 'mr.robot', 'gibson', 'sw0rdf1sh'].forEach((nick) => {
                    _converse.connection._dataRecv(test_utils.createRequest(
                        $pres({
                            'to': 'tom@montague.lit/resource',
                            'from': `lounge@montague.lit/${nick}`
                        })
                        .c('x', {xmlns: Strophe.NS.MUC_USER})
                        .c('item', {
                            'affiliation': 'none',
                            'jid': `${nick}@montague.lit/resource`,
                            'role': 'participant'
                        })));
                });

                spyOn(_converse.connection, 'send');
                const textarea = view.el.querySelector('textarea.chat-textarea');
                textarea.value = 'hello @z3r0 @gibson @mr.robot, how are you?'
                const enter_event = {
                    'target': textarea,
                    'preventDefault': function preventDefault () {},
                    'stopPropagation': function stopPropagation () {},
                    'keyCode': 13 // Enter
                }
                view.onKeyDown(enter_event);

                const msg = _converse.connection.send.calls.all()[0].args[0];
                expect(msg.toLocaleString())
                    .toBe(`<message from="romeo@montague.lit/orchard" id="${msg.nodeTree.getAttribute("id")}" `+
                            `to="lounge@montague.lit" type="groupchat" `+
                            `xmlns="jabber:client">`+
                                `<body>hello z3r0 gibson mr.robot, how are you?</body>`+
                                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<reference begin="6" end="10" type="mention" uri="xmpp:z3r0@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                                `<reference begin="11" end="17" type="mention" uri="xmpp:gibson@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                                `<reference begin="18" end="26" type="mention" uri="xmpp:mr.robot@montague.lit" xmlns="urn:xmpp:reference:0"/>`+
                                `<origin-id id="${msg.nodeTree.querySelector('origin-id').getAttribute("id")}" xmlns="urn:xmpp:sid:0"/>`+
                            `</message>`);
                done();
            }));
        });
    });
}));
