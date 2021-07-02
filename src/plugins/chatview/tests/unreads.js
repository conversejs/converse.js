/*global mock, converse */

const { u } = converse.env;


describe("A ChatBox's Unread Message Count", function () {

    it("is incremented when the message is received and ChatBoxView is scrolled up",
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                msg = mock.createChatMessage(_converse, sender_jid, 'This message will be unread');

        const view = await mock.openChatBoxFor(_converse, sender_jid)
        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        view.model.ui.set('scrolled', true);
        await _converse.handleMessageStanza(msg);
        await u.waitUntil(() => view.model.messages.length);
        expect(view.model.get('num_unread')).toBe(1);
        const msgid = view.model.messages.last().get('id');
        expect(view.model.get('first_unread_id')).toBe(msgid);
        await u.waitUntil(() => sent_stanzas.length);
        expect(sent_stanzas[0].querySelector('received')).toBeDefined();
    }));

    it("is not incremented when the message is received and ChatBoxView is scrolled down",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const msg = mock.createChatMessage(_converse, sender_jid, 'This message will be read');
        await mock.openChatBoxFor(_converse, sender_jid);
        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        const chatbox = _converse.chatboxes.get(sender_jid);
        await _converse.handleMessageStanza(msg);
        expect(chatbox.get('num_unread')).toBe(0);
        await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'message').length === 2);
        expect(sent_stanzas[1].querySelector('displayed')).toBeDefined();
    }));

    it("is incremented when message is received, chatbox is scrolled down and the window is not focused",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const msgFactory = function () {
            return mock.createChatMessage(_converse, sender_jid, 'This message will be unread');
        };
        await mock.openChatBoxFor(_converse, sender_jid);
        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        const chatbox = _converse.chatboxes.get(sender_jid);
        _converse.windowState = 'hidden';
        const msg = msgFactory();
        _converse.handleMessageStanza(msg);
        await u.waitUntil(() => chatbox.messages.length);
        expect(chatbox.get('num_unread')).toBe(1);
        const msgid = chatbox.messages.last().get('id');
        expect(chatbox.get('first_unread_id')).toBe(msgid);
        await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'message').length);
        expect(sent_stanzas[0].querySelector('received')).toBeDefined();
    }));

    it("is incremented when message is received, chatbox is scrolled up and the window is not focused",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be unread');
        await mock.openChatBoxFor(_converse, sender_jid);
        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        const chatbox = _converse.chatboxes.get(sender_jid);
        chatbox.ui.set('scrolled', true);
        _converse.windowState = 'hidden';
        const msg = msgFactory();
        _converse.handleMessageStanza(msg);
        await u.waitUntil(() => chatbox.messages.length);
        expect(chatbox.get('num_unread')).toBe(1);
        const msgid = chatbox.messages.last().get('id');
        expect(chatbox.get('first_unread_id')).toBe(msgid);
        await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'message').length === 1);
        expect(sent_stanzas[0].querySelector('received')).toBeDefined();
    }));

    it("is cleared when the chat was scrolled down and the window become focused",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be unread');
        await mock.openChatBoxFor(_converse, sender_jid);
        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        const chatbox = _converse.chatboxes.get(sender_jid);
        _converse.windowState = 'hidden';
        const msg = msgFactory();
        _converse.handleMessageStanza(msg);
        await u.waitUntil(() => chatbox.messages.length);
        expect(chatbox.get('num_unread')).toBe(1);
        const msgid = chatbox.messages.last().get('id');
        expect(chatbox.get('first_unread_id')).toBe(msgid);
        await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'message').length === 1);
        expect(sent_stanzas[0].querySelector('received')).toBeDefined();
        _converse.saveWindowState({'type': 'focus'});
        await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'message').length === 2);
        expect(sent_stanzas[1].querySelector('displayed')).toBeDefined();
        expect(chatbox.get('num_unread')).toBe(0);
    }));

    it("is cleared when the chat was hidden in fullscreen mode and then becomes visible",
            mock.initConverse(['chatBoxesFetched'], {'view_mode': 'fullscreen'},
            async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, sender_jid);
        const chatbox = _converse.chatboxes.get(sender_jid);
        chatbox.save({'hidden': true});
        _converse.handleMessageStanza(mock.createChatMessage(_converse, sender_jid, 'This message will be unread'));
        await u.waitUntil(() => chatbox.messages.length);
        expect(chatbox.get('num_unread')).toBe(1);
        chatbox.save({'hidden': false});
        await u.waitUntil(() => chatbox.get('num_unread') === 0);
        chatbox.close();
    }));

    it("is not cleared when ChatBoxView was scrolled up and the windows become focused",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be unread');
        await mock.openChatBoxFor(_converse, sender_jid);
        const sent_stanzas = [];
        spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
        const chatbox = _converse.chatboxes.get(sender_jid);
        chatbox.ui.set('scrolled', true);
        _converse.windowState = 'hidden';
        const msg = msgFactory();
        _converse.handleMessageStanza(msg);
        await u.waitUntil(() => chatbox.messages.length);
        expect(chatbox.get('num_unread')).toBe(1);
        const msgid = chatbox.messages.last().get('id');
        expect(chatbox.get('first_unread_id')).toBe(msgid);
        await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'message').length === 1);
        expect(sent_stanzas[0].querySelector('received')).toBeDefined();
        _converse.saveWindowState({'type': 'focus'});
        await u.waitUntil(() => chatbox.get('num_unread') === 1);
        expect(chatbox.get('first_unread_id')).toBe(msgid);
        expect(sent_stanzas[0].querySelector('received')).toBeDefined();
    }));
});
