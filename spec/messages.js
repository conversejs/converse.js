/*global mock, converse */

const { Promise, Strophe, $msg, dayjs, sizzle, _ } = converse.env;
const u = converse.env.utils;


describe("A Chat Message", function () {

    it("will be demarcated if it's the first newly received message",
        mock.initConverse(['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.api.chatviews.get(contact_jid);
        await _converse.handleMessageStanza(mock.createChatMessage(_converse, contact_jid, 'This message will be read'));
        const msg_el = await u.waitUntil(() => view.el.querySelector('converse-chat-message'));
        expect(msg_el.querySelector('.chat-msg__text').textContent).toBe('This message will be read');
        expect(view.model.get('num_unread')).toBe(0);

        _converse.windowState = 'hidden';
        await _converse.handleMessageStanza(mock.createChatMessage(_converse, contact_jid, 'This message will be new'));

        await u.waitUntil(() => view.model.messages.length);
        expect(view.model.get('num_unread')).toBe(1);
        expect(view.model.get('first_unread_id')).toBe(view.model.messages.last().get('id'));

        await u.waitUntil(() => view.el.querySelectorAll('converse-chat-message').length === 2);
        const last_msg_el = view.el.querySelector('converse-chat-message:last-child');
        expect(last_msg_el.firstElementChild?.textContent).toBe('New messages');
        done();
    }));


    it("is rejected if it's an unencapsulated forwarded message",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current', 2);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const forwarded_contact_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
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
        _converse.connection._dataRecv(mock.createRequest(received_stanza));
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

    it("can be received out of order, and will still be displayed in the right order",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);

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
        _converse.handleMessageStanza(msg);
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
        _converse.handleMessageStanza(msg);
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
        _converse.handleMessageStanza(msg);
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
        _converse.handleMessageStanza(msg);
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
        _converse.handleMessageStanza(msg);
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
        _converse.handleMessageStanza(msg);
        const csntext = await u.waitUntil(() => view.el.querySelector('.chat-content__notifications').textContent);
        expect(csntext.trim()).toEqual('Mercutio is typing');

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

        view.clearSpinner(); //cleanup
        expect(view.content.querySelectorAll('.date-separator').length).toEqual(4);

        let day = sizzle('.date-separator:first', view.content).pop();
        expect(day.getAttribute('data-isodate')).toEqual(dayjs('2017-12-31T00:00:00').toISOString());

        let time = sizzle('time:first', view.content).pop();
        expect(time.textContent).toEqual('Sunday Dec 31st 2017')

        day = sizzle('.date-separator:first', view.content).pop();
        expect(day.nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('Older message');

        let el = sizzle('.chat-msg:first', view.content).pop().querySelector('.chat-msg__text')
        expect(u.hasClass('chat-msg--followup', el)).toBe(false);
        expect(el.textContent).toEqual('Older message');

        time = sizzle('time.separator-text:eq(1)', view.content).pop();
        expect(time.textContent).toEqual("Monday Jan 1st 2018");

        day = sizzle('.date-separator:eq(1)', view.content).pop();
        expect(day.getAttribute('data-isodate')).toEqual(dayjs('2018-01-01T00:00:00').toISOString());
        expect(day.nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('Inbetween message');

        el = sizzle('.chat-msg:eq(1)', view.content).pop();
        expect(el.querySelector('.chat-msg__text').textContent).toEqual('Inbetween message');
        expect(el.parentElement.nextElementSibling.querySelector('.chat-msg__text').textContent).toEqual('another inbetween message');
        el = sizzle('.chat-msg:eq(2)', view.content).pop();
        expect(el.querySelector('.chat-msg__text').textContent)
            .toEqual('another inbetween message');
        expect(u.hasClass('chat-msg--followup', el)).toBe(true);

        time = sizzle('time.separator-text:nth(2)', view.content).pop();
        expect(time.textContent).toEqual("Tuesday Jan 2nd 2018");

        day = sizzle('.date-separator:nth(2)', view.content).pop();
        expect(day.getAttribute('data-isodate')).toEqual(dayjs('2018-01-02T00:00:00').toISOString());
        expect(day.nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('An earlier message on the next day');

        el = sizzle('.chat-msg:eq(3)', view.content).pop();
        expect(el.querySelector('.chat-msg__text').textContent).toEqual('An earlier message on the next day');
        expect(u.hasClass('chat-msg--followup', el)).toBe(false);

        el = sizzle('.chat-msg:eq(4)', view.content).pop();
        expect(el.querySelector('.chat-msg__text').textContent).toEqual('message');
        expect(el.parentElement.nextElementSibling.querySelector('.chat-msg__text').textContent).toEqual('newer message from the next day');
        expect(u.hasClass('chat-msg--followup', el)).toBe(false);

        day = sizzle('.date-separator:last', view.content).pop();
        expect(day.getAttribute('data-isodate')).toEqual(dayjs().startOf('day').toISOString());
        expect(day.nextElementSibling.querySelector('.chat-msg__text').textContent).toBe('latest message');
        expect(u.hasClass('chat-msg--followup', el)).toBe(false);
        done();
    }));

    it("is ignored if it's a malformed headline message",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);

        // Ideally we wouldn't have to filter out headline
        // messages, but Prosody gives them the wrong 'type' :(
        spyOn(converse.env.log, 'info');
        sinon.spy(_converse.api.chatboxes, 'get');
        const msg = $msg({
                from: 'montague.lit',
                to: _converse.bare_jid,
                type: 'chat',
                id: u.getUniqueId()
            }).c('body').t("This headline message will not be shown").tree();
        await _converse.handleMessageStanza(msg);
        expect(converse.env.log.info).toHaveBeenCalledWith(
            "handleMessageStanza: Ignoring incoming server message from JID: montague.lit"
        );
        expect(_converse.api.chatboxes.get.called).toBeFalsy();
        // Remove sinon spies
        _converse.api.chatboxes.get.restore();
        done();
    }));


    it("can be a carbon message, as defined in XEP-0280",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        const include_nick = false;
        await mock.waitForRoster(_converse, 'current', 2, include_nick);
        await mock.openControlBox(_converse);

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
        await u.waitUntil(() => chatbox.messages.length);
        const msg_obj = chatbox.messages.models[0];
        expect(msg_obj.get('message')).toEqual(msgtext);
        expect(msg_obj.get('fullname')).toBeUndefined();
        expect(msg_obj.get('nickname')).toBe(null);
        expect(msg_obj.get('sender')).toEqual('them');
        expect(msg_obj.get('is_delayed')).toEqual(false);
        // Now check that the message appears inside the chatbox in the DOM
        await u.waitUntil(() => view.content.querySelector('.chat-msg .chat-msg__text'));

        expect(view.content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(msgtext);
        expect(view.content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
        await u.waitUntil(() => chatbox.vcard.get('fullname') === 'Juliet Capulet')
        expect(view.content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Juliet Capulet');
        done();
    }));

    it("can be a carbon message that this user sent from a different client, as defined in XEP-0280",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        await mock.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);

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
        const msg_el = await u.waitUntil(() => view.el.querySelector('.chat-content .chat-msg .chat-msg__text'));
        expect(msg_el.textContent).toEqual(msgtext);
        done();
    }));

    it("will be discarded if it's a malicious message meant to look like a carbon copy",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
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

    it("will indicate when it has a time difference of more than a day between it and its predecessor",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        const include_nick = false;
        await mock.waitForRoster(_converse, 'current', 2, include_nick);
        await mock.openControlBox(_converse);
        spyOn(_converse.api, "trigger").and.callThrough();
        const contact_name = mock.cur_names[1];
        const contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@montague.lit';

        await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
        await mock.openChatBoxFor(_converse, contact_jid);

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
        expect(view.msgs_container.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(message);
        expect(view.msgs_container.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
        expect(view.msgs_container.querySelector('span.chat-msg__author').textContent.trim()).toBe('Juliet Capulet');

        expect(view.msgs_container.querySelectorAll('.date-separator').length).toEqual(1);
        let day = view.msgs_container.querySelector('.date-separator');
        expect(day.getAttribute('class')).toEqual('message date-separator');
        expect(day.getAttribute('data-isodate')).toEqual(dayjs(one_day_ago.startOf('day')).toISOString());

        let time = view.msgs_container.querySelector('time.separator-text');
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
        expect(view.msgs_container.querySelectorAll('time.separator-text').length).toEqual(2); // There are now two time elements

        const message_date = new Date();
        day = sizzle('.date-separator:last', view.msgs_container);
        expect(day.length).toEqual(1);
        expect(day[0].getAttribute('class')).toEqual('message date-separator');
        expect(day[0].getAttribute('data-isodate')).toEqual(dayjs(message_date).startOf('day').toISOString());

        time = sizzle('time.separator-text:last', view.msgs_container).pop();
        expect(time.textContent).toEqual(dayjs(message_date).startOf('day').format("dddd MMM Do YYYY"));

        // Normal checks for the 2nd message
        expect(chatbox.messages.length).toEqual(2);
        msg_obj = chatbox.messages.models[1];
        expect(msg_obj.get('message')).toEqual(message);
        expect(msg_obj.get('fullname')).toBeUndefined();
        expect(msg_obj.get('sender')).toEqual('them');
        expect(msg_obj.get('is_delayed')).toEqual(false);
        const msg_txt = sizzle('.chat-msg:last .chat-msg__text', view.msgs_container).pop().textContent;
        expect(msg_txt).toEqual(message);

        expect(view.msgs_container.querySelector('converse-chat-message:last-child .chat-msg__text').textContent).toEqual(message);
        expect(view.msgs_container.querySelector('converse-chat-message:last-child .chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
        expect(view.msgs_container.querySelector('converse-chat-message:last-child .chat-msg__author').textContent.trim()).toBe('Juliet Capulet');
        done();
    }));

    it("is sanitized to prevent Javascript injection attacks",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)
        const view = _converse.api.chatviews.get(contact_jid);
        const message = '<p>This message contains <em>some</em> <b>markup</b></p>';
        spyOn(view.model, 'sendMessage').and.callThrough();
        await mock.sendMessage(view, message);
        expect(view.model.sendMessage).toHaveBeenCalled();
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
        expect(msg.textContent).toEqual(message);
        expect(msg.innerHTML.replace(/<!---->/g, '')).toEqual('&lt;p&gt;This message contains &lt;em&gt;some&lt;/em&gt; &lt;b&gt;markup&lt;/b&gt;&lt;/p&gt;');
        done();
    }));

    it("can contain hyperlinks, which will be clickable",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)
        const view = _converse.api.chatviews.get(contact_jid);
        const message = 'This message contains a hyperlink: www.opkode.com';
        spyOn(view.model, 'sendMessage').and.callThrough();
        mock.sendMessage(view, message);
        expect(view.model.sendMessage).toHaveBeenCalled();
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
        expect(msg.textContent).toEqual(message);
        await u.waitUntil(() => msg.innerHTML.replace(/<!---->/g, '') ===
            'This message contains a hyperlink: <a target="_blank" rel="noopener" href="http://www.opkode.com">www.opkode.com</a>');
        done();
    }));

    it("will remove url query parameters from hyperlinks as set",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'],
            {'filter_url_query_params': ['utm_medium', 'utm_content', 's']},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.api.chatviews.get(contact_jid);
        let message = 'This message contains a hyperlink with forbidden query params: https://www.opkode.com/?id=0&utm_content=1&utm_medium=2&s=1';
        mock.sendMessage(view, message);
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        let msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
        expect(msg.textContent).toEqual(message);
        await u.waitUntil(() => msg.innerHTML.replace(/<!---->/g, '') ===
            'This message contains a hyperlink with forbidden query params: <a target="_blank" rel="noopener" href="https://www.opkode.com/?id=0">https://www.opkode.com/?id=0</a>');

        // Test assigning a string to filter_url_query_params
        _converse.api.settings.set('filter_url_query_params', 'utm_medium');
        message = 'Another message with a hyperlink with forbidden query params: https://www.opkode.com/?id=0&utm_content=1&utm_medium=2&s=1';
        mock.sendMessage(view, message);
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
        expect(msg.textContent).toEqual(message);
        await u.waitUntil(() => msg.innerHTML.replace(/<!---->/g, '') ===
            'Another message with a hyperlink with forbidden query params: '+
            '<a target="_blank" rel="noopener" href="https://www.opkode.com/?id=0&amp;utm_content=1&amp;s=1">https://www.opkode.com/?id=0&amp;utm_content=1&amp;s=1</a>');
        done();
    }));

    it("will render newlines",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const view = await mock.openChatBoxFor(_converse, contact_jid);
        let stanza = u.toStanza(`
            <message from="${contact_jid}"
                     type="chat"
                     to="romeo@montague.lit/orchard">
                <body>Hey\nHave you heard the news?</body>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.content.querySelector('.chat-msg__text').innerHTML.replace(/<!---->/g, '')).toBe('Hey\nHave you heard the news?');
        stanza = u.toStanza(`
            <message from="${contact_jid}"
                     type="chat"
                     to="romeo@montague.lit/orchard">
                <body>Hey\n\n\nHave you heard the news?</body>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        await u.waitUntil(() => view.content.querySelector('converse-chat-message:last-child .chat-msg__text').innerHTML.replace(/<!---->/g, '') === 'Hey\n\nHave you heard the news?');
        stanza = u.toStanza(`
            <message from="${contact_jid}"
                     type="chat"
                     to="romeo@montague.lit/orchard">
                <body>Hey\nHave you heard\nthe news?</body>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await new Promise(resolve => view.model.messages.once('rendered', resolve));
        expect(view.content.querySelector('converse-chat-message:last-child .chat-msg__text').innerHTML.replace(/<!---->/g, '')).toBe('Hey\nHave you heard\nthe news?');
        done();
    }));

    it("will render images from their URLs",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        const base_url = 'https://conversejs.org';
        let message = base_url+"/logo/conversejs-filled.svg";
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.api.chatviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        mock.sendMessage(view, message);
        await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length, 1000)
        expect(view.model.sendMessage).toHaveBeenCalled();
        let msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.innerHTML.replace(/<!---->/g, '').trim()).toEqual(
            `<a class="chat-image__link" target="_blank" rel="noopener" href="${base_url}/logo/conversejs-filled.svg">`+
                `<img class="chat-image img-thumbnail" src="https://conversejs.org/logo/conversejs-filled.svg">`+
            `</a>`);

        message += "?param1=val1&param2=val2";
        mock.sendMessage(view, message);
        await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length === 2, 1000);
        expect(view.model.sendMessage).toHaveBeenCalled();
        msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.innerHTML.replace(/<!---->/g, '').trim()).toEqual(
            `<a class="chat-image__link" target="_blank" rel="noopener" href="${base_url}/logo/conversejs-filled.svg?param1=val1&amp;param2=val2">`+
                `<img class="chat-image img-thumbnail" src="${message.replace(/&/g, '&amp;')}">`+
            `</a>`);

        // Test now with two images in one message
        message += ' hello world '+base_url+"/logo/conversejs-filled.svg";
        mock.sendMessage(view, message);
        await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length === 4, 1000);
        expect(view.model.sendMessage).toHaveBeenCalled();
        msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        expect(msg.textContent.trim()).toEqual('hello world');
        expect(msg.querySelectorAll('img.chat-image').length).toEqual(2);

        // Configured image URLs are rendered
        _converse.api.settings.set('image_urls_regex', /^https?:\/\/(?:www.)?(?:imgur\.com\/\w{7})\/?$/i);
        message = 'https://imgur.com/oxymPax';
        mock.sendMessage(view, message);
        await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length === 5, 1000);
        expect(view.content.querySelectorAll('.chat-content .chat-image').length).toBe(5);

        // Check that the Imgur URL gets a .png attached to make it render
        await u.waitUntil(() => Array.from(view.el.querySelectorAll('.chat-content .chat-image')).pop().src.endsWith('png'), 1000);
        done();
    }));

    it("will render images from approved URLs only",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {'show_images_inline': ['conversejs.org']},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        const base_url = 'https://conversejs.org';
        let message = 'https://imgur.com/oxymPax.png';
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.api.chatviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        mock.sendMessage(view, message);
        await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg').length === 1);

        message = base_url+"/logo/conversejs-filled.svg";
        mock.sendMessage(view, message);
        await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg').length === 2, 1000);
        await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length === 1, 1000)
        expect(view.content.querySelectorAll('.chat-content .chat-image').length).toBe(1);

        done();
    }));

    it("will fall back to rendering images as URLs",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        const base_url = 'https://conversejs.org';
        const message = base_url+"/logo/non-existing.svg";
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.api.chatviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        mock.sendMessage(view, message);
        await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-image').length, 1000)
        expect(view.model.sendMessage).toHaveBeenCalled();
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text').pop();
        await u.waitUntil(() => msg.innerHTML.replace(/<!---->/g, '').trim() ==
            `<a target="_blank" rel="noopener" href="https://conversejs.org/logo/non-existing.svg">https://conversejs.org/logo/non-existing.svg</a>`, 1000);
        done();
    }));

    it("will render the message time as configured",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        _converse.time_format = 'hh:mm';
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)
        const view = _converse.api.chatviews.get(contact_jid);
        const message = 'This message is sent from this chatbox';
        await mock.sendMessage(view, message);

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
            ['rosterGroupsFetched'], {'debounced_content_rendering': false},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);

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
        await mock.sendMessage(view, "Another message within 10 minutes, but from a different person");

        expect(view.content.querySelectorAll('.message').length).toBe(6);
        expect(view.content.querySelectorAll('.chat-msg').length).toBe(5);

        const nth_child = (n) => `converse-chat-message:nth-child(${n}) .chat-msg`;
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(2)))).toBe(false);
        expect(view.content.querySelector(`${nth_child(2)} .chat-msg__text`).textContent).toBe("A message");

        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(3)))).toBe(true);
        expect(view.content.querySelector(`${nth_child(3)} .chat-msg__text`).textContent).toBe(
            "Another message 3 minutes later");
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(4)))).toBe(false);
        expect(view.content.querySelector(`${nth_child(4)} .chat-msg__text`).textContent).toBe(
            "Another message 14 minutes since we started");
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(5)))).toBe(true);
        expect(view.content.querySelector(`${nth_child(5)} .chat-msg__text`).textContent).toBe(
            "Another message 1 minute and 1 second since the previous one");
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(6)))).toBe(false);
        expect(view.content.querySelector(`${nth_child(6)} .chat-msg__text`).textContent).toBe(
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

        expect(view.content.querySelectorAll('.message').length).toBe(7);
        expect(view.content.querySelectorAll('.chat-msg').length).toBe(6);
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(2)))).toBe(false);
        expect(view.content.querySelector(`${nth_child(2)} .chat-msg__text`).textContent).toBe("A message");


        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(3)))).toBe(true);
        expect(view.content.querySelector(`${nth_child(3)} .chat-msg__text`).textContent).toBe(
            "Another message 3 minutes later");
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(4)))).toBe(true);
        expect(view.content.querySelector(`${nth_child(4)} .chat-msg__text`).textContent).toBe(
            "A delayed message, sent 5 minutes since we started");

        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(5)))).toBe(true);
        expect(view.content.querySelector(`${nth_child(5)} .chat-msg__text`).textContent).toBe(
            "Another message 14 minutes since we started");

        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(6)))).toBe(true);
        expect(view.content.querySelector(`${nth_child(6)} .chat-msg__text`).textContent).toBe(
            "Another message 1 minute and 1 second since the previous one");

        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(7)))).toBe(false);
        expect(view.content.querySelector(`${nth_child(7)} .chat-msg__text`).textContent).toBe(
            "Another message within 10 minutes, but from a different person");

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

        expect(view.content.querySelectorAll('.chat-msg').length).toBe(7);
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(2)))).toBe(false);
        expect(view.content.querySelector(`${nth_child(2)} .chat-msg__text`).textContent).toBe("A message");
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(3)))).toBe(true);
        expect(view.content.querySelector(`${nth_child(3)} .chat-msg__text`).textContent).toBe(
            "Another message 3 minutes later");
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(4)))).toBe(false);
        expect(view.content.querySelector(`${nth_child(4)} .chat-msg__text`).textContent).toBe(
            "A carbon message 4 minutes later");
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(5)))).toBe(false);
        expect(view.content.querySelector(`${nth_child(5)} .chat-msg__text`).textContent).toBe(
            "A delayed message, sent 5 minutes since we started");
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(6)))).toBe(true);
        expect(view.content.querySelector(`${nth_child(6)} .chat-msg__text`).textContent).toBe(
            "Another message 14 minutes since we started");
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(7)))).toBe(true);
        expect(view.content.querySelector(`${nth_child(7)} .chat-msg__text`).textContent).toBe(
            "Another message 1 minute and 1 second since the previous one");
        expect(u.hasClass('chat-msg--followup', view.content.querySelector(nth_child(8)))).toBe(false);
        expect(view.content.querySelector(`${nth_child(8)} .chat-msg__text`).textContent).toBe(
            "Another message within 10 minutes, but from a different person");

        jasmine.clock().uninstall();
        done();
    }));


    describe("when sent", function () {

        it("will appear inside the chatbox it was sent from",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);
            spyOn(_converse.api, "trigger").and.callThrough();
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);
            const message = 'This message is sent from this chatbox';
            spyOn(view.model, 'sendMessage').and.callThrough();
            await mock.sendMessage(view, message);
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

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);
            const message = '   \nThis message is sent from this chatbox \n     \n';
            await mock.sendMessage(view, message);
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
            await mock.waitForRoster(_converse, 'current', 1, include_nick);
            await mock.openControlBox(_converse);
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
            await u.waitUntil(() => chatbox.messages.length);
            expect(chatbox.messages.length).toEqual(1);
            const msg_obj = chatbox.messages.models[0];
            expect(msg_obj.get('message')).toEqual(message);
            expect(msg_obj.get('fullname')).toBeUndefined();
            expect(msg_obj.get('sender')).toEqual('them');
            expect(msg_obj.get('is_delayed')).toEqual(false);
            // Now check that the message appears inside the chatbox in the DOM
            const mel = await u.waitUntil(() => view.content.querySelector('.chat-msg .chat-msg__text'));
            expect(mel.textContent).toEqual(message);
            expect(view.content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
            await u.waitUntil(() => chatbox.vcard.get('fullname') === mock.cur_names[0]);
            expect(view.content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Mercutio');
            done();
        }));

        it("will be trimmed of leading and trailing whitespace",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1, false);
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
            await u.waitUntil(() => view.model.messages.length);
            expect(view.model.messages.length).toEqual(1);
            const msg_obj = view.model.messages.at(0);
            expect(msg_obj.get('message')).toEqual(message.trim());
            const mel = await u.waitUntil(() => view.content.querySelector('.chat-msg .chat-msg__text'));
            expect(mel.textContent).toEqual(message.trim());
            done();
        }));


        describe("when a chatbox is opened for someone who is not in the roster", function () {

            it("the VCard for that user is fetched and the chatbox updated with the results",
                mock.initConverse(
                    ['rosterGroupsFetched'], {'allow_non_roster_messaging': true},
                    async function (done, _converse) {

                await mock.waitForRoster(_converse, 'current', 0);
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
                const view = await u.waitUntil(() => _converse.api.chatviews.get(sender_jid));
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));

                // Check that the chatbox and its view now exist
                const chatbox = await _converse.api.chats.get(sender_jid);
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

                await mock.waitForRoster(_converse, 'current', 0);

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
                await _converse.handleMessageStanza(msg);
                let view = _converse.chatboxviews.get(sender_jid);
                expect(view).not.toBeDefined();

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
                expect(view.content.querySelector('.chat-msg .chat-msg__text').textContent).toEqual(message);
                expect(view.content.querySelector('.chat-msg__time').textContent.match(/^[0-9][0-9]:[0-9][0-9]/)).toBeTruthy();
                expect(view.content.querySelector('span.chat-msg__author').textContent.trim()).toBe('Mercutio');
                done();
            }));
        });


        describe("and for which then an error message is received from the server", function () {

            it("will have the error message displayed after itself",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await mock.waitForRoster(_converse, 'current', 1);

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
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await _converse.api.chats.open(sender_jid)
                let msg_text = 'This message will not be sent, due to an error';
                const view = _converse.api.chatviews.get(sender_jid);
                const message = await view.model.sendMessage(msg_text);
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                let msg_txt = sizzle('.chat-msg:last .chat-msg__text', view.content).pop().textContent;
                expect(msg_txt).toEqual(msg_text);

                // We send another message, for which an error will
                // not be received, to test that errors appear
                // after the relevant message.
                msg_text = 'This message will be sent, and also receive an error';
                const second_message = await view.model.sendMessage(msg_text);
                await u.waitUntil(() => sizzle('.chat-msg .chat-msg__text', view.content).length === 2, 1000);
                msg_txt = sizzle('.chat-msg:last .chat-msg__text', view.content).pop().textContent;
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
                _converse.connection._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => view.content.querySelector('.chat-msg__error').textContent.trim() === error_txt);

                const other_error_txt = 'Server-to-server connection failed: Connecting failed: connection timeout';
                stanza = $msg({
                        'to': _converse.connection.jid,
                        'type': 'error',
                        'id': second_message.get('id'),
                        'from': sender_jid
                    })
                    .c('error', {'type': 'cancel'})
                    .c('remote-server-not-found', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" }).up()
                    .c('text', { 'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas" })
                        .t(other_error_txt);
                _converse.connection._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() =>
                    view.content.querySelector('converse-chat-message:last-child .chat-msg__error').textContent.trim() === other_error_txt);

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
                _converse.connection._dataRecv(mock.createRequest(stanza));
                expect(view.content.querySelectorAll('.chat-msg__error').length).toEqual(2);

                msg_text = 'This message will be sent, and also receive an error';
                const third_message = await view.model.sendMessage(msg_text);
                await u.waitUntil(() => sizzle('converse-chat-message:last-child .chat-msg__text', view.content).pop()?.textContent === msg_text);

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
                _converse.connection._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => view.model.messages.length > 2);
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                expect(view.content.querySelectorAll('.chat-msg__error').length).toEqual(3);

                // Ensure messages with error are not editable
                document.querySelectorAll('.chat-msg__actions').forEach(elem => {
                    expect(elem.querySelector('.chat-msg__action-edit')).toBe(null)
                })
                view.model.messages.forEach(message => {
                    const isEditable = message.get('editable');
                    isEditable && expect(isEditable).toBe(false);
                })

                done();
            }));

            it("will not show to the user an error message for a CSI message",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                // See #1317
                // https://github.com/conversejs/converse.js/issues/1317
                await mock.waitForRoster(_converse, 'current');
                await mock.openControlBox(_converse);

                const contact_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);

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
                _converse.connection._dataRecv(mock.createRequest(stanza));
                const view = _converse.chatboxviews.get(contact_jid);
                const msg_text = 'This message will show!';
                await view.model.sendMessage(msg_text);
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                expect(view.content.querySelectorAll('.chat-error').length).toEqual(0);
                done();
            }));
        });


        it("will cause the chat area to be scrolled down only if it was at the bottom originally",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current');
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, sender_jid)
            const view = _converse.api.chatviews.get(sender_jid);
            // Create enough messages so that there's a scrollbar.
            const promises = [];
            view.content.scrollTop = 0;
            view.model.set('scrolled', true);

            for (let i=0; i<20; i++) {
                _converse.handleMessageStanza($msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: _converse.connection.getUniqueId(),
                    }).c('body').t('Message: '+i).up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
                promises.push(new Promise(resolve => view.model.messages.once('rendered', resolve)));
            }
            await Promise.all(promises);

            const indicator_el = view.el.querySelector('.new-msgs-indicator');
            expect(u.isVisible(indicator_el)).toBeTruthy();

            expect(view.model.get('scrolled')).toBe(true);
            expect(view.content.scrollTop).toBe(0);
            indicator_el.click();
            expect(u.isVisible(indicator_el)).toBeFalsy();
            expect(view.model.get('scrolled')).toBe(false);
            done();
        }));

        it("is ignored if it's intended for a different resource and filter_by_resource is set to true",
            mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current');
            await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length)
            // Send a message from a different resource
            spyOn(converse.env.log, 'error');
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

            expect(converse.env.log.error.calls.all().pop().args[0]).toBe(
                "Ignoring incoming message intended for a different resource: romeo@montague.lit/some-other-resource",
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

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.api.chatviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();

            let stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Have you heard this funny audio?</body>
                    <x xmlns="jabber:x:oob"><url>https://montague.lit/audio.mp3</url></x>
                </message>`)
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg audio').length, 1000);
            let msg = view.el.querySelector('.chat-msg .chat-msg__text');
            expect(msg.classList.length).toEqual(1);
            expect(u.hasClass('chat-msg__text', msg)).toBe(true);
            expect(msg.textContent).toEqual('Have you heard this funny audio?');
            let media = view.el.querySelector('.chat-msg .chat-msg__media');
            expect(media.innerHTML.replace(/<!---->/g, '').replace(/(\r\n|\n|\r)/gm, "").trim()).toEqual(
                `<audio controls="" src="https://montague.lit/audio.mp3"></audio>    `+
                `<a target="_blank" rel="noopener" href="https://montague.lit/audio.mp3">Download audio file "audio.mp3"</a>`);

            // If the <url> and <body> contents is the same, don't duplicate.
            stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>https://montague.lit/audio.mp3</body>
                    <x xmlns="jabber:x:oob"><url>https://montague.lit/audio.mp3</url></x>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            msg = view.el.querySelector('.chat-msg:last-child .chat-msg__text');
            expect(msg.innerHTML.replace(/<!---->/g, '')).toEqual('Have you heard this funny audio?'); // Emtpy
            media = view.el.querySelector('.chat-msg:last-child .chat-msg__media');
            expect(media.innerHTML.replace(/<!---->/g, '').replace(/(\r\n|\n|\r)/gm, "").trim()).toEqual(
                `<audio controls="" src="https://montague.lit/audio.mp3"></audio>    `+
                `<a target="_blank" rel="noopener" href="https://montague.lit/audio.mp3">`+
                `Download audio file "audio.mp3"</a>`);
            done();
        }));

        it("will render video from oob mp4 URLs",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid)
            const view = _converse.api.chatviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();

            let stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Have you seen this funny video?</body>
                    <x xmlns="jabber:x:oob"><url>https://montague.lit/video.mp4</url></x>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg video').length, 2000)
            let msg = view.el.querySelector('.chat-msg .chat-msg__text');
            expect(msg.classList.length).toBe(1);
            expect(msg.textContent).toEqual('Have you seen this funny video?');
            let media = view.el.querySelector('.chat-msg .chat-msg__media');
            expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                `<!----><video controls="" preload="metadata" style="max-height: 50vh" src="https://montague.lit/video.mp4"></video><!---->`);


            // If the <url> and <body> contents is the same, don't duplicate.
            stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>https://montague.lit/video.mp4</body>
                    <x xmlns="jabber:x:oob"><url>https://montague.lit/video.mp4</url></x>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            msg = view.el.querySelector('.chat-msg:last-child .chat-msg__text');
            expect(msg.innerHTML.replace(/<!---->/g, '')).toEqual('Have you seen this funny video?');
            media = view.el.querySelector('.chat-msg:last-child .chat-msg__media');
            expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                `<!----><video controls="" preload="metadata" style="max-height: 50vh" src="https://montague.lit/video.mp4"></video><!---->`);
            done();
        }));

        it("will render download links for files from oob URLs",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.api.chatviews.get(contact_jid);
            spyOn(view.model, 'sendMessage').and.callThrough();
            const stanza = u.toStanza(`
                <message from="${contact_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Have you downloaded this funny file?</body>
                    <x xmlns="jabber:x:oob"><url>https://montague.lit/funny.pdf</url></x>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg a').length, 1000);
            const msg = view.el.querySelector('.chat-msg .chat-msg__text');
            expect(u.hasClass('chat-msg__text', msg)).toBe(true);
            expect(msg.textContent).toEqual('Have you downloaded this funny file?');
            const media = view.el.querySelector('.chat-msg .chat-msg__media');
            expect(media.innerHTML.replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                `<!----><a target="_blank" rel="noopener" href="https://montague.lit/funny.pdf"><!---->Download file "funny.pdf"<!----></a><!---->`);
            done();
        }));

        it("will render images from oob URLs",
            mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            const base_url = 'https://conversejs.org';
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid)
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
            _converse.connection._dataRecv(mock.createRequest(stanza));
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));
            await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg a').length, 1000);
            const msg = view.el.querySelector('.chat-msg .chat-msg__text');
            expect(u.hasClass('chat-msg__text', msg)).toBe(true);
            expect(msg.textContent).toEqual('Have you seen this funny image?');
            const media = view.el.querySelector('.chat-msg .chat-msg__media');
            expect(media.innerHTML.replace(/<!---->/g, '').replace(/(\r\n|\n|\r)/gm, "")).toEqual(
                `<a target="_blank" rel="noopener" href="${base_url}/logo/conversejs-filled.svg">`+
                `Download image file "conversejs-filled.svg"</a>`);
            done();
        }));
    });
});

describe("A XEP-0333 Chat Marker", function () {

    it("is sent when a markable message is received from a roster contact",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
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
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.model.sendMarker.calls.count() === 2);
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

        await mock.waitForRoster(_converse, 'current', 0);
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

        await u.waitUntil(() => sent_messages.length === 2);
        expect(Strophe.serialize(sent_messages[0])).toBe(
            `<message id="${sent_messages[0].getAttribute('id')}" to="${contact_jid}" type="chat" xmlns="jabber:client">`+
                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                `<no-store xmlns="urn:xmpp:hints"/>`+
                `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
            `</message>`
        );
        done();
    }));

    it("is ignored if it's a carbon copy of one that I sent from a different client",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.SID]);

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
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
        _converse.connection._dataRecv(mock.createRequest(stanza));
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
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.api.trigger.calls.count(), 500);
        expect(view.el.querySelectorAll('.chat-msg').length).toBe(1);
        expect(view.model.messages.length).toBe(1);
        done();
    }));
});
