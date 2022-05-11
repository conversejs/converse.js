/*global mock, converse */

const { $msg, u } = converse.env;


describe("A chat message", function () {

    it("received for a minimized chat box will increment a counter on its header",
            mock.initConverse(['chatBoxesFetched'], {'view_mode': 'overlayed'}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        const contact_name = mock.cur_names[0];
        const contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openControlBox(_converse);
        spyOn(_converse.api, "trigger").and.callThrough();

        const rosterview = document.querySelector('converse-roster');
        await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
        await mock.openChatBoxFor(_converse, contact_jid);
        const chatview = _converse.chatboxviews.get(contact_jid);
        expect(u.isVisible(chatview)).toBeTruthy();
        expect(chatview.model.get('minimized')).toBeFalsy();
        chatview.querySelector('.toggle-chatbox-button').click();
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
        let count = document.querySelector('converse-minimized-chat .message-count');
        expect(u.isVisible(chatview)).toBeFalsy();
        expect(chatview.model.get('minimized')).toBeTruthy();

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
        expect(u.isVisible(chatview)).toBeFalsy();
        expect(chatview.model.get('minimized')).toBeTruthy();
        count = document.querySelector('converse-minimized-chat .message-count');
        expect(u.isVisible(count)).toBeTruthy();
        expect(count.textContent).toBe('2');
        document.querySelector("converse-minimized-chat a.restore-chat").click();
        expect(_converse.chatboxes.filter('minimized').length).toBe(0);
    }));

});

describe("A Groupchat", function () {

    it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const muc_jid = 'lounge@conference.shakespeare.lit';
        await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
        const view = _converse.chatboxviews.get(muc_jid);
        spyOn(_converse.api, "trigger").and.callThrough();
        const button = await u.waitUntil(() => view.querySelector('.toggle-chatbox-button'));
        button.click();

        expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
        await u.waitUntil(() => !u.isVisible(view));
        expect(view.model.get('minimized')).toBeTruthy();
        const el = await u.waitUntil(() => document.querySelector("converse-minimized-chat a.restore-chat"));
        el.click();
        expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
        expect(view.model.get('minimized')).toBeFalsy();
        expect(_converse.api.trigger.calls.count(), 3);
    }));
});


describe("A Chatbox", function () {

    it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);

        const contact_jid = mock.cur_names[7].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const rosterview = document.querySelector('converse-roster');
        await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
        await mock.openChatBoxFor(_converse, contact_jid);
        const chatview = _converse.chatboxviews.get(contact_jid);
        spyOn(_converse.api, "trigger").and.callThrough();
        chatview.querySelector('.toggle-chatbox-button').click();

        expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
        expect(_converse.api.trigger.calls.count(), 2);
        await u.waitUntil(() => !u.isVisible(chatview));
        expect(chatview.model.get('minimized')).toBeTruthy();
        const restore_el = await u.waitUntil(() => document.querySelector("converse-minimized-chat a.restore-chat"));
        restore_el.click();
        await u.waitUntil(() => _converse.chatboxviews.keys().length);
        expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
        expect(chatview.model.get('minimized')).toBeFalsy();
    }));


    it("can be opened in minimized mode initially", mock.initConverse([], {}, async function (_converse) {
        await mock.waitForRoster(_converse, 'current');
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const minimized_chats = await u.waitUntil(() => document.querySelector("converse-minimized-chats"));
        expect(u.isVisible(minimized_chats.firstElementChild)).toBe(false);
        await _converse.api.chats.create(sender_jid, {'minimized': true});
        await u.waitUntil(() => _converse.chatboxes.length > 1);
        expect(_converse.chatboxviews.get(sender_jid)).toBe(undefined);
        expect(u.isVisible(minimized_chats.firstElementChild)).toBe(true);
        expect(minimized_chats.firstElementChild.querySelectorAll('converse-minimized-chat').length).toBe(1);
        expect(_converse.chatboxes.filter('minimized').length).toBe(1);
    }));


    it("can be trimmed to conserve space", mock.initConverse([], {}, async function (_converse) {
        spyOn(_converse.minimize, 'trimChats');
        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);

        // openControlBox was called earlier, so the controlbox is
        // visible, but no other chat boxes have been created.
        expect(_converse.chatboxes.length).toEqual(1);
        expect(document.querySelectorAll("#conversejs .chatbox").length).toBe(1); // Controlbox is open

        const rosterview = document.querySelector('converse-roster');
        await u.waitUntil(() => rosterview.querySelectorAll('.roster-group li').length);
        // Test that they can be maximized again
        const online_contacts = rosterview.querySelectorAll('.roster-group .current-xmpp-contact a.open-chat');
        expect(online_contacts.length).toBe(17);
        let i;
        for (i=0; i<online_contacts.length; i++) {
            const el = online_contacts[i];
            el.click();
        }
        await u.waitUntil(() => _converse.chatboxes.length == 16);
        expect(_converse.minimize.trimChats.calls.count()).toBe(16);

        for (i=0; i<online_contacts.length; i++) {
            const el = online_contacts[i];
            const jid = el.textContent.trim().replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const model = _converse.chatboxes.get(jid);
            model.set({'minimized': true});
        }
        await u.waitUntil(() => _converse.chatboxviews.keys().length === 1);
        const minimized_chats = await u.waitUntil(() => document.querySelector("converse-minimized-chats"));
        minimized_chats.querySelector("a.restore-chat").click();
        expect(_converse.minimize.trimChats.calls.count()).toBe(16);
    }));
});


describe("A Minimized ChatBoxView's Unread Message Count", function () {

    it("is displayed when scrolled up chatbox is minimized after receiving unread messages",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, sender_jid);
        const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
        const chatbox = _converse.chatboxes.get(sender_jid);
        chatbox.ui.set('scrolled', true);
        _converse.handleMessageStanza(msgFactory());
        await u.waitUntil(() => chatbox.messages.length);
        await u.waitUntil(() => chatbox.get('num_unread') === 1);
        _converse.minimize.minimize(chatbox);

        const minimized_chats = await u.waitUntil(() => document.querySelector("converse-minimized-chats"));
        const unread_count = minimized_chats.querySelector('#toggle-minimized-chats .unread-message-count');
        expect(u.isVisible(unread_count)).toBeTruthy();
        expect(unread_count.innerHTML.replace(/<!-.*?->/g, '')).toBe('1');
    }));

    it("is incremented when message is received and windows is not focused",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const view = await mock.openChatBoxFor(_converse, sender_jid)
        const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
        _converse.minimize.minimize(view.model);
        _converse.handleMessageStanza(msgFactory());
        await u.waitUntil(() => view.model.messages.length);
        const minimized_chats = await u.waitUntil(() => document.querySelector("converse-minimized-chats"));
        const unread_count = minimized_chats.querySelector('#toggle-minimized-chats .unread-message-count');
        expect(u.isVisible(unread_count)).toBeTruthy();
        expect(unread_count.innerHTML.replace(/<!-.*?->/g, '')).toBe('1');
    }));
});


describe("The Minimized Chats Widget", function () {

    it("shows chats that have been minimized",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        const minimized_chats = await u.waitUntil(() => document.querySelector("converse-minimized-chats"));
        minimized_chats.initToggle();

        let contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)
        let chatview = _converse.chatboxviews.get(contact_jid);
        expect(chatview.model.get('minimized')).toBeFalsy();
        expect(u.isVisible(minimized_chats.firstElementChild)).toBe(false);
        chatview.querySelector('.toggle-chatbox-button').click();
        expect(chatview.model.get('minimized')).toBeTruthy();
        expect(u.isVisible(minimized_chats)).toBe(true);
        expect(_converse.chatboxes.filter('minimized').length).toBe(1);
        expect(_converse.chatboxes.models.filter(c => c.get('minimized')).pop().get('jid')).toBe(contact_jid);

        contact_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        chatview = _converse.chatboxviews.get(contact_jid);
        expect(chatview.model.get('minimized')).toBeFalsy();
        chatview.querySelector('.toggle-chatbox-button').click();
        expect(chatview.model.get('minimized')).toBeTruthy();
        expect(u.isVisible(minimized_chats)).toBe(true);
        expect(_converse.chatboxes.filter('minimized').length).toBe(2);
        expect(_converse.chatboxes.filter('minimized').map(c => c.get('jid')).includes(contact_jid)).toBeTruthy();
    }));

    it("can be toggled to hide or show minimized chats",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        let minimized_chats = await u.waitUntil(() => document.querySelector("converse-minimized-chats"));
        minimized_chats.initToggle();

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const chatview = _converse.chatboxviews.get(contact_jid);
        expect(u.isVisible(minimized_chats.firstElementChild)).toBe(false);

        chatview.model.set({'minimized': true});
        expect(u.isVisible(minimized_chats)).toBeTruthy();
        expect(_converse.chatboxes.filter('minimized').length).toBe(1);
        expect(_converse.chatboxes.models.filter(c => c.get('minimized')).pop().get('jid')).toBe(contact_jid);

        minimized_chats = await u.waitUntil(() => document.querySelector("converse-minimized-chats"));
        expect(u.isVisible(minimized_chats.querySelector('.minimized-chats-flyout'))).toBeTruthy();
        expect(minimized_chats.minchats.get('collapsed')).toBeFalsy();
        minimized_chats.querySelector('#toggle-minimized-chats').click();
        await u.waitUntil(() => u.isVisible(minimized_chats.querySelector('.minimized-chats-flyout')));
        expect(minimized_chats.minchats.get('collapsed')).toBeTruthy();
    }));

    it("shows the number messages received to minimized chats",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 4);
        await mock.openControlBox(_converse);
        const minimized_chats = await u.waitUntil(() => document.querySelector("converse-minimized-chats"));
        minimized_chats.initToggle();
        minimized_chats.minchats.set({'collapsed': true});

        const unread_el = minimized_chats.querySelector('.unread-message-count');
        expect(u.isVisible(unread_el)).toBe(false);

        const promises = [];
        let i, contact_jid;
        for (i=0; i<3; i++) {
            contact_jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            promises.push(mock.openChatBoxFor(_converse, contact_jid));
        }
        await Promise.all(promises);
        await u.waitUntil(() => _converse.chatboxes.length == 4);

        const chatview = _converse.chatboxviews.get(contact_jid);
        chatview.model.set({'minimized': true});
        for (i=0; i<3; i++) {
            const msg = $msg({
                from: contact_jid,
                to: _converse.connection.jid,
                type: 'chat',
                id: u.getUniqueId()
            }).c('body').t('This message is sent to a minimized chatbox').up()
            .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();
            _converse.handleMessageStanza(msg);
        }
        await u.waitUntil(() => chatview.model.messages.length === 3, 500);


        expect(u.isVisible(minimized_chats.querySelector('.unread-message-count'))).toBeTruthy();
        expect(minimized_chats.querySelector('.unread-message-count').textContent).toBe((3).toString());
        // Chat state notifications don't increment the unread messages counter
        // <composing> state
        _converse.handleMessageStanza($msg({
            from: contact_jid,
            to: _converse.connection.jid,
            type: 'chat',
            id: u.getUniqueId()
        }).c('composing', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
        expect(minimized_chats.querySelector('.unread-message-count').textContent).toBe((i).toString());

        // <paused> state
        _converse.handleMessageStanza($msg({
            from: contact_jid,
            to: _converse.connection.jid,
            type: 'chat',
            id: u.getUniqueId()
        }).c('paused', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
        expect(minimized_chats.querySelector('.unread-message-count').textContent).toBe((i).toString());

        // <gone> state
        _converse.handleMessageStanza($msg({
            from: contact_jid,
            to: _converse.connection.jid,
            type: 'chat',
            id: u.getUniqueId()
        }).c('gone', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
        expect(minimized_chats.querySelector('.unread-message-count').textContent).toBe((i).toString());

        // <inactive> state
        _converse.handleMessageStanza($msg({
            from: contact_jid,
            to: _converse.connection.jid,
            type: 'chat',
            id: u.getUniqueId()
        }).c('inactive', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
        expect(minimized_chats.querySelector('.unread-message-count').textContent).toBe((i).toString());
    }));

    it("shows the number messages received to minimized groupchats",
            mock.initConverse([], {}, async function (_converse) {

        const muc_jid = 'kitchen@conference.shakespeare.lit';
        await mock.openAndEnterChatRoom(_converse, 'kitchen@conference.shakespeare.lit', 'fires');
        const view = _converse.chatboxviews.get(muc_jid);
        view.model.set({'minimized': true});
        const message = 'fires: Your attention is required';
        const nick = mock.chatroom_names[0];
        const msg = $msg({
                from: muc_jid+'/'+nick,
                id: u.getUniqueId(),
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t(message).tree();
        view.model.handleMessageStanza(msg);
        await u.waitUntil(() => view.model.messages.length);
        const minimized_chats = await u.waitUntil(() => document.querySelector("converse-minimized-chats"));
        expect(u.isVisible(minimized_chats.querySelector('.unread-message-count'))).toBeTruthy();
        expect(minimized_chats.querySelector('.unread-message-count').textContent).toBe('1');
    }));
});
