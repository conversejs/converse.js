(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const _ = converse.env._;
    const $msg = converse.env.$msg;
    const Strophe = converse.env.Strophe;
    const u = converse.env.utils;
    const sizzle = converse.env.sizzle;

    return describe("Chatboxes", function () {

        describe("A Chatbox", function () {

            it("has a /help command to show the available commands", mock.initConverse(['rosterGroupsFetched', 'chatBoxesFetched'], {}, async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                await test_utils.openControlBox(_converse);

                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                test_utils.sendMessage(view, '/help');

                const info_messages = Array.prototype.slice.call(view.el.querySelectorAll('.chat-info:not(.chat-date)'), 0);
                expect(info_messages.length).toBe(4);
                expect(info_messages.pop().textContent).toBe('/help: Show this menu');
                expect(info_messages.pop().textContent).toBe('/me: Write in the third person');
                expect(info_messages.pop().textContent).toBe('/close: Close this chat');
                expect(info_messages.pop().textContent).toBe('/clear: Remove messages');

                const msg = $msg({
                        from: contact_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: u.getUniqueId()
                    }).c('body').t('hello world').tree();
                await _converse.handleMessageStanza(msg);
                await u.waitUntil(() => view.content.querySelectorAll('.chat-msg').length);
                expect(view.content.lastElementChild.textContent.trim().indexOf('hello world')).not.toBe(-1);
                done();
            }));


            it("supports the /me command", mock.initConverse(['rosterGroupsFetched'], {}, async function (done, _converse) {
                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
                await u.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'));
                await test_utils.openControlBox(_converse);
                expect(_converse.chatboxes.length).toEqual(1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                let message = '/me is tired';
                const msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: u.getUniqueId()
                    }).c('body').t(message).up()
                    .c('active', {'xmlns': 'http://jabber.org/protocol/chatstates'}).tree();

                await _converse.handleMessageStanza(msg);
                const view = _converse.chatboxviews.get(sender_jid);
                await new Promise(resolve => view.once('messageInserted', resolve));
                expect(view.el.querySelectorAll('.chat-msg--action').length).toBe(1);
                expect(_.includes(view.el.querySelector('.chat-msg__author').textContent, '**Mercutio')).toBeTruthy();
                expect(view.el.querySelector('.chat-msg__text').textContent).toBe('is tired');
                message = '/me is as well';
                await test_utils.sendMessage(view, message);
                expect(view.el.querySelectorAll('.chat-msg--action').length).toBe(2);
                await u.waitUntil(() => sizzle('.chat-msg__author:last', view.el).pop().textContent.trim() === '**Romeo Montague');
                const last_el = sizzle('.chat-msg__text:last', view.el).pop();
                expect(last_el.textContent).toBe('is as well');
                expect(u.hasClass('chat-msg--followup', last_el)).toBe(false);
                // Check that /me messages after a normal message don't
                // get the 'chat-msg--followup' class.
                message = 'This a normal message';
                await test_utils.sendMessage(view, message);
                let message_el = view.el.querySelector('.message:last-child');
                expect(u.hasClass('chat-msg--followup', message_el)).toBeFalsy();
                message = '/me wrote a 3rd person message';
                await test_utils.sendMessage(view, message);
                message_el = view.el.querySelector('.message:last-child');
                expect(view.el.querySelectorAll('.chat-msg--action').length).toBe(3);
                expect(sizzle('.chat-msg__text:last', view.el).pop().textContent).toBe('wrote a 3rd person message');
                expect(u.isVisible(sizzle('.chat-msg__author:last', view.el).pop())).toBeTruthy();
                expect(u.hasClass('chat-msg--followup', message_el)).toBeFalsy();
                done();
            }));

            it("is created when you click on a roster item", mock.initConverse(
                ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);

                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(_converse.chatboxes.length).toEqual(1);
                spyOn(_converse.chatboxviews, 'trimChats');
                expect(document.querySelectorAll("#conversejs .chatbox").length).toBe(1); // Controlbox is open

                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group li').length, 700);
                const online_contacts = _converse.rosterview.el.querySelectorAll('.roster-group .current-xmpp-contact a.open-chat');
                expect(online_contacts.length).toBe(17);
                let el = online_contacts[0];
                el.click();
                await u.waitUntil(() => document.querySelectorAll("#conversejs .chatbox").length == 2);
                expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();
                online_contacts[1].click();
                await u.waitUntil(() => _converse.chatboxes.length == 3);
                el = online_contacts[1];
                expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();
                // Check that new chat boxes are created to the left of the
                // controlbox (but to the right of all existing chat boxes)
                expect(document.querySelectorAll("#conversejs .chatbox").length).toBe(3);
                done();
            }));

            it("opens when a new message is received", mock.initConverse(
                ['rosterGroupsFetched'], {'allow_non_roster_messaging': true},
                async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 0);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const stanza = u.toStanza(`
                    <message from="${sender_jid}"
                             type="chat"
                             to="romeo@montague.lit/orchard">
                        <body>Hey\nHave you heard the news?</body>
                    </message>`);

                const message_promise = new Promise(resolve => _converse.api.listen.on('message', resolve));
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await new Promise(resolve => _converse.api.listen.once('chatBoxViewInitialized', resolve));
                await u.waitUntil(() => message_promise);
                expect(_converse.chatboxviews.keys().length).toBe(2);
                done();
            }));

            it("doesn't open when a message without body is received", mock.initConverse(
                ['rosterGroupsFetched'], {},
                async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const stanza = u.toStanza(`
                    <message from="${sender_jid}"
                             type="chat"
                             to="romeo@montague.lit/orchard">
                        <composing xmlns="http://jabber.org/protocol/chatstates"/>
                    </message>`);
                const message_promise = new Promise(resolve => _converse.api.listen.on('message', resolve))
                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                await u.waitUntil(() => message_promise);
                expect(_converse.chatboxviews.keys().length).toBe(1);
                done();
            }));

            it("can be trimmed to conserve space",
                mock.initConverse(['rosterGroupsFetched'], {},
                async function (done, _converse) {

                spyOn(_converse.chatboxviews, 'trimChats');

                const trimmed_chatboxes = _converse.minimized_chats;
                spyOn(trimmed_chatboxes, 'addChat').and.callThrough();
                spyOn(trimmed_chatboxes, 'removeChat').and.callThrough();

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);

                let jid, chatboxview;
                // openControlBox was called earlier, so the controlbox is
                // visible, but no other chat boxes have been created.
                expect(_converse.chatboxes.length).toEqual(1);
                expect(document.querySelectorAll("#conversejs .chatbox").length).toBe(1); // Controlbox is open

                _converse.rosterview.update(); // XXX: Hack to make sure $roster element is attached.
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group li').length);
                // Test that they can be maximized again
                const online_contacts = _converse.rosterview.el.querySelectorAll('.roster-group .current-xmpp-contact a.open-chat');
                expect(online_contacts.length).toBe(17);
                let i;
                for (i=0; i<online_contacts.length; i++) {
                    const el = online_contacts[i];
                    el.click();
                }
                await u.waitUntil(() => _converse.chatboxes.length == 16);
                expect(_converse.chatboxviews.trimChats.calls.count()).toBe(17);

                _converse.api.chatviews.get().forEach(v => spyOn(v, 'onMinimized').and.callThrough());
                for (i=0; i<online_contacts.length; i++) {
                    const el = online_contacts[i];
                    jid = _.trim(el.textContent.trim()).replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    chatboxview = _converse.chatboxviews.get(jid);
                    chatboxview.model.set({'minimized': true});
                    expect(trimmed_chatboxes.addChat).toHaveBeenCalled();
                    expect(chatboxview.onMinimized).toHaveBeenCalled();
                }
                await u.waitUntil(() => _converse.chatboxviews.keys().length);
                var key = _converse.chatboxviews.keys()[1];
                const trimmedview = trimmed_chatboxes.get(key);
                const chatbox = trimmedview.model;
                spyOn(chatbox, 'maximize').and.callThrough();
                spyOn(trimmedview, 'restore').and.callThrough();
                trimmedview.delegateEvents();
                trimmedview.el.querySelector("a.restore-chat").click();

                expect(trimmedview.restore).toHaveBeenCalled();
                expect(chatbox.maximize).toHaveBeenCalled();
                expect(_converse.chatboxviews.trimChats.calls.count()).toBe(18);
                done();
            }));

            it("can be opened in minimized mode initially",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await _converse.api.chats.create(sender_jid, {'minimized': true});
                await u.waitUntil(() => _converse.chatboxes.length > 1);
                const chatBoxView = _converse.chatboxviews.get(sender_jid);
                expect(u.isVisible(chatBoxView.el)).toBeFalsy();

                const minimized_chat = _converse.minimized_chats.get(sender_jid);
                expect(minimized_chat).toBeTruthy();
                expect(u.isVisible(minimized_chat.el)).toBeTruthy();
                done();
            }));


            it("is focused if its already open and you click on its corresponding roster item",
                mock.initConverse(['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);
                expect(_converse.chatboxes.length).toEqual(1);

                const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const view = await test_utils.openChatBoxFor(_converse, contact_jid);
                const el = sizzle('a.open-chat:contains("'+view.model.getDisplayName()+'")', _converse.rosterview.el).pop();
                await u.waitUntil(() => u.isVisible(el));
                const textarea = view.el.querySelector('.chat-textarea');
                await u.waitUntil(() => u.isVisible(textarea));
                textarea.blur();
                spyOn(view.model, 'maybeShow').and.callThrough();
                spyOn(view, 'focus').and.callThrough();
                el.click();
                await u.waitUntil(() => view.model.maybeShow.calls.count(), 1000);
                expect(view.model.maybeShow).toHaveBeenCalled();
                expect(view.focus).toHaveBeenCalled();
                expect(_converse.chatboxes.length).toEqual(2);
                done();
            }));

            it("can be saved to, and retrieved from, browserStorage",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                spyOn(_converse.ChatBoxViews.prototype, 'trimChats');
                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);

                spyOn(_converse.api, "trigger").and.callThrough();

                test_utils.openChatBoxes(_converse, 6);
                await u.waitUntil(() => _converse.chatboxes.length == 7);
                expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();
                // We instantiate a new ChatBoxes collection, which by default
                // will be empty.
                const newchatboxes = new _converse.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                // The chatboxes will then be fetched from browserStorage inside the
                // onConnected method
                newchatboxes.onConnected();
                await new Promise(resolve => _converse.api.listen.on('chatBoxesFetched', resolve));
                expect(newchatboxes.length).toEqual(7);
                // Check that the chatboxes items retrieved from browserStorage
                // have the same attributes values as the original ones.
                const attrs = ['id', 'box_id', 'visible'];
                let new_attrs, old_attrs;
                for (var i=0; i<attrs.length; i++) {
                    new_attrs = _.map(_.map(newchatboxes.models, 'attributes'), attrs[i]);
                    old_attrs = _.map(_.map(_converse.chatboxes.models, 'attributes'), attrs[i]);
                    expect(_.isEqual(new_attrs, old_attrs)).toEqual(true);
                }
                _converse.rosterview.render();
                done();
            }));

            it("can be closed by clicking a DOM element with class 'close-chatbox-button'",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);

                const contact_jid = mock.cur_names[7].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
                await test_utils.openChatBoxFor(_converse, contact_jid);
                const controlview = _converse.chatboxviews.get('controlbox'), // The controlbox is currently open
                      chatview = _converse.chatboxviews.get(contact_jid);

                spyOn(chatview, 'close').and.callThrough();
                spyOn(controlview, 'close').and.callThrough();
                spyOn(_converse.api, "trigger").and.callThrough();

                // We need to rebind all events otherwise our spy won't be called
                controlview.delegateEvents();
                chatview.delegateEvents();

                controlview.el.querySelector('.close-chatbox-button').click();

                expect(controlview.close).toHaveBeenCalled();
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                expect(_converse.api.trigger.calls.count(), 1);
                chatview.el.querySelector('.close-chatbox-button').click();

                expect(chatview.close).toHaveBeenCalled();
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                expect(_converse.api.trigger.calls.count(), 2);
                done();
            }));

            it("can be minimized by clicking a DOM element with class 'toggle-chatbox-button'",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);

                const contact_jid = mock.cur_names[7].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
                await test_utils.openChatBoxFor(_converse, contact_jid);
                const trimmed_chatboxes = _converse.minimized_chats;
                const chatview = _converse.chatboxviews.get(contact_jid);
                spyOn(chatview, 'minimize').and.callThrough();
                spyOn(_converse.api, "trigger").and.callThrough();
                // We need to rebind all events otherwise our spy won't be called
                chatview.delegateEvents();
                chatview.el.querySelector('.toggle-chatbox-button').click();

                expect(chatview.minimize).toHaveBeenCalled();
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMinimized', jasmine.any(Object));
                expect(_converse.api.trigger.calls.count(), 2);
                expect(u.isVisible(chatview.el)).toBeFalsy();
                expect(chatview.model.get('minimized')).toBeTruthy();
                chatview.el.querySelector('.toggle-chatbox-button').click();
                const trimmedview = trimmed_chatboxes.get(chatview.model.get('id'));
                spyOn(trimmedview, 'restore').and.callThrough();
                trimmedview.delegateEvents();
                trimmedview.el.querySelector("a.restore-chat").click();

                expect(trimmedview.restore).toHaveBeenCalled();
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxMaximized', jasmine.any(Object));
                expect(chatview.model.get('minimized')).toBeFalsy();
                done();
            }));

            it("will be removed from browserStorage when closed",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                spyOn(_converse.ChatBoxViews.prototype, 'trimChats');
                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
                spyOn(_converse.api, "trigger").and.callThrough();

                test_utils.closeControlBox();
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                expect(_converse.chatboxes.length).toEqual(1);
                expect(_converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                test_utils.openChatBoxes(_converse, 6);
                await u.waitUntil(() => _converse.chatboxes.length == 7)
                expect(_converse.chatboxviews.trimChats).toHaveBeenCalled();
                expect(_converse.chatboxes.length).toEqual(7);
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxViewInitialized', jasmine.any(Object));
                await test_utils.closeAllChatBoxes(_converse);

                expect(_converse.chatboxes.length).toEqual(1);
                expect(_converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
                const newchatboxes = new _converse.ChatBoxes();
                expect(newchatboxes.length).toEqual(0);
                expect(_converse.chatboxes.pluck('id')).toEqual(['controlbox']);
                // onConnected will fetch chatboxes in browserStorage, but
                // because there aren't any open chatboxes, there won't be any
                // in browserStorage either. XXX except for the controlbox
                newchatboxes.onConnected();
                await new Promise(resolve => _converse.api.listen.on('chatBoxesFetched', resolve));
                expect(newchatboxes.length).toEqual(1);
                expect(newchatboxes.models[0].id).toBe("controlbox");
                done();
            }));

            describe("A chat toolbar", function () {

                it("can be found on each chat box",
                    mock.initConverse(
                        ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        async function (done, _converse) {

                    await test_utils.waitForRoster(_converse, 'current', 3);
                    await test_utils.openControlBox(_converse);
                    const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await test_utils.openChatBoxFor(_converse, contact_jid);
                    const chatbox = _converse.chatboxes.get(contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
                    expect(chatbox).toBeDefined();
                    expect(view).toBeDefined();
                    const toolbar = view.el.querySelector('ul.chat-toolbar');
                    expect(_.isElement(toolbar)).toBe(true);
                    expect(toolbar.querySelectorAll(':scope > li').length).toBe(2);
                    done();
                }));

                it("shows the remaining character count if a message_limit is configured",
                    mock.initConverse(
                        ['rosterGroupsFetched', 'chatBoxesFetched'], {'message_limit': 200},
                        async function (done, _converse) {

                    await test_utils.waitForRoster(_converse, 'current', 3);
                    await test_utils.openControlBox(_converse);
                    const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await test_utils.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
                    const toolbar = view.el.querySelector('.chat-toolbar');
                    const counter = toolbar.querySelector('.message-limit');
                    expect(counter.textContent).toBe('200');
                    view.insertIntoTextArea('hello world');
                    expect(counter.textContent).toBe('188');

                    toolbar.querySelector('a.toggle-smiley').click();
                    const picker = await u.waitUntil(() => view.el.querySelector('.emoji-picker__lists'));
                    const item = await u.waitUntil(() => picker.querySelector('.emoji-picker li.insert-emoji a'));
                    item.click()
                    expect(counter.textContent).toBe('179');

                    const textarea = view.el.querySelector('.chat-textarea');
                    const ev = {
                        target: textarea,
                        preventDefault: function preventDefault () {},
                        keyCode: 13 // Enter
                    };
                    view.onKeyDown(ev);
                    await new Promise(resolve => view.once('messageInserted', resolve));
                    view.onKeyUp(ev);
                    expect(counter.textContent).toBe('200');

                    textarea.value = 'hello world';
                    view.onKeyUp(ev);
                    expect(counter.textContent).toBe('189');
                    done();
                }));


                it("does not show a remaining character count if message_limit is zero",
                    mock.initConverse(
                        ['rosterGroupsFetched', 'chatBoxesFetched'], {'message_limit': 0},
                        async function (done, _converse) {

                    await test_utils.waitForRoster(_converse, 'current', 3);
                    await test_utils.openControlBox(_converse);
                    const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await test_utils.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
                    const counter = view.el.querySelector('.chat-toolbar .message-limit');
                    expect(counter).toBe(null);
                    done();
                }));


                it("can contain a button for starting a call",
                    mock.initConverse(
                        ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        async function (done, _converse) {

                    await test_utils.waitForRoster(_converse, 'current');
                    await test_utils.openControlBox(_converse);

                    let toolbar, call_button;
                    const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    spyOn(_converse.api, "trigger").and.callThrough();
                    // First check that the button doesn't show if it's not enabled
                    // via "visible_toolbar_buttons"
                    _converse.visible_toolbar_buttons.call = false;
                    await test_utils.openChatBoxFor(_converse, contact_jid);
                    let view = _converse.chatboxviews.get(contact_jid);
                    toolbar = view.el.querySelector('ul.chat-toolbar');
                    call_button = toolbar.querySelector('.toggle-call');
                    expect(call_button === null).toBeTruthy();
                    view.close();
                    // Now check that it's shown if enabled and that it emits
                    // callButtonClicked
                    _converse.visible_toolbar_buttons.call = true; // enable the button
                    await test_utils.openChatBoxFor(_converse, contact_jid);
                    view = _converse.chatboxviews.get(contact_jid);
                    toolbar = view.el.querySelector('ul.chat-toolbar');
                    call_button = toolbar.querySelector('.toggle-call');
                    call_button.click();
                    expect(_converse.api.trigger).toHaveBeenCalledWith('callButtonClicked', jasmine.any(Object));
                    done();
                }));
            });

            describe("A Chat Status Notification", function () {

                it("does not open a new chatbox",
                    mock.initConverse(
                        ['rosterGroupsFetched'], {},
                        async function (done, _converse) {

                    await test_utils.waitForRoster(_converse, 'current');
                    await test_utils.openControlBox(_converse);

                    const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    // <composing> state
                    const stanza = $msg({
                            'from': sender_jid,
                            'to': _converse.connection.jid,
                            'type': 'chat',
                            'id': u.getUniqueId()
                        }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();

                    spyOn(_converse.api, "trigger").and.callThrough();
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    await u.waitUntil(() => _converse.api.trigger.calls.count());
                    expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                    expect(_converse.chatboxviews.keys().length).toBe(1);
                    done();
                }));

                describe("An active notification", function () {

                    it("is sent when the user opens a chat box",
                        mock.initConverse(
                            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                            async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current');
                        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        await test_utils.openControlBox(_converse);
                        u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
                        spyOn(_converse.connection, 'send');
                        await test_utils.openChatBoxFor(_converse, contact_jid);
                        const view = _converse.chatboxviews.get(contact_jid);
                        expect(view.model.get('chat_state')).toBe('active');
                        expect(_converse.connection.send).toHaveBeenCalled();
                        const stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
                        expect(stanza.getAttribute('to')).toBe(contact_jid);
                        expect(stanza.childNodes.length).toBe(3);
                        expect(stanza.childNodes[0].tagName).toBe('active');
                        expect(stanza.childNodes[1].tagName).toBe('no-store');
                        expect(stanza.childNodes[2].tagName).toBe('no-permanent-store');
                        done();
                    }));

                    it("is sent when the user maximizes a minimized a chat box", mock.initConverse(
                        ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                        async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current', 1);
                        await test_utils.openControlBox(_converse);
                        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                        await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
                        await test_utils.openChatBoxFor(_converse, contact_jid);
                        const view = _converse.chatboxviews.get(contact_jid);
                        view.model.minimize();
                        expect(view.model.get('chat_state')).toBe('inactive');
                        spyOn(_converse.connection, 'send');
                        view.model.maximize();
                        await u.waitUntil(() => view.model.get('chat_state') === 'active', 1000);
                        expect(_converse.connection.send).toHaveBeenCalled();
                        const calls = _.filter(_converse.connection.send.calls.all(), function (call) {
                            return call.args[0] instanceof Strophe.Builder;
                        });
                        expect(calls.length).toBe(1);
                        const stanza = calls[0].args[0].tree();
                        expect(stanza.getAttribute('to')).toBe(contact_jid);
                        expect(stanza.childNodes.length).toBe(3);
                        expect(stanza.childNodes[0].tagName).toBe('active');
                        expect(stanza.childNodes[1].tagName).toBe('no-store');
                        expect(stanza.childNodes[2].tagName).toBe('no-permanent-store');
                        done();
                    }));
                });

                describe("A composing notification", function () {

                    it("is sent as soon as the user starts typing a message which is not a command",
                        mock.initConverse(
                            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                            async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current');
                        await test_utils.openControlBox(_converse);
                        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                        await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
                        await test_utils.openChatBoxFor(_converse, contact_jid);
                        var view = _converse.chatboxviews.get(contact_jid);
                        expect(view.model.get('chat_state')).toBe('active');
                        spyOn(_converse.connection, 'send');
                        spyOn(_converse.api, "trigger").and.callThrough();
                        view.onKeyDown({
                            target: view.el.querySelector('textarea.chat-textarea'),
                            keyCode: 1
                        });
                        expect(view.model.get('chat_state')).toBe('composing');
                        expect(_converse.connection.send).toHaveBeenCalled();

                        const stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
                        expect(stanza.getAttribute('to')).toBe(contact_jid);
                        expect(stanza.childNodes.length).toBe(3);
                        expect(stanza.childNodes[0].tagName).toBe('composing');
                        expect(stanza.childNodes[1].tagName).toBe('no-store');
                        expect(stanza.childNodes[2].tagName).toBe('no-permanent-store');

                        // The notification is not sent again
                        view.onKeyDown({
                            target: view.el.querySelector('textarea.chat-textarea'),
                            keyCode: 1
                        });
                        expect(view.model.get('chat_state')).toBe('composing');
                        expect(_converse.api.trigger.calls.count(), 1);
                        done();
                    }));

                    it("is NOT sent out if send_chat_state_notifications doesn't allow it",
                        mock.initConverse(
                            ['rosterGroupsFetched', 'chatBoxesFetched'], {'send_chat_state_notifications': []},
                            async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current');
                        await test_utils.openControlBox(_converse);
                        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                        await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
                        await test_utils.openChatBoxFor(_converse, contact_jid);
                        var view = _converse.chatboxviews.get(contact_jid);
                        expect(view.model.get('chat_state')).toBe('active');
                        spyOn(_converse.connection, 'send');
                        spyOn(_converse.api, "trigger").and.callThrough();
                        view.onKeyDown({
                            target: view.el.querySelector('textarea.chat-textarea'),
                            keyCode: 1
                        });
                        expect(view.model.get('chat_state')).toBe('composing');
                        expect(_converse.connection.send).not.toHaveBeenCalled();
                        done();
                    }));

                    it("will be shown if received",
                        mock.initConverse(
                            ['rosterGroupsFetched'], {},
                            async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current');
                        await test_utils.openControlBox(_converse);

                        // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions
                        const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
                        await test_utils.openChatBoxFor(_converse, sender_jid);

                        // <composing> state
                        let msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: u.getUniqueId()
                            }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();

                        spyOn(_converse.api, "trigger").and.callThrough();
                        _converse.connection._dataRecv(test_utils.createRequest(msg));
                        await u.waitUntil(() => _converse.api.trigger.calls.count());
                        expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                        const view = _converse.chatboxviews.get(sender_jid);
                        expect(view).toBeDefined();

                        const event = await u.waitUntil(() => view.el.querySelector('.chat-state-notification'));
                        expect(event.textContent).toEqual(mock.cur_names[1] + ' is typing');

                        // Check that it doesn't appear twice
                        msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: u.getUniqueId()
                            }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        await _converse.handleMessageStanza(msg);
                        const events = view.el.querySelectorAll('.chat-state-notification');
                        expect(events.length).toBe(1);
                        expect(events[0].textContent).toEqual(mock.cur_names[1] + ' is typing');
                        done();
                    }));

                    it("can be a composing carbon message that this user sent from a different client",
                        mock.initConverse(
                            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                            async function (done, _converse) {

                        await test_utils.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
                        await u.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'));
                        await test_utils.waitForRoster(_converse, 'current');
                        // Send a message from a different resource
                        const recipient_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        const view = await test_utils.openChatBoxFor(_converse, recipient_jid);
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
                            }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        await _converse.handleMessageStanza(msg);
                        await u.waitUntil(() => view.model.messages.length);
                        // Check that the chatbox and its view now exist
                        const chatbox = _converse.chatboxes.get(recipient_jid);
                        const chatboxview = _converse.chatboxviews.get(recipient_jid);
                        // Check that the message was received and check the message parameters
                        expect(chatbox.messages.length).toEqual(1);
                        const msg_obj = chatbox.messages.models[0];
                        expect(msg_obj.get('sender')).toEqual('me');
                        expect(msg_obj.get('is_delayed')).toEqual(false);
                        const chat_content = chatboxview.el.querySelector('.chat-content');
                        const el = await u.waitUntil(() => chat_content.querySelector('.chat-info.chat-state-notification'));
                        const status_text = el.textContent;
                        expect(status_text).toBe('Typing from another device');
                        done();
                    }));
                });

                describe("A paused notification", function () {

                    it("is sent if the user has stopped typing since 30 seconds",
                        mock.initConverse(
                            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                            async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current');
                        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        await test_utils.openControlBox(_converse);
                        await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group li').length, 700);
                        _converse.TIMEOUTS.PAUSED = 200; // Make the timeout shorter so that we can test
                        await test_utils.openChatBoxFor(_converse, contact_jid);
                        const view = _converse.chatboxviews.get(contact_jid);
                        spyOn(_converse.connection, 'send');
                        spyOn(view.model, 'setChatState').and.callThrough();
                        expect(view.model.get('chat_state')).toBe('active');
                        view.onKeyDown({
                            target: view.el.querySelector('textarea.chat-textarea'),
                            keyCode: 1
                        });
                        expect(view.model.get('chat_state')).toBe('composing');
                        expect(_converse.connection.send).toHaveBeenCalled();
                        let stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
                        expect(stanza.childNodes[0].tagName).toBe('composing');
                        await u.waitUntil(() => view.model.get('chat_state') === 'paused', 500);
                        expect(_converse.connection.send).toHaveBeenCalled();
                        var calls = _.filter(_converse.connection.send.calls.all(), function (call) {
                            return call.args[0] instanceof Strophe.Builder;
                        });
                        expect(calls.length).toBe(2);
                        stanza = calls[1].args[0].tree();
                        expect(stanza.getAttribute('to')).toBe(contact_jid);
                        expect(stanza.childNodes.length).toBe(3);
                        expect(stanza.childNodes[0].tagName).toBe('paused');
                        expect(stanza.childNodes[1].tagName).toBe('no-store');
                        expect(stanza.childNodes[2].tagName).toBe('no-permanent-store');

                        // Test #359. A paused notification should not be sent
                        // out if the user simply types longer than the
                        // timeout.
                        view.onKeyDown({
                            target: view.el.querySelector('textarea.chat-textarea'),
                            keyCode: 1
                        });
                        expect(view.model.setChatState).toHaveBeenCalled();
                        expect(view.model.get('chat_state')).toBe('composing');

                        view.onKeyDown({
                            target: view.el.querySelector('textarea.chat-textarea'),
                            keyCode: 1
                        });
                        expect(view.model.get('chat_state')).toBe('composing');
                        done();
                    }));

                    it("will be shown if received",
                            mock.initConverse(
                                ['rosterGroupsFetched'], {},
                                async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current');
                        await test_utils.openControlBox(_converse);
                        await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
                        // TODO: only show paused state if the previous state was composing
                        // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions
                        spyOn(_converse.api, "trigger").and.callThrough();
                        const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        const view = await test_utils.openChatBoxFor(_converse, sender_jid);
                        // <paused> state
                        const msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: u.getUniqueId()
                            }).c('paused', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        await _converse.handleMessageStanza(msg);
                        expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                        await u.waitUntil(() => view.model.vcard.get('fullname') === mock.cur_names[1])
                        const event = await u.waitUntil(() => view.el.querySelector('.chat-state-notification'));
                        expect(event.textContent).toEqual(mock.cur_names[1] + ' has stopped typing');
                        done();
                    }));

                    it("can be a paused carbon message that this user sent from a different client",
                        mock.initConverse(
                            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                            async function (done, _converse) {

                        await test_utils.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
                        await u.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'));
                        await test_utils.waitForRoster(_converse, 'current');
                        // Send a message from a different resource
                        const recipient_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        const view = await test_utils.openChatBoxFor(_converse, recipient_jid);
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
                            }).c('paused', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        await _converse.handleMessageStanza(msg);
                        await u.waitUntil(() => view.model.messages.length);
                        // Check that the chatbox and its view now exist
                        const chatbox = _converse.chatboxes.get(recipient_jid);
                        const chatboxview = _converse.chatboxviews.get(recipient_jid);
                        // Check that the message was received and check the message parameters
                        expect(chatbox.messages.length).toEqual(1);
                        const msg_obj = chatbox.messages.models[0];
                        expect(msg_obj.get('sender')).toEqual('me');
                        expect(msg_obj.get('is_delayed')).toEqual(false);
                        const el = await u.waitUntil(() => chatboxview.el.querySelector('.chat-info.chat-state-notification'));
                        expect(el.textContent).toBe('Stopped typing on the other device');
                        done();
                    }));
                });

                describe("An inactive notifciation", function () {

                    it("is sent if the user has stopped typing since 2 minutes",
                        mock.initConverse(
                            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                            async function (done, _converse) {

                        const sent_stanzas = _converse.connection.sent_stanzas;
                        // Make the timeouts shorter so that we can test
                        _converse.TIMEOUTS.PAUSED = 100;
                        _converse.TIMEOUTS.INACTIVE = 100;

                        await test_utils.waitForRoster(_converse, 'current');
                        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        await test_utils.openControlBox(_converse);
                        await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 1000);
                        await test_utils.openChatBoxFor(_converse, contact_jid);
                        const view = _converse.chatboxviews.get(contact_jid);
                        await u.waitUntil(() => view.model.get('chat_state') === 'active');
                        let messages = await u.waitUntil(() => sent_stanzas.filter(s => s.matches('message')));
                        expect(messages.length).toBe(1);
                        expect(view.model.get('chat_state')).toBe('active');
                        view.onKeyDown({
                            target: view.el.querySelector('textarea.chat-textarea'),
                            keyCode: 1
                        });
                        await u.waitUntil(() => view.model.get('chat_state') === 'composing', 600);
                        messages = sent_stanzas.filter(s => s.matches('message'));
                        expect(messages.length).toBe(2);

                        await u.waitUntil(() => view.model.get('chat_state') === 'paused', 600);
                        messages = sent_stanzas.filter(s => s.matches('message'));
                        expect(messages.length).toBe(3);

                        await u.waitUntil(() => view.model.get('chat_state') === 'inactive', 600);
                        messages = sent_stanzas.filter(s => s.matches('message'));
                        expect(messages.length).toBe(4);

                        expect(Strophe.serialize(messages[0])).toBe(
                            `<message id="${messages[0].getAttribute('id')}" to="mercutio@montague.lit" type="chat" xmlns="jabber:client">`+
                                `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<no-store xmlns="urn:xmpp:hints"/>`+
                                `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
                            `</message>`);
                        expect(Strophe.serialize(messages[1])).toBe(
                            `<message id="${messages[1].getAttribute('id')}" to="mercutio@montague.lit" type="chat" xmlns="jabber:client">`+
                                `<composing xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<no-store xmlns="urn:xmpp:hints"/>`+
                                `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
                            `</message>`);
                        expect(Strophe.serialize(messages[2])).toBe(
                            `<message id="${messages[2].getAttribute('id')}" to="mercutio@montague.lit" type="chat" xmlns="jabber:client">`+
                                `<paused xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<no-store xmlns="urn:xmpp:hints"/>`+
                                `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
                            `</message>`);
                        expect(Strophe.serialize(messages[3])).toBe(
                            `<message id="${messages[3].getAttribute('id')}" to="mercutio@montague.lit" type="chat" xmlns="jabber:client">`+
                                `<inactive xmlns="http://jabber.org/protocol/chatstates"/>`+
                                `<no-store xmlns="urn:xmpp:hints"/>`+
                                `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
                            `</message>`);
                        done();
                    }));

                    it("is sent when the user a minimizes a chat box",
                        mock.initConverse(
                            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                            async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current');
                        await test_utils.openControlBox(_converse);

                        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        await test_utils.openChatBoxFor(_converse, contact_jid);
                        const view = _converse.chatboxviews.get(contact_jid);
                        spyOn(_converse.connection, 'send');
                        view.minimize();
                        expect(view.model.get('chat_state')).toBe('inactive');
                        expect(_converse.connection.send).toHaveBeenCalled();
                        var stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
                        expect(stanza.getAttribute('to')).toBe(contact_jid);
                        expect(stanza.childNodes[0].tagName).toBe('inactive');
                        done();
                    }));

                    it("is sent if the user closes a chat box",
                        mock.initConverse(
                            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                            async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current');
                        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        await test_utils.openControlBox(_converse);
                        await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length);
                        const view = await test_utils.openChatBoxFor(_converse, contact_jid);
                        expect(view.model.get('chat_state')).toBe('active');
                        spyOn(_converse.connection, 'send');
                        view.close();
                        expect(view.model.get('chat_state')).toBe('inactive');
                        expect(_converse.connection.send).toHaveBeenCalled();
                        const stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
                        expect(stanza.getAttribute('to')).toBe(contact_jid);
                        expect(stanza.childNodes.length).toBe(3);
                        expect(stanza.childNodes[0].tagName).toBe('inactive');
                        expect(stanza.childNodes[1].tagName).toBe('no-store');
                        expect(stanza.childNodes[2].tagName).toBe('no-permanent-store');
                        done();
                    }));

                    it("will clear any other chat status notifications",
                        mock.initConverse(
                            ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                            async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current');
                        await test_utils.openControlBox(_converse);
                        const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions
                        spyOn(_converse.api, "trigger").and.callThrough();
                        await test_utils.openChatBoxFor(_converse, sender_jid);
                        const view = _converse.chatboxviews.get(sender_jid);
                        expect(view.el.querySelectorAll('.chat-event').length).toBe(0);
                        // Insert <composing> message, to also check that
                        // text messages are inserted correctly with
                        // temporary chat events in the chat contents.
                        let msg = $msg({
                                'to': _converse.bare_jid,
                                'xmlns': 'jabber:client',
                                'from': sender_jid,
                                'type': 'chat'})
                            .c('composing', {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .tree();
                        await _converse.handleMessageStanza(msg);
                        await u.waitUntil(() => view.model.messages.length);
                        await u.waitUntil(() => view.el.querySelector('.chat-state-notification'));
                        expect(view.el.querySelectorAll('.chat-state-notification').length).toBe(1);
                        msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: u.getUniqueId()
                            }).c('inactive', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        await _converse.handleMessageStanza(msg);
                        await u.waitUntil(() => (view.model.messages.length > 1));
                        expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                        await u.waitUntil(() => view.el.querySelectorAll('.chat-state-notification').length === 0);
                        done();
                    }));
                });

                describe("A gone notifciation", function () {

                    it("will be shown if received",
                        mock.initConverse(
                            ['rosterGroupsFetched'], {},
                            async function (done, _converse) {

                        await test_utils.waitForRoster(_converse, 'current', 3);
                        await test_utils.openControlBox(_converse);

                        spyOn(_converse.api, "trigger").and.callThrough();
                        const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                        // <paused> state
                        const msg = $msg({
                                from: sender_jid,
                                to: _converse.connection.jid,
                                type: 'chat',
                                id: u.getUniqueId()
                            }).c('body').c('gone', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                        await _converse.handleMessageStanza(msg);
                        expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                        const view = _converse.chatboxviews.get(sender_jid);
                        await u.waitUntil(() => view.model.vcard.get('fullname') === mock.cur_names[1]);
                        const event = await u.waitUntil(() => view.el.querySelector('.chat-state-notification'));
                        expect(event.textContent).toEqual(mock.cur_names[1] + ' has gone away');
                        done();
                    }));
                });
            });
        });

        describe("Special Messages", function () {

            it("'/clear' can be used to clear messages in a conversation",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                spyOn(_converse.api, "trigger").and.callThrough();
                await test_utils.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                let message = 'This message is another sent from this chatbox';
                await test_utils.sendMessage(view, message);

                expect(view.model.messages.length === 1).toBeTruthy();
                let stored_messages = await view.model.messages.browserStorage.findAll();
                expect(stored_messages.length).toBe(1);
                await u.waitUntil(() => view.el.querySelector('.chat-msg'));

                message = '/clear';
                spyOn(view, 'clearMessages').and.callThrough();
                spyOn(window, 'confirm').and.callFake(function () {
                    return true;
                });
                view.el.querySelector('.chat-textarea').value = message;
                view.onKeyDown({
                    target: view.el.querySelector('textarea.chat-textarea'),
                    preventDefault: function preventDefault () {},
                    keyCode: 13
                });
                expect(view.clearMessages.calls.all().length).toBe(1);
                await view.clearMessages.calls.all()[0].returnValue;
                expect(window.confirm).toHaveBeenCalled();
                expect(view.model.messages.length, 0); // The messages must be removed from the chatbox
                stored_messages = await view.model.messages.browserStorage.findAll();
                expect(stored_messages.length).toBe(0);
                expect(_converse.api.trigger.calls.count(), 1);
                expect(_converse.api.trigger.calls.mostRecent().args, ['messageSend', message]);
                done();
            }));
        });

        describe("A Message Counter", function () {

            it("is incremented when the message is received and the window is not focused",
                    mock.initConverse(
                        ['rosterGroupsFetched'], {},
                        async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);

                expect(document.title).toBe('Converse Tests');

                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const view = await test_utils.openChatBoxFor(_converse, sender_jid)

                const previous_state = _converse.windowState;
                const message = 'This message will increment the message counter';
                const msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: u.getUniqueId()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                _converse.windowState = 'hidden';

                spyOn(_converse.api, "trigger").and.callThrough();
                spyOn(_converse, 'incrementMsgCounter').and.callThrough();
                spyOn(_converse, 'clearMsgCounter').and.callThrough();

                await _converse.handleMessageStanza(msg);
                await new Promise(resolve => view.once('messageInserted', resolve));
                expect(_converse.incrementMsgCounter).toHaveBeenCalled();
                expect(_converse.clearMsgCounter).not.toHaveBeenCalled();
                expect(document.title).toBe('Messages (1) Converse Tests');
                expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                _converse.windowSate = previous_state;
                done();
            }));

            it("is cleared when the window is focused",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);
                _converse.windowState = 'hidden';
                spyOn(_converse, 'clearMsgCounter').and.callThrough();
                _converse.saveWindowState(null, 'focus');
                _converse.saveWindowState(null, 'blur');
                expect(_converse.clearMsgCounter).toHaveBeenCalled();
                done();
            }));

            it("is not incremented when the message is received and the window is focused",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                await test_utils.openControlBox(_converse);

                expect(document.title).toBe('Converse Tests');
                spyOn(_converse, 'incrementMsgCounter').and.callThrough();
                _converse.saveWindowState(null, 'focus');
                const message = 'This message will not increment the message counter';
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                    msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: u.getUniqueId()
                    }).c('body').t(message).up()
                      .c('active', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                await _converse.handleMessageStanza(msg);
                expect(_converse.incrementMsgCounter).not.toHaveBeenCalled();
                expect(document.title).toBe('Converse Tests');
                done();
            }));

            it("is incremented from zero when chatbox was closed after viewing previously received messages and the window is not focused now",
                mock.initConverse(
                    ['rosterGroupsFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                // initial state
                expect(document.title).toBe('Converse Tests');
                const message = 'This message will always increment the message counter from zero',
                    sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                    msgFactory = function () {
                        return $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: u.getUniqueId()
                        })
                        .c('body').t(message).up()
                        .c('active', {'xmlns': Strophe.NS.CHATSTATES})
                        .tree();
                 };

                // leave converse-chat page
                _converse.windowState = 'hidden';
                await _converse.handleMessageStanza(msgFactory());
                let view = _converse.chatboxviews.get(sender_jid);
                expect(document.title).toBe('Messages (1) Converse Tests');

                // come back to converse-chat page
                _converse.saveWindowState(null, 'focus');
                await u.waitUntil(() => u.isVisible(view.el));
                expect(document.title).toBe('Converse Tests');

                // close chatbox and leave converse-chat page again
                view.close();
                _converse.windowState = 'hidden';

                // check that msg_counter is incremented from zero again
                await _converse.handleMessageStanza(msgFactory());
                view = _converse.chatboxviews.get(sender_jid);
                await u.waitUntil(() => u.isVisible(view.el));
                expect(document.title).toBe('Messages (1) Converse Tests');
                done();
            }));
        });

        describe("A ChatBox's Unread Message Count", function () {

            it("is incremented when the message is received and ChatBoxView is scrolled up",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                      msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');

                const view = await test_utils.openChatBoxFor(_converse, sender_jid)
                view.model.save('scrolled', true);
                await _converse.handleMessageStanza(msg);
                await u.waitUntil(() => view.model.messages.length);
                expect(view.model.get('num_unread')).toBe(1);
                done();
            }));

            it("is not incremented when the message is received and ChatBoxView is scrolled down",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');

                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                      msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be read');

                await test_utils.openChatBoxFor(_converse, sender_jid);
                const chatbox = _converse.chatboxes.get(sender_jid);
                await _converse.handleMessageStanza(msg);
                expect(chatbox.get('num_unread')).toBe(0);
                done();
            }));

            it("is incremeted when message is received, chatbox is scrolled down and the window is not focused",
                mock.initConverse(['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current');

                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const msgFactory = function () {
                    return test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                };
                await test_utils.openChatBoxFor(_converse, sender_jid);
                const chatbox = _converse.chatboxes.get(sender_jid);
                _converse.windowState = 'hidden';
                _converse.handleMessageStanza(msgFactory());
                await u.waitUntil(() => chatbox.messages.length);
                expect(chatbox.get('num_unread')).toBe(1);
                done();
            }));

            it("is incremeted when message is received, chatbox is scrolled up and the window is not focused",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const msgFactory = () => test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                await test_utils.openChatBoxFor(_converse, sender_jid);
                const chatbox = _converse.chatboxes.get(sender_jid);
                chatbox.save('scrolled', true);
                _converse.windowState = 'hidden';
                _converse.handleMessageStanza(msgFactory());
                await u.waitUntil(() => chatbox.messages.length);
                expect(chatbox.get('num_unread')).toBe(1);
                done();
            }));

            it("is cleared when ChatBoxView was scrolled down and the window become focused",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const msgFactory = () => test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                await test_utils.openChatBoxFor(_converse, sender_jid);
                const chatbox = _converse.chatboxes.get(sender_jid);
                _converse.windowState = 'hidden';
                _converse.handleMessageStanza(msgFactory());
                await u.waitUntil(() => chatbox.messages.length);
                expect(chatbox.get('num_unread')).toBe(1);
                _converse.saveWindowState(null, 'focus');
                expect(chatbox.get('num_unread')).toBe(0);
                done();
            }));

            it("is not cleared when ChatBoxView was scrolled up and the windows become focused",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const msgFactory = () => test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                await test_utils.openChatBoxFor(_converse, sender_jid);
                const chatbox = _converse.chatboxes.get(sender_jid);
                chatbox.save('scrolled', true);
                _converse.windowState = 'hidden';
                _converse.handleMessageStanza(msgFactory());
                await u.waitUntil(() => chatbox.messages.length);
                expect(chatbox.get('num_unread')).toBe(1);
                _converse.saveWindowState(null, 'focus');
                expect(chatbox.get('num_unread')).toBe(1);
                done();
            }));
        });

        describe("A RosterView's Unread Message Count", function () {

            it("is updated when message is received and chatbox is scrolled up",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                let msg, indicator_el;
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 500);
                await test_utils.openChatBoxFor(_converse, sender_jid);
                const chatbox = _converse.chatboxes.get(sender_jid);
                chatbox.save('scrolled', true);
                msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                await _converse.handleMessageStanza(msg);
                await u.waitUntil(() => chatbox.messages.length);
                const selector = 'a.open-chat:contains("' + chatbox.get('nickname') + '") .msgs-indicator';
                indicator_el = sizzle(selector, _converse.rosterview.el).pop();
                expect(indicator_el.textContent).toBe('1');
                msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread too');
                await _converse.handleMessageStanza(msg);
                await u.waitUntil(() => chatbox.messages.length > 1);
                indicator_el = sizzle(selector, _converse.rosterview.el).pop();
                expect(indicator_el.textContent).toBe('2');
                done();
            }));

            it("is updated when message is received and chatbox is minimized",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                let indicator_el, msg;
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 500);
                await test_utils.openChatBoxFor(_converse, sender_jid);
                const chatbox = _converse.chatboxes.get(sender_jid);
                var chatboxview = _converse.chatboxviews.get(sender_jid);
                chatboxview.minimize();

                msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread');
                await _converse.handleMessageStanza(msg);
                await u.waitUntil(() => chatbox.messages.length);
                const selector = 'a.open-chat:contains("' + chatbox.get('nickname') + '") .msgs-indicator';
                indicator_el = sizzle(selector, _converse.rosterview.el).pop();
                expect(indicator_el.textContent).toBe('1');

                msg = test_utils.createChatMessage(_converse, sender_jid, 'This message will be unread too');
                await _converse.handleMessageStanza(msg);
                await u.waitUntil(() => chatbox.messages.length === 2);
                indicator_el = sizzle(selector, _converse.rosterview.el).pop();
                expect(indicator_el.textContent).toBe('2');
                done();
            }));

            it("is cleared when chatbox is maximzied after receiving messages in minimized mode",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const msgFactory = () => test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 500);
                await test_utils.openChatBoxFor(_converse, sender_jid);
                const chatbox = _converse.chatboxes.get(sender_jid);
                const view = _converse.chatboxviews.get(sender_jid);
                const selector = 'a.open-chat:contains("' + chatbox.get('nickname') + '") .msgs-indicator';
                const select_msgs_indicator = () => sizzle(selector, _converse.rosterview.el).pop();
                view.minimize();
                _converse.handleMessageStanza(msgFactory());
                await u.waitUntil(() => chatbox.messages.length);
                expect(select_msgs_indicator().textContent).toBe('1');
                _converse.handleMessageStanza(msgFactory());
                await u.waitUntil(() => chatbox.messages.length > 1);
                expect(select_msgs_indicator().textContent).toBe('2');
                view.model.maximize();
                u.waitUntil(() => typeof select_msgs_indicator() === 'undefined');
                done();
            }));

            it("is cleared when unread messages are viewed which were received in scrolled-up chatbox",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.openControlBox(_converse);
                await test_utils.waitForRoster(_converse, 'current', 1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 500);
                await test_utils.openChatBoxFor(_converse, sender_jid);
                const chatbox = _converse.chatboxes.get(sender_jid);
                const msgFactory = () => test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
                const selector = `a.open-chat:contains("${chatbox.get('nickname')}") .msgs-indicator`;
                const select_msgs_indicator = () => sizzle(selector, _converse.rosterview.el).pop();
                chatbox.save('scrolled', true);
                _converse.handleMessageStanza(msgFactory());
                const view = _converse.chatboxviews.get(sender_jid);
                await u.waitUntil(() => view.model.messages.length);
                expect(select_msgs_indicator().textContent).toBe('1');
                view.viewUnreadMessages();
                _converse.rosterview.render();
                expect(select_msgs_indicator()).toBeUndefined();
                done();
            }));

            it("is not cleared after user clicks on roster view when chatbox is already opened and scrolled up",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await u.waitUntil(() => _converse.rosterview.el.querySelectorAll('.roster-group').length, 500);
                await test_utils.openChatBoxFor(_converse, sender_jid);
                const chatbox = _converse.chatboxes.get(sender_jid);
                const view = _converse.chatboxviews.get(sender_jid);
                const msg = 'This message will be received as unread, but eventually will be read';
                const msgFactory = () => test_utils.createChatMessage(_converse, sender_jid, msg);
                const selector = 'a.open-chat:contains("' + chatbox.get('nickname') + '") .msgs-indicator';
                const select_msgs_indicator = () => sizzle(selector, _converse.rosterview.el).pop();
                chatbox.save('scrolled', true);
                _converse.handleMessageStanza(msgFactory());
                await u.waitUntil(() => view.model.messages.length);
                expect(select_msgs_indicator().textContent).toBe('1');
                await test_utils.openChatBoxFor(_converse, sender_jid);
                expect(select_msgs_indicator().textContent).toBe('1');
                done();
            }));
        });

        describe("A Minimized ChatBoxView's Unread Message Count", function () {

            it("is displayed when scrolled up chatbox is minimized after receiving unread messages",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await test_utils.openChatBoxFor(_converse, sender_jid);
                const msgFactory = function () {
                    return test_utils.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
                };
                const selectUnreadMsgCount = function () {
                    const minimizedChatBoxView = _converse.minimized_chats.get(sender_jid);
                    return minimizedChatBoxView.el.querySelector('.message-count');
                };
                const chatbox = _converse.chatboxes.get(sender_jid);
                chatbox.save('scrolled', true);
                _converse.handleMessageStanza(msgFactory());
                await u.waitUntil(() => chatbox.messages.length);
                const chatboxview = _converse.chatboxviews.get(sender_jid);
                chatboxview.minimize();

                const unread_count = selectUnreadMsgCount();
                expect(u.isVisible(unread_count)).toBeTruthy();
                expect(unread_count.innerHTML).toBe('1');
                done();
            }));

            it("is incremented when message is received and windows is not focused",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);
                const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                const view = await test_utils.openChatBoxFor(_converse, sender_jid)
                const msgFactory = function () {
                    return test_utils.createChatMessage(_converse, sender_jid,
                        'This message will be received as unread, but eventually will be read');
                };
                const selectUnreadMsgCount = function () {
                    const minimizedChatBoxView = _converse.minimized_chats.get(sender_jid);
                    return minimizedChatBoxView.el.querySelector('.message-count');
                };
                view.minimize();
                _converse.handleMessageStanza(msgFactory());
                await u.waitUntil(() => view.model.messages.length);
                const unread_count = selectUnreadMsgCount();
                expect(u.isVisible(unread_count)).toBeTruthy();
                expect(unread_count.innerHTML).toBe('1');
                done();
            }));

            it("will render Openstreetmap-URL from geo-URI",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

                await test_utils.waitForRoster(_converse, 'current', 1);

                const message = "geo:37.786971,-122.399677",
                      contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                await test_utils.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                spyOn(view.model, 'sendMessage').and.callThrough();
                test_utils.sendMessage(view, message);
                await u.waitUntil(() => view.el.querySelectorAll('.chat-content .chat-msg').length, 1000);
                expect(view.model.sendMessage).toHaveBeenCalled();
                const msg = sizzle('.chat-content .chat-msg:last .chat-msg__text', view.el).pop();
                expect(msg.innerHTML).toEqual(
                    '<a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=37.786971&amp;'+
                    'mlon=-122.399677#map=18/37.786971/-122.399677">https://www.openstreetmap.org/?mlat=37.7869'+
                    '71&amp;mlon=-122.399677#map=18/37.786971/-122.399677</a>');
                done();
            }));
        });
    });
}));

