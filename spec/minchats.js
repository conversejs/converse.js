/*global mock, converse */

const  $msg = converse.env.$msg;
const u = converse.env.utils;
const sizzle = converse.env.sizzle;


describe("A chat message", function () {

    it("received for a minimized chat box will increment a counter on its header",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        if (_converse.view_mode === 'fullscreen') {
            return done();
        }
        await mock.waitForRoster(_converse, 'current');
        const contact_name = mock.cur_names[0];
        const contact_jid = contact_name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openControlBox(_converse);
        spyOn(_converse.api, "trigger").and.callThrough();

        await u.waitUntil(() => _converse.rosterview.querySelectorAll('.roster-group').length);
        await mock.openChatBoxFor(_converse, contact_jid);
        const chatview = _converse.api.chatviews.get(contact_jid);
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
        const trimmed_chatboxes = _converse.minimized_chats;
        let count = trimmed_chatboxes.el.querySelector('converse-minimized-chat .message-count');
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
        count = trimmed_chatboxes.el.querySelector('converse-minimized-chat .message-count');
        expect(u.isVisible(count)).toBeTruthy();
        expect(count.textContent).toBe('2');
        _converse.minimized_chats.el.querySelector("a.restore-chat").click();
        expect(_converse.chatboxes.filter('minimized').length).toBe(0);
        done();
    }));

});

describe("A Groupcaht", function () {

    it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');
        const view = _converse.chatboxviews.get('lounge@montague.lit');
        spyOn(view, 'onMinimized').and.callThrough();
        spyOn(view, 'onMaximized').and.callThrough();
        spyOn(_converse.api, "trigger").and.callThrough();
        view.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
        const button = await u.waitUntil(() => view.querySelector('.toggle-chatbox-button'));
        button.click();

        expect(view.onMinimized).toHaveBeenCalled();
        expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
        expect(u.isVisible(view)).toBeFalsy();
        expect(view.model.get('minimized')).toBeTruthy();
        expect(view.onMinimized).toHaveBeenCalled();
        const el = await u.waitUntil(() => _converse.minimized_chats.el.querySelector("a.restore-chat"));
        el.click();
        expect(view.onMaximized).toHaveBeenCalled();
        expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
        expect(view.model.get('minimized')).toBeFalsy();
        expect(_converse.api.trigger.calls.count(), 3);
        done();
    }));
});


describe("A Chatbox", function () {

    it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);

        const contact_jid = mock.cur_names[7].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await u.waitUntil(() => _converse.rosterview.querySelectorAll('.roster-group').length);
        await mock.openChatBoxFor(_converse, contact_jid);
        const chatview = _converse.chatboxviews.get(contact_jid);
        spyOn(chatview, 'minimize').and.callThrough();
        spyOn(_converse.api, "trigger").and.callThrough();
        // We need to rebind all events otherwise our spy won't be called
        chatview.delegateEvents();
        chatview.querySelector('.toggle-chatbox-button').click();

        expect(chatview.minimize).toHaveBeenCalled();
        expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
        expect(_converse.api.trigger.calls.count(), 2);
        expect(u.isVisible(chatview)).toBeFalsy();
        expect(chatview.model.get('minimized')).toBeTruthy();
        chatview.querySelector('.toggle-chatbox-button').click();

        await u.waitUntil(() => _converse.chatboxviews.keys().length);
        _converse.minimized_chats.el.querySelector("a.restore-chat").click();
        expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
        expect(chatview.model.get('minimized')).toBeFalsy();
        done();
    }));


    it("can be opened in minimized mode initially",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        expect(u.isVisible(_converse.minimized_chats.el.firstElementChild)).toBe(false);
        await _converse.api.chats.create(sender_jid, {'minimized': true});
        await u.waitUntil(() => _converse.chatboxes.length > 1);
        const chatBoxView = _converse.chatboxviews.get(sender_jid);
        expect(u.isVisible(chatBoxview)).toBeFalsy();
        expect(u.isVisible(_converse.minimized_chats.el.firstElementChild)).toBe(true);
        expect(_converse.minimized_chats.el.firstElementChild.querySelectorAll('converse-minimized-chat').length).toBe(1);
        expect(_converse.chatboxes.filter('minimized').length).toBe(1);
        done();
    }));


    it("can be trimmed to conserve space",
        mock.initConverse(['rosterGroupsFetched'], {},
        async function (done, _converse) {

        spyOn(_converse.minimize, 'trimChats');

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        expect(_converse.minimize.trimChats.calls.count()).toBe(1);

        let jid, chatboxview;
        // openControlBox was called earlier, so the controlbox is
        // visible, but no other chat boxes have been created.
        expect(_converse.chatboxes.length).toEqual(1);
        expect(document.querySelectorAll("#conversejs .chatbox").length).toBe(1); // Controlbox is open

        _converse.rosterview.update(); // XXX: Hack to make sure $roster element is attached.
        await u.waitUntil(() => _converse.rosterview.querySelectorAll('.roster-group li').length);
        // Test that they can be maximized again
        const online_contacts = _converse.rosterview.querySelectorAll('.roster-group .current-xmpp-contact a.open-chat');
        expect(online_contacts.length).toBe(17);
        let i;
        for (i=0; i<online_contacts.length; i++) {
            const el = online_contacts[i];
            el.click();
        }
        await u.waitUntil(() => _converse.chatboxes.length == 16);
        expect(_converse.minimize.trimChats.calls.count()).toBe(16);

        _converse.api.chatviews.get().forEach(v => spyOn(v, 'onMinimized').and.callThrough());
        for (i=0; i<online_contacts.length; i++) {
            const el = online_contacts[i];
            jid = el.textContent.trim().replace(/ /g,'.').toLowerCase() + '@montague.lit';
            chatboxview = _converse.chatboxviews.get(jid);
            chatboxview.model.set({'minimized': true});
            expect(chatboxview.onMinimized).toHaveBeenCalled();
        }
        await u.waitUntil(() => _converse.chatboxviews.keys().length);
        var key = _converse.chatboxviews.keys()[1];
        const chatbox = _converse.chatboxes.get(key);
        spyOn(chatbox, 'maximize').and.callThrough();
        _converse.minimized_chats.el.querySelector("a.restore-chat").click();

        expect(chatbox.maximize).toHaveBeenCalled();
        expect(_converse.minimize.trimChats.calls.count()).toBe(17);
        done();
    }));
});


describe("A Minimized ChatBoxView's Unread Message Count", function () {

    it("is displayed when scrolled up chatbox is minimized after receiving unread messages",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, sender_jid);
        const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
        const selectUnreadMsgCount = () => _converse.minimized_chats.el.querySelector('#toggle-minimized-chats .unread-message-count');
        const chatbox = _converse.chatboxes.get(sender_jid);
        chatbox.save('scrolled', true);
        _converse.handleMessageStanza(msgFactory());
        await u.waitUntil(() => chatbox.messages.length);
        const chatboxview = _converse.chatboxviews.get(sender_jid);
        chatboxview.minimize();

        const unread_count = selectUnreadMsgCount();
        expect(u.isVisible(unread_count)).toBeTruthy();
        expect(unread_count.innerHTML.replace(/<!---->/g, '')).toBe('1');
        done();
    }));

    it("is incremented when message is received and windows is not focused",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        const view = await mock.openChatBoxFor(_converse, sender_jid)
        const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
        const selectUnreadMsgCount = () => _converse.minimized_chats.el.querySelector('#toggle-minimized-chats .unread-message-count');
        view.minimize();
        _converse.handleMessageStanza(msgFactory());
        await u.waitUntil(() => view.model.messages.length);
        const unread_count = selectUnreadMsgCount();
        expect(u.isVisible(unread_count)).toBeTruthy();
        expect(unread_count.innerHTML.replace(/<!---->/g, '')).toBe('1');
        done();
    }));

    it("will render Openstreetmap-URL from geo-URI",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current', 1);

        const message = "geo:37.786971,-122.399677";
        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const view = _converse.chatboxviews.get(contact_jid);
        spyOn(view.model, 'sendMessage').and.callThrough();
        mock.sendMessage(view, message);
        await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-msg').length, 1000);
        expect(view.model.sendMessage).toHaveBeenCalled();
        const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view).pop();
        await u.waitUntil(() => msg.innerHTML.replace(/\<!----\>/g, '') ===
            '<a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=37.786971&amp;'+
            'mlon=-122.399677#map=18/37.786971/-122.399677">https://www.openstreetmap.org/?mlat=37.786971&amp;mlon=-122.399677#map=18/37.786971/-122.399677</a>');
        done();
    }));
});


describe("The Minimized Chats Widget", function () {

    it("shows chats that have been minimized",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        _converse.minimized_chats.initToggle();

        let contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)
        let chatview = _converse.chatboxviews.get(contact_jid);
        expect(chatview.model.get('minimized')).toBeFalsy();
        expect(u.isVisible(_converse.minimized_chats.el.firstElementChild)).toBe(false);
        chatview.querySelector('.toggle-chatbox-button').click();
        expect(chatview.model.get('minimized')).toBeTruthy();
        expect(u.isVisible(_converse.minimized_chats.el)).toBe(true);
        expect(_converse.chatboxes.filter('minimized').length).toBe(1);
        expect(_converse.chatboxes.models.filter(c => c.get('minimized')).pop().get('jid')).toBe(contact_jid);

        contact_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        chatview = _converse.chatboxviews.get(contact_jid);
        expect(chatview.model.get('minimized')).toBeFalsy();
        chatview.querySelector('.toggle-chatbox-button').click();
        expect(chatview.model.get('minimized')).toBeTruthy();
        expect(u.isVisible(_converse.minimized_chats.el)).toBe(true);
        expect(_converse.chatboxes.filter('minimized').length).toBe(2);
        expect(_converse.chatboxes.filter('minimized').map(c => c.get('jid')).includes(contact_jid)).toBeTruthy();
        done();
    }));

    it("can be toggled to hide or show minimized chats",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current');
        await mock.openControlBox(_converse);
        _converse.minimized_chats.initToggle();

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        const chatview = _converse.chatboxviews.get(contact_jid);
        expect(u.isVisible(_converse.minimized_chats.el.firstElementChild)).toBe(false);

        chatview.model.set({'minimized': true});
        expect(u.isVisible(_converse.minimized_chats.el)).toBeTruthy();
        expect(_converse.chatboxes.filter('minimized').length).toBe(1);
        expect(_converse.chatboxes.models.filter(c => c.get('minimized')).pop().get('jid')).toBe(contact_jid);

        expect(u.isVisible(_converse.minimized_chats.el.querySelector('.minimized-chats-flyout'))).toBeTruthy();
        expect(_converse.minimized_chats.minchats.get('collapsed')).toBeFalsy();
        _converse.minimized_chats.el.querySelector('#toggle-minimized-chats').click();
        await u.waitUntil(() => u.isVisible(_converse.minimized_chats.el.querySelector('.minimized-chats-flyout')));
        expect(_converse.minimized_chats.minchats.get('collapsed')).toBeTruthy();
        done();
    }));

    it("shows the number messages received to minimized chats",
        mock.initConverse(
            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
            async function (done, _converse) {

        await mock.waitForRoster(_converse, 'current', 4);
        await mock.openControlBox(_converse);
        _converse.minimized_chats.initToggle();

        _converse.minimized_chats.minchats.set({'collapsed': true});

        const unread_el = _converse.minimized_chats.el.querySelector('.unread-message-count');
        expect(u.isVisible(unread_el)).toBe(false);

        let i, contact_jid;
        for (i=0; i<3; i++) {
            contact_jid = mock.cur_names[i].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            mock.openChatBoxFor(_converse, contact_jid);
        }
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

        expect(u.isVisible(_converse.minimized_chats.el.querySelector('.unread-message-count'))).toBeTruthy();
        expect(_converse.minimized_chats.el.querySelector('.unread-message-count').textContent).toBe((3).toString());
        // Chat state notifications don't increment the unread messages counter
        // <composing> state
        _converse.handleMessageStanza($msg({
            from: contact_jid,
            to: _converse.connection.jid,
            type: 'chat',
            id: u.getUniqueId()
        }).c('composing', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
        expect(_converse.minimized_chats.el.querySelector('.unread-message-count').textContent).toBe((i).toString());

        // <paused> state
        _converse.handleMessageStanza($msg({
            from: contact_jid,
            to: _converse.connection.jid,
            type: 'chat',
            id: u.getUniqueId()
        }).c('paused', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
        expect(_converse.minimized_chats.el.querySelector('.unread-message-count').textContent).toBe((i).toString());

        // <gone> state
        _converse.handleMessageStanza($msg({
            from: contact_jid,
            to: _converse.connection.jid,
            type: 'chat',
            id: u.getUniqueId()
        }).c('gone', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
        expect(_converse.minimized_chats.el.querySelector('.unread-message-count').textContent).toBe((i).toString());

        // <inactive> state
        _converse.handleMessageStanza($msg({
            from: contact_jid,
            to: _converse.connection.jid,
            type: 'chat',
            id: u.getUniqueId()
        }).c('inactive', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree());
        expect(_converse.minimized_chats.el.querySelector('.unread-message-count').textContent).toBe((i).toString());
        done();
    }));

    it("shows the number messages received to minimized groupchats",
        mock.initConverse(
            ['rosterGroupsFetched'], {},
            async function (done, _converse) {

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
        expect(u.isVisible(_converse.minimized_chats.el.querySelector('.unread-message-count'))).toBeTruthy();
        expect(_converse.minimized_chats.el.querySelector('.unread-message-count').textContent).toBe('1');
        done();
    }));
});
