/*global mock, converse */

const { Promise, Strophe, $msg, $pres, sizzle } = converse.env;
const u = converse.env.utils;
const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

describe("A Groupchat Message", function () {

    beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000));
    afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

    describe("which is succeeded by an error message", function () {

        it("will have the error displayed below it",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = 'hello world'
            const enter_event = {
                'target': textarea,
                'preventDefault': function preventDefault () {},
                'stopPropagation': function stopPropagation () {},
                'keyCode': 13 // Enter
            }
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown(enter_event);
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            const msg = view.model.messages.at(0);
            const err_msg_text = "Message rejected because you're sending messages too quickly";
            const error = u.toStanza(`
                <message xmlns="jabber:client" id="${msg.get('msgid')}" from="${muc_jid}" to="${_converse.jid}" type="error">
                    <error type="wait">
                        <policy-violation xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        <text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">${err_msg_text}</text>
                    </error>
                    <body>hello world</body>
                </message>
            `);
            _converse.connection._dataRecv(mock.createRequest(error));
            expect(await u.waitUntil(() => view.querySelector('.chat-msg__error')?.textContent?.trim())).toBe(err_msg_text);
            expect(view.model.messages.length).toBe(1);
            const message = view.model.messages.at(0);
            expect(message.get('received')).toBeUndefined();
            expect(message.get('body')).toBe('hello world');
            expect(message.get('error_text')).toBe(err_msg_text);
            expect(message.get('editable')).toBe(false);
        }));
    });


    describe("an info message", function () {

        it("is not rendered as a followup message",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const nick = 'romeo';
            await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
            const view = _converse.chatboxviews.get(muc_jid);
            let presence = u.toStanza(`
                <presence xmlns="jabber:client" to="${_converse.jid}" from="${muc_jid}/romeo">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <status code="201"/>
                        <item role="moderator" affiliation="owner" jid="${_converse.jid}"/>
                        <status code="110"/>
                    </x>
                </presence>
            `);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 1);

            presence = u.toStanza(`
                <presence xmlns="jabber:client" to="${_converse.jid}" from="${muc_jid}/romeo1">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <status code="210"/>
                        <item role="moderator" affiliation="owner" jid="${_converse.jid}"/>
                        <status code="110"/>
                    </x>
                </presence>
            `);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 2);

            const messages = view.querySelectorAll('.chat-info');
            expect(u.hasClass('chat-msg--followup', messages[0])).toBe(false);
            expect(u.hasClass('chat-msg--followup', messages[1])).toBe(false);
        }));

        it("is not shown if its a duplicate",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            const presence = u.toStanza(`
                <presence xmlns="jabber:client" to="${_converse.jid}" from="${muc_jid}/romeo">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <status code="201"/>
                        <item role="moderator" affiliation="owner" jid="${_converse.jid}"/>
                        <status code="110"/>
                    </x>
                </presence>
            `);
            // XXX: We wait for createInfoMessages to complete, if we don't
            // we still get two info messages due to messages
            // created from presences not being queued and run
            // sequentially (i.e. by waiting for promises to resolve)
            // like we do with message stanzas.
            spyOn(view.model, 'createInfoMessages').and.callThrough();
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.model.createInfoMessages.calls.count());
            await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 1);

            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.model.createInfoMessages.calls.count() === 2);
            expect(view.querySelectorAll('.chat-info').length).toBe(1);
        }));
    });


    it("is rejected if it's an unencapsulated forwarded message",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
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
        const view = _converse.chatboxviews.get(muc_jid);
        spyOn(view.model, 'onMessage').and.callThrough();
        spyOn(converse.env.log, 'error');
        _converse.connection._dataRecv(mock.createRequest(received_stanza));
        await u.waitUntil(() => view.model.onMessage.calls.count() === 1);
        expect(converse.env.log.error).toHaveBeenCalledWith(
            `Ignoring unencapsulated forwarded message from ${muc_jid}/mallory`
        );
        expect(view.querySelectorAll('.chat-msg').length).toBe(0);
        expect(view.model.messages.length).toBe(0);
    }));

    it("can contain a chat state notification and will still be shown",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        if (!view.querySelectorAll('.chat-area').length) { view.renderChatArea(); }
        const message = 'romeo: Your attention is required';
        const nick = mock.chatroom_names[0],
            msg = $msg({
                from: 'lounge@montague.lit/'+nick,
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t(message)
              .c('active', {'xmlns': "http://jabber.org/protocol/chatstates"})
              .tree();
        await view.model.handleMessageStanza(msg);
        const el = await u.waitUntil(() => view.querySelector('.chat-msg__text'));
        expect(el.textContent).toBe(message);
    }));

    it("can not be expected to have a unique id attribute",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        if (!view.querySelectorAll('.chat-area').length) { view.renderChatArea(); }
        const id = u.getUniqueId();
        let msg = $msg({
                from: 'lounge@montague.lit/some1',
                id: id,
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('First message').tree();
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

        msg = $msg({
                from: 'lounge@montague.lit/some2',
                id: id,
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('Another message').tree();
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);
        expect(view.model.messages.length).toBe(2);
    }));

    it("is ignored if it has the same archive-id of an already received one",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'room@muc.example.com';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
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
        _converse.connection._dataRecv(mock.createRequest(stanza));
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
        _converse.handleMAMResult(view.model, { 'messages': [stanza] });
        await u.waitUntil(() => view.model.getDuplicateMessage.calls.count() === 2);
        result = await view.model.getDuplicateMessage.calls.all()[1].returnValue;
        expect(result instanceof _converse.Message).toBe(true);
        expect(view.model.messages.length).toBe(1);
        await u.waitUntil(() => view.model.updateMessage.calls.count());
    }));

    it("is ignored if it has the same stanza-id of an already received one",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'room@muc.example.com';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
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
        _converse.connection._dataRecv(mock.createRequest(stanza));
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
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.model.getDuplicateMessage.calls.count());
        result = await view.model.getDuplicateMessage.calls.all()[0].returnValue;
        expect(result instanceof _converse.Message).toBe(true);
        expect(view.model.messages.length).toBe(1);
        await u.waitUntil(() => view.model.updateMessage.calls.count());
    }));

    it("will be discarded if it's a malicious message meant to look like a carbon copy",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        const muc_jid = 'xsf@muc.xmpp.org';
        const sender_jid = `${muc_jid}/romeo`;
        const impersonated_jid = `${muc_jid}/i_am_groot`
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const stanza = $pres({
                to: 'romeo@montague.lit/_converse.js-29092160',
                from: sender_jid
            })
            .c('x', {xmlns: Strophe.NS.MUC_USER})
            .c('item', {
                'affiliation': 'owner',
                'jid': 'newguy@montague.lit/_converse.js-290929789',
                'role': 'participant'
            }).tree();
        _converse.connection._dataRecv(mock.createRequest(stanza));
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
        const view = _converse.chatboxviews.get(muc_jid);
        spyOn(converse.env.log, 'error');
        await _converse.handleMAMResult(view.model, { 'messages': [msg] });
        await u.waitUntil(() => converse.env.log.error.calls.count());
        expect(converse.env.log.error).toHaveBeenCalledWith(
            'Invalid Stanza: MUC messages SHOULD NOT be XEP-0280 carbon copied'
        );
        expect(view.querySelectorAll('.chat-msg').length).toBe(0);
        expect(view.model.messages.length).toBe(0);
    }));

    it("keeps track of the sender's role and affiliation",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        let msg = $msg({
            from: 'lounge@montague.lit/romeo',
            id: u.getUniqueId(),
            to: 'romeo@montague.lit',
            type: 'groupchat'
        }).c('body').t('I wrote this message!').tree();
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length);
        expect(view.model.messages.last().occupant.get('affiliation')).toBe('owner');
        expect(view.model.messages.last().occupant.get('role')).toBe('moderator');
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        expect(sizzle('.chat-msg', view).pop().classList.value.trim()).toBe('message chat-msg groupchat chat-msg--with-avatar moderator owner');
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
        _converse.connection._dataRecv(mock.createRequest(presence));

        await u.waitUntil(() => view.model.messages.length === 4);

        msg = $msg({
            from: 'lounge@montague.lit/romeo',
            id: u.getUniqueId(),
            to: 'romeo@montague.lit',
            type: 'groupchat'
        }).c('body').t('Another message!').tree();
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);
        expect(view.model.messages.last().occupant.get('affiliation')).toBe('member');
        expect(view.model.messages.last().occupant.get('role')).toBe('participant');
        expect(sizzle('.chat-msg', view).pop().classList.value.trim()).toBe('message chat-msg groupchat chat-msg--with-avatar participant member');

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
        _converse.connection._dataRecv(mock.createRequest(presence));

        view.model.sendMessage('hello world');
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 3);

        const occupant = await u.waitUntil(() => view.model.messages.filter(m => m.get('type') === 'groupchat')[2].occupant);
        expect(occupant.get('affiliation')).toBe('owner');
        expect(occupant.get('role')).toBe('moderator');
        expect(view.querySelectorAll('.chat-msg').length).toBe(3);
        await u.waitUntil(() => sizzle('.chat-msg', view).pop().classList.value.trim() === 'message chat-msg groupchat chat-msg--with-avatar moderator owner');

        const add_events = view.model.occupants._events.add.length;
        msg = $msg({
            from: 'lounge@montague.lit/some1',
            id: u.getUniqueId(),
            to: 'romeo@montague.lit',
            type: 'groupchat'
        }).c('body').t('Message from someone not in the MUC right now').tree();
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 4);
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
        _converse.connection._dataRecv(mock.createRequest(presence));
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
        _converse.connection._dataRecv(mock.createRequest(presence));
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
        _converse.connection._dataRecv(mock.createRequest(presence));
        await u.waitUntil(() => view.model.messages.last().occupant);
        expect(view.model.messages.last().get('message')).toBe('Message from someone not in the MUC right now');
        expect(view.model.messages.last().occupant.get('nick')).toBe('some1');
        // Check that the "add" event handler was removed.
        expect(view.model.occupants._events.add.length).toBe(add_events);
    }));


    it("keeps track whether you are the sender or not",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        const msg = $msg({
                from: 'lounge@montague.lit/romeo',
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t('I wrote this message!').tree();
        await view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.model.messages.last()?.get('received'));
        expect(view.model.messages.last().get('sender')).toBe('me');
    }));

    it("will be shown as received upon MUC reflection",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        textarea.value = 'But soft, what light through yonder airlock breaks?';
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.querySelectorAll('.chat-msg__body.chat-msg__body--received').length).toBe(0);

        const msg_obj = view.model.messages.at(0);
        const stanza = u.toStanza(`
            <message xmlns="jabber:client"
                     from="${msg_obj.get('from')}"
                     to="${_converse.connection.jid}"
                     type="groupchat">
                <body>${msg_obj.get('message')}</body>
                <stanza-id xmlns="urn:xmpp:sid:0"
                           id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                           by="lounge@montague.lit"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="${msg_obj.get('origin_id')}"/>
            </message>`);
        await view.model.handleMessageStanza(stanza);
        await u.waitUntil(() => view.querySelectorAll('.chat-msg__body.chat-msg__body--received').length, 500);
        expect(view.querySelectorAll('.chat-msg__receipt').length).toBe(0);
        expect(view.querySelectorAll('.chat-msg__body.chat-msg__body--received').length).toBe(1);
        expect(view.model.messages.length).toBe(1);

        const message = view.model.messages.at(0);
        expect(message.get('stanza_id lounge@montague.lit')).toBe('5f3dbc5e-e1d3-4077-a492-693f3769c7ad');
        expect(message.get('origin_id')).toBe(msg_obj.get('origin_id'));
    }));

    it("gets updated with its stanza-id upon MUC reflection",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'room@muc.example.com';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);

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
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.model.updateMessage.calls.count() === 1);
        expect(view.model.messages.length).toBe(1);
        expect(view.model.messages.at(0).get('stanza_id room@muc.example.com')).toBe("5f3dbc5e-e1d3-4077-a492-693f3769c7ad");
        expect(view.model.messages.at(0).get('origin_id')).toBe(msg.get('origin_id'));
    }));

    it("can cause a delivery receipt to be returned",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const muc_jid = 'lounge@montague.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
        textarea.value = 'But soft, what light through yonder airlock breaks?';
        const message_form = view.querySelector('converse-muc-message-form');
        message_form.onKeyDown({
            target: textarea,
            preventDefault: function preventDefault () {},
            keyCode: 13 // Enter
        });
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);

        const msg_obj = view.model.messages.at(0);
        let stanza = u.toStanza(`
            <message xmlns="jabber:client"
                     from="${msg_obj.get('from')}"
                     to="${_converse.connection.jid}"
                     type="groupchat">
                <body>${msg_obj.get('message')}</body>
                <stanza-id xmlns="urn:xmpp:sid:0"
                           id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                           by="lounge@montague.lit"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="${msg_obj.get('origin_id')}"/>
            </message>`);
        await view.model.handleMessageStanza(stanza);
        await u.waitUntil(() => view.model.messages.last().get('received'));

        stanza = u.toStanza(`
            <message xml:lang="en" to="romeo@montague.lit/orchard"
                     from="lounge@montague.lit/some1" type="groupchat" xmlns="jabber:client">
                <received xmlns="urn:xmpp:receipts" id="${msg_obj.get('msgid')}"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="CE08D448-5ED8-4B6A-BB5B-07ED9DFE4FF0"/>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        expect(view.querySelectorAll('.chat-msg').length).toBe(1);
    }));
});
