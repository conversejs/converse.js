/*global mock, converse */

const { Promise, Strophe, $msg, $pres, sizzle,u } = converse.env;
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

        view.model.sendMessage({'body': 'hello world'});
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

    it("will be shown as received upon MUC reflection",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const nick = 'romeo';
        const muc_jid = 'lounge@montague.lit';
        const features = [...mock.default_muc_features, Strophe.NS.OCCUPANTID];
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick, features);
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
                <occupant-id xmlns="urn:xmpp:occupant-id:0" id="dd72603deec90a38ba552f7c68cbcc61bca202cd" />
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
        expect(message.get('occupant_id')).toBe('dd72603deec90a38ba552f7c68cbcc61bca202cd');
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
