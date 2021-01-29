/*global mock, converse, _ */

const $msg = converse.env.$msg;
const Strophe = converse.env.Strophe;
const u = converse.env.utils;
const sizzle = converse.env.sizzle;
const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

describe("Chatboxes", function () {

    beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000));
    afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

    describe("A Chatbox", function () {

        it("has a /help command to show the available commands", mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            mock.sendMessage(view, '/help');

            await u.waitUntil(() => sizzle('.chat-info:not(.chat-date)', view.el).length);
            const info_messages = await u.waitUntil(() => sizzle('.chat-info:not(.chat-date)', view.el));
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
            const msg_txt_sel = 'converse-chat-message:last-child .chat-msg__body';
            await u.waitUntil(() => view.querySelector(msg_txt_sel).textContent.trim() === 'hello world');
            done();
        }));


        it("has a /clear command", mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            spyOn(window, 'confirm').and.returnValue(true);

            for (const i of Array(10).keys()) {
                mock.sendMessage(view, `Message ${i}`);
            }
            await u.waitUntil(() => sizzle('converse-chat-message', view.el).length === 10);

            const textarea = view.querySelector('textarea.chat-textarea');
            textarea.value = '/clear';
            view.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13 // Enter
            });
            expect(window.confirm).toHaveBeenCalled();
            await u.waitUntil(() => sizzle('converse-chat-message', view.el).length === 0);
            done();
        }));


        it("is created when you click on a roster item", mock.initConverse(
                ['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);

            // openControlBox was called earlier, so the controlbox is
            // visible, but no other chat boxes have been created.
            expect(_converse.chatboxes.length).toEqual(1);
            spyOn(_converse.minimize, 'trimChats');
            expect(document.querySelectorAll("#conversejs .chatbox").length).toBe(1); // Controlbox is open

            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group li').length, 700);
            const online_contacts = rosterview.querySelectorAll('.roster-group .current-xmpp-contact a.open-chat');
            expect(online_contacts.length).toBe(17);
            let el = online_contacts[0];
            el.click();
            await u.waitUntil(() => document.querySelectorAll("#conversejs .chatbox").length == 2);
            expect(_converse.minimize.trimChats).toHaveBeenCalled();
            online_contacts[1].click();
            await u.waitUntil(() => _converse.chatboxes.length == 3);
            el = online_contacts[1];
            expect(_converse.minimize.trimChats).toHaveBeenCalled();
            // Check that new chat boxes are created to the left of the
            // controlbox (but to the right of all existing chat boxes)
            expect(document.querySelectorAll("#conversejs .chatbox").length).toBe(3);
            done();
        }));

        it("opens when a new message is received", mock.initConverse(
                [], {'allow_non_roster_messaging': true},
                async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 0);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const stanza = u.toStanza(`
                <message from="${sender_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <body>Hey\nHave you heard the news?</body>
                </message>`);

            const message_promise = new Promise(resolve => _converse.api.listen.on('message', resolve));
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await new Promise(resolve => _converse.api.listen.once('chatBoxViewInitialized', resolve));
            await u.waitUntil(() => message_promise);
            expect(_converse.chatboxviews.keys().length).toBe(2);
            done();
        }));

        it("doesn't open when a message without body is received", mock.initConverse([], {}, async function (done, _converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const stanza = u.toStanza(`
                <message from="${sender_jid}"
                         type="chat"
                         to="romeo@montague.lit/orchard">
                    <composing xmlns="http://jabber.org/protocol/chatstates"/>
                </message>`);
            const message_promise = new Promise(resolve => _converse.api.listen.on('message', resolve))
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => message_promise);
            expect(_converse.chatboxviews.keys().length).toBe(1);
            done();
        }));

        it("is focused if its already open and you click on its corresponding roster item",
                mock.initConverse(['chatBoxesFetched'], {'auto_focus': true}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);
            expect(_converse.chatboxes.length).toEqual(1);

            const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            spyOn(_converse.ChatBoxView.prototype, 'focus').and.callThrough();
            const view = await mock.openChatBoxFor(_converse, contact_jid);
            const rosterview = document.querySelector('converse-roster');
            const el = sizzle('a.open-chat:contains("'+view.model.getDisplayName()+'")', rosterview.el).pop();
            await u.waitUntil(() => u.isVisible(el));
            const textarea = view.querySelector('.chat-textarea');
            await u.waitUntil(() => u.isVisible(textarea));
            textarea.blur();
            el.click();
            await u.waitUntil(() => view.focus.calls.count(), 1000);
            expect(view.focus).toHaveBeenCalled();
            expect(_converse.chatboxes.length).toEqual(2);
            done();
        }));

        it("can be saved to, and retrieved from, browserStorage",
                mock.initConverse([], {}, async function (done, _converse) {

            spyOn(_converse.minimize, 'trimChats');
            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);

            spyOn(_converse.api, "trigger").and.callThrough();

            mock.openChatBoxes(_converse, 6);
            await u.waitUntil(() => _converse.chatboxes.length == 7);
            expect(_converse.minimize.trimChats).toHaveBeenCalled();
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
            for (let i=0; i<attrs.length; i++) {
                new_attrs = _.map(_.map(newchatboxes.models, 'attributes'), attrs[i]);
                old_attrs = _.map(_.map(_converse.chatboxes.models, 'attributes'), attrs[i]);
                expect(_.isEqual(new_attrs, old_attrs)).toEqual(true);
            }
            done();
        }));

        it("can be closed by clicking a DOM element with class 'close-chatbox-button'",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current');
            const contact_jid = mock.cur_names[7].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
            await mock.openChatBoxFor(_converse, contact_jid);
            const chatview = _converse.chatboxviews.get(contact_jid);
            spyOn(chatview, 'close').and.callThrough();
            spyOn(_converse.api, "trigger").and.callThrough();
            // We need to rebind all events otherwise our spy won't be called
            chatview.delegateEvents();
            chatview.querySelector('.close-chatbox-button').click();
            expect(chatview.close).toHaveBeenCalled();
            await new Promise(resolve => _converse.api.listen.once('chatBoxClosed', resolve));
            expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
            done();
        }));

        it("will be removed from browserStorage when closed",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);
            spyOn(_converse.minimize, 'trimChats');
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
            spyOn(_converse.api, "trigger").and.callThrough();
            const promise = new Promise(resolve => _converse.api.listen.once('controlBoxClosed', resolve));
            mock.closeControlBox();
            await promise;
            expect(_converse.chatboxes.length).toEqual(1);
            expect(_converse.chatboxes.pluck('id')).toEqual(['controlbox']);
            mock.openChatBoxes(_converse, 6);
            await u.waitUntil(() => _converse.chatboxes.length == 7)
            expect(_converse.minimize.trimChats).toHaveBeenCalled();
            expect(_converse.chatboxes.length).toEqual(7);
            expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxViewInitialized', jasmine.any(Object));
            await mock.closeAllChatBoxes(_converse);

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

            it("shows the remaining character count if a message_limit is configured",
                    mock.initConverse(['chatBoxesFetched'], {'message_limit': 200}, async function (done, _converse) {

                await mock.waitForRoster(_converse, 'current', 3);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                const toolbar = view.querySelector('.chat-toolbar');
                const counter = toolbar.querySelector('.message-limit');
                expect(counter.textContent).toBe('200');
                view.insertIntoTextArea('hello world');
                expect(counter.textContent).toBe('188');

                toolbar.querySelector('.toggle-emojis').click();
                const picker = await u.waitUntil(() => view.querySelector('.emoji-picker__lists'));
                const item = await u.waitUntil(() => picker.querySelector('.emoji-picker li.insert-emoji a'));
                item.click()
                expect(counter.textContent).toBe('179');

                const textarea = view.querySelector('.chat-textarea');
                const ev = {
                    target: textarea,
                    preventDefault: function preventDefault () {},
                    keyCode: 13 // Enter
                };
                view.onKeyDown(ev);
                await new Promise(resolve => view.model.messages.once('rendered', resolve));
                view.onKeyUp(ev);
                expect(counter.textContent).toBe('200');

                textarea.value = 'hello world';
                view.onKeyUp(ev);
                expect(counter.textContent).toBe('189');
                done();
            }));


            it("does not show a remaining character count if message_limit is zero",
                    mock.initConverse(['chatBoxesFetched'], {'message_limit': 0}, async function (done, _converse) {

                await mock.waitForRoster(_converse, 'current', 3);
                await mock.openControlBox(_converse);
                const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                const counter = view.querySelector('.chat-toolbar .message-limit');
                expect(counter).toBe(null);
                done();
            }));


            it("can contain a button for starting a call",
                    mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

                await mock.waitForRoster(_converse, 'current');
                await mock.openControlBox(_converse);

                let toolbar, call_button;
                const contact_jid = mock.cur_names[2].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                spyOn(_converse.api, "trigger").and.callThrough();
                // First check that the button doesn't show if it's not enabled
                // via "visible_toolbar_buttons"
                _converse.visible_toolbar_buttons.call = false;
                await mock.openChatBoxFor(_converse, contact_jid);
                let view = _converse.chatboxviews.get(contact_jid);
                toolbar = view.querySelector('.chat-toolbar');
                call_button = toolbar.querySelector('.toggle-call');
                expect(call_button === null).toBeTruthy();
                view.close();
                // Now check that it's shown if enabled and that it emits
                // callButtonClicked
                _converse.visible_toolbar_buttons.call = true; // enable the button
                await mock.openChatBoxFor(_converse, contact_jid);
                view = _converse.chatboxviews.get(contact_jid);
                toolbar = view.querySelector('.chat-toolbar');
                call_button = toolbar.querySelector('.toggle-call');
                call_button.click();
                expect(_converse.api.trigger).toHaveBeenCalledWith('callButtonClicked', jasmine.any(Object));
                done();
            }));
        });

        describe("A Chat Status Notification", function () {

            it("does not open a new chatbox", mock.initConverse([], {}, async function (done, _converse) {
                await mock.waitForRoster(_converse, 'current');
                await mock.openControlBox(_converse);

                const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                // <composing> state
                const stanza = $msg({
                        'from': sender_jid,
                        'to': _converse.connection.jid,
                        'type': 'chat',
                        'id': u.getUniqueId()
                    }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();

                spyOn(_converse.api, "trigger").and.callThrough();
                _converse.connection._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => _converse.api.trigger.calls.count());
                expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                expect(_converse.chatboxviews.keys().length).toBe(1);
                done();
            }));

            describe("An active notification", function () {

                it("is sent when the user opens a chat box",
                        mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

                    await mock.waitForRoster(_converse, 'current');
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await mock.openControlBox(_converse);
                    const rosterview = document.querySelector('converse-roster');
                    u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
                    spyOn(_converse.connection, 'send');
                    await mock.openChatBoxFor(_converse, contact_jid);
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
                        ['chatBoxesFetched'], {}, async function (done, _converse) {

                    await mock.waitForRoster(_converse, 'current', 1);
                    await mock.openControlBox(_converse);
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                    const rosterview = document.querySelector('converse-roster');
                    await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
                    await mock.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
                    _converse.minimize.minimize(view.model);
                    expect(view.model.get('chat_state')).toBe('inactive');
                    spyOn(_converse.connection, 'send');
                    _converse.minimize.maximize(view.model);
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
                        mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

                    await mock.waitForRoster(_converse, 'current');
                    await mock.openControlBox(_converse);
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                    const rosterview = document.querySelector('converse-roster');
                    await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
                    await mock.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    expect(view.model.get('chat_state')).toBe('active');
                    spyOn(_converse.connection, 'send');
                    spyOn(_converse.api, "trigger").and.callThrough();
                    view.onKeyDown({
                        target: view.querySelector('textarea.chat-textarea'),
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
                        target: view.querySelector('textarea.chat-textarea'),
                        keyCode: 1
                    });
                    expect(view.model.get('chat_state')).toBe('composing');
                    expect(_converse.api.trigger.calls.count(), 1);
                    done();
                }));

                it("is NOT sent out if send_chat_state_notifications doesn't allow it",
                    mock.initConverse(['chatBoxesFetched'], {'send_chat_state_notifications': []},
                        async function (done, _converse) {

                    await mock.waitForRoster(_converse, 'current');
                    await mock.openControlBox(_converse);
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

                    const rosterview = document.querySelector('converse-roster');
                    await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
                    await mock.openChatBoxFor(_converse, contact_jid);
                    var view = _converse.chatboxviews.get(contact_jid);
                    expect(view.model.get('chat_state')).toBe('active');
                    spyOn(_converse.connection, 'send');
                    spyOn(_converse.api, "trigger").and.callThrough();
                    view.onKeyDown({
                        target: view.querySelector('textarea.chat-textarea'),
                        keyCode: 1
                    });
                    expect(view.model.get('chat_state')).toBe('composing');
                    expect(_converse.connection.send).not.toHaveBeenCalled();
                    done();
                }));

                it("will be shown if received", mock.initConverse([], {}, async function (done, _converse) {
                    await mock.waitForRoster(_converse, 'current');
                    await mock.openControlBox(_converse);

                    // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions
                    const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    const rosterview = document.querySelector('converse-roster');
                    await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
                    await mock.openChatBoxFor(_converse, sender_jid);

                    // <composing> state
                    let msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: u.getUniqueId()
                        }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();

                    _converse.connection._dataRecv(mock.createRequest(msg));
                    const view = _converse.chatboxviews.get(sender_jid);
                    let csn = mock.cur_names[1] + ' is typing';
                    await u.waitUntil( () => view.querySelector('.chat-content__notifications').innerText === csn);
                    expect(view.model.messages.length).toEqual(0);

                    // <paused> state
                    msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: u.getUniqueId()
                        }).c('paused', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    _converse.connection._dataRecv(mock.createRequest(msg));
                    csn = mock.cur_names[1] + ' has stopped typing';
                    await u.waitUntil( () => view.querySelector('.chat-content__notifications').innerText === csn);

                    msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: u.getUniqueId()
                        }).c('body').t('hello world').tree();
                    await _converse.handleMessageStanza(msg);
                    const msg_el = await u.waitUntil(() => view.content.querySelector('.chat-msg'));
                    await u.waitUntil( () => view.querySelector('.chat-content__notifications').innerText === '');
                    expect(msg_el.querySelector('.chat-msg__text').textContent).toBe('hello world');
                    done();
                }));

                it("is ignored if it's a composing carbon message sent by this user from a different client",
                        mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

                    await mock.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
                    await u.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'));
                    await mock.waitForRoster(_converse, 'current');
                    // Send a message from a different resource
                    const recipient_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    const view = await mock.openChatBoxFor(_converse, recipient_jid);

                    spyOn(u, 'shouldCreateMessage').and.callThrough();

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
                    _converse.connection._dataRecv(mock.createRequest(msg));

                    await u.waitUntil(() => u.shouldCreateMessage.calls.count());
                    expect(view.model.messages.length).toEqual(0);
                    const el = view.querySelector('.chat-content__notifications');
                    expect(el.textContent).toBe('');
                    done();
                }));
            });

            describe("A paused notification", function () {

                it("is sent if the user has stopped typing since 30 seconds",
                        mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

                    await mock.waitForRoster(_converse, 'current');
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await mock.openControlBox(_converse);
                    const rosterview = document.querySelector('converse-roster');
                    await u.waitUntil(() => rosterview.querySelectorAll('.roster-group li').length, 700);
                    _converse.TIMEOUTS.PAUSED = 200; // Make the timeout shorter so that we can test
                    await mock.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
                    spyOn(_converse.connection, 'send');
                    spyOn(view.model, 'setChatState').and.callThrough();
                    expect(view.model.get('chat_state')).toBe('active');
                    view.onKeyDown({
                        target: view.querySelector('textarea.chat-textarea'),
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
                        target: view.querySelector('textarea.chat-textarea'),
                        keyCode: 1
                    });
                    expect(view.model.setChatState).toHaveBeenCalled();
                    expect(view.model.get('chat_state')).toBe('composing');

                    view.onKeyDown({
                        target: view.querySelector('textarea.chat-textarea'),
                        keyCode: 1
                    });
                    expect(view.model.get('chat_state')).toBe('composing');
                    done();
                }));

                it("will be shown if received", mock.initConverse([], {}, async function (done, _converse) {
                    await mock.waitForRoster(_converse, 'current');
                    await mock.openControlBox(_converse);
                    const rosterview = document.querySelector('converse-roster');
                    await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
                    // TODO: only show paused state if the previous state was composing
                    // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions
                    spyOn(_converse.api, "trigger").and.callThrough();
                    const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    const view = await mock.openChatBoxFor(_converse, sender_jid);
                    // <paused> state
                    const msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: u.getUniqueId()
                        }).c('paused', {'xmlns': Strophe.NS.CHATSTATES}).tree();

                    _converse.connection._dataRecv(mock.createRequest(msg));
                    const csn = mock.cur_names[1] +  ' has stopped typing';
                    await u.waitUntil( () => view.querySelector('.chat-content__notifications').innerText === csn);
                    expect(view.model.messages.length).toEqual(0);
                    done();
                }));

                it("will not be shown if it's a paused carbon message that this user sent from a different client",
                        mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

                    await mock.waitUntilDiscoConfirmed(_converse, 'montague.lit', [], ['vcard-temp']);
                    await u.waitUntil(() => _converse.xmppstatus.vcard.get('fullname'));
                    await mock.waitForRoster(_converse, 'current');
                    // Send a message from a different resource
                    const recipient_jid = mock.cur_names[5].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    spyOn(u, 'shouldCreateMessage').and.callThrough();
                    const view = await mock.openChatBoxFor(_converse, recipient_jid);
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
                    _converse.connection._dataRecv(mock.createRequest(msg));
                    await u.waitUntil(() => u.shouldCreateMessage.calls.count());
                    expect(view.model.messages.length).toEqual(0);
                    const el = view.querySelector('.chat-content__notifications');
                    expect(el.textContent).toBe('');
                    done();
                    done();
                }));
            });

            describe("An inactive notification", function () {

                it("is sent if the user has stopped typing since 2 minutes",
                        mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

                    const sent_stanzas = _converse.connection.sent_stanzas;
                    // Make the timeouts shorter so that we can test
                    _converse.TIMEOUTS.PAUSED = 100;
                    _converse.TIMEOUTS.INACTIVE = 100;

                    await mock.waitForRoster(_converse, 'current');
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await mock.openControlBox(_converse);
                    const rosterview = document.querySelector('converse-roster');
                    await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length, 1000);
                    await mock.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
                    await u.waitUntil(() => view.model.get('chat_state') === 'active');
                    let messages = await u.waitUntil(() => sent_stanzas.filter(s => s.matches('message')));
                    expect(messages.length).toBe(1);
                    expect(view.model.get('chat_state')).toBe('active');
                    view.onKeyDown({
                        target: view.querySelector('textarea.chat-textarea'),
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
                    mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

                    await mock.waitForRoster(_converse, 'current');
                    await mock.openControlBox(_converse);

                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await mock.openChatBoxFor(_converse, contact_jid);
                    const view = _converse.chatboxviews.get(contact_jid);
                    spyOn(_converse.connection, 'send');
                    _converse.minimize.minimize(view.model);
                    expect(view.model.get('chat_state')).toBe('inactive');
                    expect(_converse.connection.send).toHaveBeenCalled();
                    var stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
                    expect(stanza.getAttribute('to')).toBe(contact_jid);
                    expect(stanza.childNodes[0].tagName).toBe('inactive');
                    done();
                }));

                it("is sent if the user closes a chat box",
                        mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

                    await mock.waitForRoster(_converse, 'current');
                    const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await mock.openControlBox(_converse);
                    const rosterview = document.querySelector('converse-roster');
                    await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
                    const view = await mock.openChatBoxFor(_converse, contact_jid);
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
                        mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

                    await mock.waitForRoster(_converse, 'current');
                    await mock.openControlBox(_converse);
                    const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions
                    await mock.openChatBoxFor(_converse, sender_jid);
                    const view = _converse.chatboxviews.get(sender_jid);
                    expect(view.querySelectorAll('.chat-event').length).toBe(0);
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
                    _converse.connection._dataRecv(mock.createRequest(msg));
                    const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
                    expect(csntext).toEqual(mock.cur_names[1] + ' is typing');
                    expect(view.model.messages.length).toBe(0);

                    msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: u.getUniqueId()
                        }).c('inactive', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    _converse.connection._dataRecv(mock.createRequest(msg));

                    await u.waitUntil(() => !view.querySelector('.chat-content__notifications').textContent);
                    done();
                }));
            });

            describe("A gone notification", function () {

                it("will be shown if received", mock.initConverse([], {}, async function (done, _converse) {
                    await mock.waitForRoster(_converse, 'current', 3);
                    await mock.openControlBox(_converse);
                    const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    await mock.openChatBoxFor(_converse, sender_jid);

                    const msg = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: u.getUniqueId()
                        }).c('body').c('gone', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    _converse.connection._dataRecv(mock.createRequest(msg));

                    const view = _converse.chatboxviews.get(sender_jid);
                    const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
                    expect(csntext).toEqual(mock.cur_names[1] + ' has gone away');
                    done();
                }));
            });

            describe("On receiving a message correction", function () {

                it("will be removed", mock.initConverse([], {}, async function (done, _converse) {
                    await mock.waitForRoster(_converse, 'current');
                    await mock.openControlBox(_converse);

                    // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions
                    const sender_jid = mock.cur_names[1].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                    const rosterview = document.querySelector('converse-roster');
                    await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length);
                    await mock.openChatBoxFor(_converse, sender_jid);

                    // Original message
                    const original_id = u.getUniqueId();
                    const original = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: original_id,
                        body: "Original message",
                    }).c('active', {'xmlns': Strophe.NS.CHATSTATES}).tree();

                    spyOn(_converse.api, "trigger").and.callThrough();
                    _converse.connection._dataRecv(mock.createRequest(original));
                    await u.waitUntil(() => _converse.api.trigger.calls.count());
                    expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
                    const view = _converse.chatboxviews.get(sender_jid);
                    expect(view).toBeDefined();

                    // <composing> state
                    const msg = $msg({
                        from: sender_jid,
                        to: _converse.connection.jid,
                        type: 'chat',
                        id: u.getUniqueId()
                    }).c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                    _converse.connection._dataRecv(mock.createRequest(msg));

                    const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
                    expect(csntext).toEqual(mock.cur_names[1] + ' is typing');

                    // Edited message
                    const edited = $msg({
                            from: sender_jid,
                            to: _converse.connection.jid,
                            type: 'chat',
                            id: u.getUniqueId(),
                            body: "Edited message",
                        })
                        .c('active', {'xmlns': Strophe.NS.CHATSTATES}).up()
                        .c('replace', {'xmlns': Strophe.NS.MESSAGE_CORRECT, 'id': original_id }).tree();

                    await _converse.handleMessageStanza(edited);
                    await u.waitUntil(() => !view.querySelector('.chat-content__notifications').textContent);
                    done();
                }));
            });
        });
    });

    describe("Special Messages", function () {

        it("'/clear' can be used to clear messages in a conversation",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current');
            await mock.openControlBox(_converse);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

            spyOn(_converse.api, "trigger").and.callThrough();
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            let message = 'This message is another sent from this chatbox';
            await mock.sendMessage(view, message);

            expect(view.model.messages.length === 1).toBeTruthy();
            let stored_messages = await view.model.messages.browserStorage.findAll();
            expect(stored_messages.length).toBe(1);
            await u.waitUntil(() => view.querySelector('.chat-msg'));

            message = '/clear';
            spyOn(view, 'clearMessages').and.callThrough();
            spyOn(window, 'confirm').and.callFake(function () {
                return true;
            });
            view.querySelector('.chat-textarea').value = message;
            view.onKeyDown({
                target: view.querySelector('textarea.chat-textarea'),
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

    describe("A ChatBox's Unread Message Count", function () {

        it("is incremented when the message is received and ChatBoxView is scrolled up",
            mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit',
                  msg = mock.createChatMessage(_converse, sender_jid, 'This message will be unread');

            const view = await mock.openChatBoxFor(_converse, sender_jid)
            const sent_stanzas = [];
            spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
            view.model.save('scrolled', true);
            await _converse.handleMessageStanza(msg);
            await u.waitUntil(() => view.model.messages.length);
            expect(view.model.get('num_unread')).toBe(1);
            const msgid = view.model.messages.last().get('id');
            expect(view.model.get('first_unread_id')).toBe(msgid);
            await u.waitUntil(() => sent_stanzas.length);
            expect(sent_stanzas[0].querySelector('received')).toBeDefined();
            done();
        }));

        it("is not incremented when the message is received and ChatBoxView is scrolled down",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

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
            done();
        }));

        it("is incremented when message is received, chatbox is scrolled down and the window is not focused",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

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
            done();
        }));

        it("is incremented when message is received, chatbox is scrolled up and the window is not focused",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be unread');
            await mock.openChatBoxFor(_converse, sender_jid);
            const sent_stanzas = [];
            spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
            const chatbox = _converse.chatboxes.get(sender_jid);
            chatbox.save('scrolled', true);
            _converse.windowState = 'hidden';
            const msg = msgFactory();
            _converse.handleMessageStanza(msg);
            await u.waitUntil(() => chatbox.messages.length);
            expect(chatbox.get('num_unread')).toBe(1);
            const msgid = chatbox.messages.last().get('id');
            expect(chatbox.get('first_unread_id')).toBe(msgid);
            await u.waitUntil(() => sent_stanzas.filter(s => s.nodeName === 'message').length === 1);
            expect(sent_stanzas[0].querySelector('received')).toBeDefined();
            done();
        }));

        it("is cleared when ChatBoxView was scrolled down and the window become focused",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

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
            done();
        }));

        it("is not cleared when ChatBoxView was scrolled up and the windows become focused",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be unread');
            await mock.openChatBoxFor(_converse, sender_jid);
            const sent_stanzas = [];
            spyOn(_converse.connection, 'send').and.callFake(s => sent_stanzas.push(s?.nodeTree ?? s));
            const chatbox = _converse.chatboxes.get(sender_jid);
            chatbox.save('scrolled', true);
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
            done();
        }));
    });

    describe("A RosterView's Unread Message Count", function () {

        it("is updated when message is received and chatbox is scrolled up",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            let msg, indicator_el;
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length, 500);
            await mock.openChatBoxFor(_converse, sender_jid);
            const chatbox = _converse.chatboxes.get(sender_jid);
            chatbox.save('scrolled', true);
            msg = mock.createChatMessage(_converse, sender_jid, 'This message will be unread');
            await _converse.handleMessageStanza(msg);
            await u.waitUntil(() => chatbox.messages.length);
            const selector = 'a.open-chat:contains("' + chatbox.get('nickname') + '") .msgs-indicator';
            indicator_el = sizzle(selector, rosterview.el).pop();
            expect(indicator_el.textContent).toBe('1');
            msg = mock.createChatMessage(_converse, sender_jid, 'This message will be unread too');
            await _converse.handleMessageStanza(msg);
            await u.waitUntil(() => chatbox.messages.length > 1);
            indicator_el = sizzle(selector, rosterview.el).pop();
            expect(indicator_el.textContent).toBe('2');
            done();
        }));

        it("is updated when message is received and chatbox is minimized",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';

            let indicator_el, msg;
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length, 500);
            await mock.openChatBoxFor(_converse, sender_jid);
            const chatbox = _converse.chatboxes.get(sender_jid);
            _converse.minimize.minimize(chatbox);

            msg = mock.createChatMessage(_converse, sender_jid, 'This message will be unread');
            await _converse.handleMessageStanza(msg);
            await u.waitUntil(() => chatbox.messages.length);
            const selector = 'a.open-chat:contains("' + chatbox.get('nickname') + '") .msgs-indicator';
            indicator_el = sizzle(selector, rosterview.el).pop();
            expect(indicator_el.textContent).toBe('1');

            msg = mock.createChatMessage(_converse, sender_jid, 'This message will be unread too');
            await _converse.handleMessageStanza(msg);
            await u.waitUntil(() => chatbox.messages.length === 2);
            indicator_el = sizzle(selector, rosterview.el).pop();
            expect(indicator_el.textContent).toBe('2');
            done();
        }));

        it("is cleared when chatbox is maximzied after receiving messages in minimized mode",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length, 500);
            await mock.openChatBoxFor(_converse, sender_jid);
            const chatbox = _converse.chatboxes.get(sender_jid);
            const view = _converse.chatboxviews.get(sender_jid);
            const selector = 'a.open-chat:contains("' + chatbox.get('nickname') + '") .msgs-indicator';
            const select_msgs_indicator = () => sizzle(selector, rosterview.el).pop();
            _converse.minimize.minimize(view.model);
            _converse.handleMessageStanza(msgFactory());
            await u.waitUntil(() => chatbox.messages.length);
            expect(select_msgs_indicator().textContent).toBe('1');
            _converse.handleMessageStanza(msgFactory());
            await u.waitUntil(() => chatbox.messages.length > 1);
            expect(select_msgs_indicator().textContent).toBe('2');
            _converse.minimize.minimize(view.model);
            u.waitUntil(() => typeof select_msgs_indicator() === 'undefined');
            done();
        }));

        it("is cleared when unread messages are viewed which were received in scrolled-up chatbox",
            mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 1);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length, 500);
            await mock.openChatBoxFor(_converse, sender_jid);
            const chatbox = _converse.chatboxes.get(sender_jid);
            const msgFactory = () => mock.createChatMessage(_converse, sender_jid, 'This message will be received as unread, but eventually will be read');
            const selector = `a.open-chat:contains("${chatbox.get('nickname')}") .msgs-indicator`;
            const select_msgs_indicator = () => sizzle(selector, rosterview.el).pop();
            chatbox.save('scrolled', true);
            _converse.handleMessageStanza(msgFactory());
            const view = _converse.chatboxviews.get(sender_jid);
            await u.waitUntil(() => view.model.messages.length);
            expect(select_msgs_indicator().textContent).toBe('1');
            view.viewUnreadMessages();
            rosterview.render();
            await u.waitUntil(() => select_msgs_indicator() === undefined);
            done();
        }));

        it("is not cleared after user clicks on roster view when chatbox is already opened and scrolled up",
                mock.initConverse(['chatBoxesFetched'], {}, async function (done, _converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const sender_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group').length, 500);
            await mock.openChatBoxFor(_converse, sender_jid);
            const chatbox = _converse.chatboxes.get(sender_jid);
            const view = _converse.chatboxviews.get(sender_jid);
            const msg = 'This message will be received as unread, but eventually will be read';
            const msgFactory = () => mock.createChatMessage(_converse, sender_jid, msg);
            const selector = 'a.open-chat:contains("' + chatbox.get('nickname') + '") .msgs-indicator';
            const select_msgs_indicator = () => sizzle(selector, rosterview.el).pop();
            chatbox.save('scrolled', true);
            _converse.handleMessageStanza(msgFactory());
            await u.waitUntil(() => view.model.messages.length);
            expect(select_msgs_indicator().textContent).toBe('1');
            await mock.openChatBoxFor(_converse, sender_jid);
            expect(select_msgs_indicator().textContent).toBe('1');
            done();
        }));
    });
});
