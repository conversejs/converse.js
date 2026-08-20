import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, stx } = converse.env;
const u = converse.env.utils;

describe('Notifications', function () {
    // Implement the protocol defined in https://xmpp.org/extensions/xep-0313.html#config

    describe('When show_desktop_notifications is set to true', function () {
        describe('And the desktop is not focused', function () {
            describe('an HTML5 Notification', function () {
                it(
                    'is shown when a new private message is received',
                    mock.initConverse(converse, [], {}, async (_converse) => {
                        await mock.waitForRoster(_converse, 'current');
                        const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                        spyOn(window, 'Notification').and.returnValue(stub);

                        const message = 'This message will show a desktop notification';
                        const sender_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit',
                            msg = stx`
                                <message from="${sender_jid}"
                                         to="${_converse.api.connection.get().jid}"
                                         type="chat"
                                         id="${u.getUniqueId()}"
                                         xmlns="jabber:client">
                                    <body>${message}</body>
                                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                                </message>`;
                        await _converse.handleMessageStanza(msg); // This will emit 'message'
                        await u.waitUntil(() => _converse.chatboxviews.get(sender_jid));
                        expect(window.Notification).toHaveBeenCalled();
                    }),
                );

                it(
                    'is shown when you are mentioned in a groupchat',
                    mock.initConverse(converse, [], {}, async (_converse) => {
                        await mock.waitForRoster(_converse, 'current');
                        await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
                        const view = _converse.chatboxviews.get('lounge@montague.lit');
                        const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                        spyOn(window, 'Notification').and.returnValue(stub);

                        // Test mention with setting false
                        const nick = mock.chatroom_names[0];
                        const makeMsg = (text) => stx`
                            <message from="lounge@montague.lit/${nick}"
                                     id="${u.getUniqueId()}"
                                     to="romeo@montague.lit"
                                     type="groupchat"
                                     xmlns="jabber:client">
                                <body>${text}</body>
                            </message>`;
                        _converse.api.connection
                            .get()
                            ._dataRecv(mock.createRequest(_converse, makeMsg('romeo: this will NOT show a notification')));
                        await new Promise((resolve) => view.model.messages.once('rendered', resolve));
                        expect(window.Notification).not.toHaveBeenCalled();

                        // Test reference
                        const message_with_ref = stx`
                            <message from="lounge@montague.lit/${nick}"
                                     id="${u.getUniqueId()}"
                                     to="romeo@montague.lit"
                                     type="groupchat"
                                     xmlns="jabber:client">
                                <body>romeo: this will show a notification</body>
                                <reference xmlns="urn:xmpp:reference:0"
                                           begin="0"
                                           end="5"
                                           type="mention"
                                           uri="xmpp:romeo@montague.lit"/>
                            </message>`;
                        _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, message_with_ref));
                        await new Promise((resolve) => view.model.messages.once('rendered', resolve));
                        expect(window.Notification.calls.count()).toBe(1);

                        // Test mention with setting true
                        _converse.api.settings.set('notify_all_room_messages', true);
                        _converse.api.connection
                            .get()
                            ._dataRecv(mock.createRequest(_converse, makeMsg('romeo: this will show a notification')));
                        await new Promise((resolve) => view.model.messages.once('rendered', resolve));
                        expect(window.Notification.calls.count()).toBe(2);
                    }),
                );

                it(
                    'is shown for headline messages',
                    mock.initConverse(converse, [], {}, async (_converse) => {
                        const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                        spyOn(window, 'Notification').and.returnValue(stub);

                        await mock.waitForRoster(_converse, 'current', 0);
                        const stanza = stx`
                            <message type="headline"
                                     from="notify.example.com"
                                     to="romeo@montague.lit"
                                     xml:lang="en"
                                     xmlns="jabber:client">
                                <subject>SIEVE</subject>
                                <body>&lt;juliet@example.com&gt; You got mail.</body>
                                <x xmlns="jabber:x:oob">
                                    <url>imap://romeo@example.com/INBOX;UIDVALIDITY=385759043/;UID=18</url>
                                </x>
                            </message>`;
                        _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

                        await u.waitUntil(() => _converse.chatboxviews.keys().length === 1);
                        expect(_converse.chatboxviews.keys().includes('notify.example.com')).toBeTruthy();
                        expect(window.Notification).toHaveBeenCalled();
                    }),
                );

                it(
                    'is not shown for full JID headline messages if allow_non_roster_messaging is false',
                    mock.initConverse(converse, [], { 'allow_non_roster_messaging': false }, (_converse) => {
                        const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                        spyOn(window, 'Notification').and.returnValue(stub);
                        const stanza = stx`
                            <message type="headline"
                                     from="someone@notify.example.com"
                                     to="romeo@montague.lit"
                                     xml:lang="en"
                                     xmlns="jabber:client">
                                <subject>SIEVE</subject>
                                <body>&lt;juliet@example.com&gt; You got mail.</body>
                                <x xmlns="jabber:x:oob">
                                    <url>imap://romeo@example.com/INBOX;UIDVALIDITY=385759043/;UID=18</url>
                                </x>
                            </message>`;
                        _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
                        expect(_converse.chatboxviews.keys().includes('someone@notify.example.com')).toBeFalsy();
                        expect(window.Notification).not.toHaveBeenCalled();
                    }),
                );

                it(
                    'is shown when a user changes their chat state (if show_chat_state_notifications is true)',
                    mock.initConverse(converse, [], { show_chat_state_notifications: true }, async (_converse) => {
                        await mock.waitForRoster(_converse, 'current', 3);
                        const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                        spyOn(window, 'Notification').and.returnValue(stub);
                        const jid = mock.cur_names[2].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                        _converse.roster.get(jid).presence.set('show', 'dnd');
                        expect(window.Notification).toHaveBeenCalled();
                    }),
                );
            });
        });

        describe('When a new contact request is received', function () {
            it(
                'an HTML5 Notification is received',
                mock.initConverse(converse, (_converse) => {
                    const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                    spyOn(window, 'Notification').and.returnValue(stub);
                    _converse.api.trigger('contactRequest', { 'getDisplayName': () => 'Peter Parker' });
                    expect(window.Notification).toHaveBeenCalled();
                }),
            );
        });
    });

    describe('When play_sounds is set to true', function () {
        describe('A notification sound', function () {
            it(
                'is played when the current user is mentioned in a groupchat',
                mock.initConverse(converse, [], {}, async (_converse) => {
                    await mock.waitForRoster(_converse, 'current');
                    await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
                    const { api } = _converse;
                    api.settings.set('play_sounds', true);

                    const stub = jasmine.createSpyObj('MyAudio', ['play', 'canPlayType']);
                    spyOn(window, 'Audio').and.returnValue(stub);

                    const view = _converse.chatboxviews.get('lounge@montague.lit');
                    if (!view.querySelectorAll('.chat-area').length) {
                        view.renderChatArea();
                    }
                    let text = 'This message will play a sound because it mentions romeo';
                    let message = stx`
                        <message from="lounge@montague.lit/otheruser"
                                 id="1"
                                 to="romeo@montague.lit"
                                 type="groupchat"
                                 xmlns="jabber:client">
                            <body>${text}</body>
                        </message>`;
                    _converse.api.settings.set('notify_all_room_messages', true);
                    await view.model.handleMessageStanza(message);
                    await u.waitUntil(() => window.Audio.calls.count());
                    expect(window.Audio).toHaveBeenCalled();

                    text = "This message won't play a sound";
                    message = stx`
                        <message from="lounge@montague.lit/otheruser"
                                 id="2"
                                 to="romeo@montague.lit"
                                 type="groupchat"
                                 xmlns="jabber:client">
                            <body>${text}</body>
                        </message>`;
                    await view.model.handleMessageStanza(message);
                    expect(window.Audio, 1);
                    api.settings.set('play_sounds', false);

                    text = "This message won't play a sound because it is sent by romeo";
                    message = stx`
                        <message from="lounge@montague.lit/romeo"
                                 id="3"
                                 to="romeo@montague.lit"
                                 type="groupchat"
                                 xmlns="jabber:client">
                            <body>${text}</body>
                        </message>`;
                    await view.model.handleMessageStanza(message);
                    expect(window.Audio, 1);
                }),
            );
        });
    });

    describe('A Favicon Message Counter', function () {
        it(
            'is incremented when the message is received and the window is not focused',
            mock.initConverse(converse, [], { 'show_tab_notifications': false }, async function (_converse) {
                await mock.waitForRoster(_converse, 'current');
                await mock.openControlBox(_converse);

                const favico = jasmine.createSpyObj('favico', ['badge']);
                spyOn(converse.env, 'Favico').and.returnValue(favico);

                const sender_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                const view = await mock.openChatBoxFor(_converse, sender_jid);
                spyOn(view.model, 'isHidden').and.returnValue(true);

                const msg = stx`
                    <message from="${sender_jid}"
                             to="${_converse.api.connection.get().jid}"
                             type="chat"
                             id="${u.getUniqueId()}"
                             xmlns="jabber:client">
                        <body>This message will increment the message counter</body>
                        <active xmlns="${Strophe.NS.CHATSTATES}"/>
                    </message>`;

                spyOn(_converse.api, 'trigger').and.callThrough();

                await _converse.handleMessageStanza(msg);
                expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));

                expect(favico.badge.calls.count()).toBe(0);

                _converse.api.settings.set('show_tab_notifications', true);
                const msg2 = stx`
                    <message from="${sender_jid}"
                             to="${_converse.api.connection.get().jid}"
                             type="chat"
                             id="${u.getUniqueId()}"
                             xmlns="jabber:client">
                        <body>This message increment the message counter AND update the page title</body>
                        <active xmlns="${Strophe.NS.CHATSTATES}"/>
                    </message>`;

                await _converse.handleMessageStanza(msg2);
                await u.waitUntil(() => favico.badge.calls.count() === 1);
                expect(favico.badge.calls.mostRecent().args.pop()).toBe(2);

                expect(view.model.get('num_unread')).toBe(2);

                // Check that it's cleared when the window is focused
                view.model.isHidden.and.returnValue(false);
                document.dispatchEvent(new Event('visibilitychange'));

                await u.waitUntil(() => favico.badge.calls.count() === 2);
                expect(favico.badge.calls.mostRecent().args.pop()).toBe(0);

                expect(view.model.get('num_unread')).toBe(0);
            }),
        );

        it(
            'is not incremented when the message is received and the window is focused',
            mock.initConverse(converse, [], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current');
                await mock.openControlBox(_converse);

                const favico = jasmine.createSpyObj('favico', ['badge']);
                spyOn(converse.env, 'Favico').and.returnValue(favico);

                document.dispatchEvent(new Event('visibilitychange'));
                const message = 'This message will not increment the message counter';
                const sender_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit',
                    msg = stx`
                        <message from="${sender_jid}"
                                 to="${_converse.api.connection.get().jid}"
                                 type="chat"
                                 id="${u.getUniqueId()}"
                                 xmlns="jabber:client">
                            <body>${message}</body>
                            <active xmlns="${Strophe.NS.CHATSTATES}"/>
                        </message>`;
                await _converse.handleMessageStanza(msg);

                const promise = u.getOpenPromise();
                setTimeout(() => {
                    const view = _converse.chatboxviews.get(sender_jid);
                    expect(view.model.get('num_unread')).toBe(0);
                    expect(favico.badge.calls.count()).toBe(0);
                    promise.resolve();
                }, 500);
                return promise;
            }),
        );

        it(
            'is incremented from zero when chatbox was closed after viewing previously received messages and the window is not focused now',
            mock.initConverse(converse, [], {}, async function (_converse) {
                await mock.waitForRoster(_converse, 'current');
                const favico = jasmine.createSpyObj('favico', ['badge']);
                spyOn(converse.env, 'Favico').and.returnValue(favico);
                const message = 'This message will always increment the message counter from zero';
                const sender_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
                const msgFactory = () => stx`
                    <message from="${sender_jid}"
                             to="${_converse.api.connection.get().jid}"
                             type="chat"
                             id="${u.getUniqueId()}"
                             xmlns="jabber:client">
                        <body>${message}</body>
                        <active xmlns="${Strophe.NS.CHATSTATES}"/>
                    </message>`;

                // leave converse-chat page
                spyOn(_converse.exports.ChatBox.prototype, 'isHidden').and.returnValue(true);

                await _converse.handleMessageStanza(msgFactory());
                let view = _converse.chatboxviews.get(sender_jid);
                await u.waitUntil(() => favico.badge.calls.count() === 1, 1000);
                expect(favico.badge.calls.mostRecent().args.pop()).toBe(1);
                expect(view.model.get('num_unread')).toBe(1);

                view.model.isHidden.and.returnValue(false);
                // come back to converse-chat page
                document.dispatchEvent(new Event('visibilitychange'));

                await u.waitUntil(() => u.isVisible(view));
                expect(view.model.get('num_unread')).toBe(0);

                await u.waitUntil(() => favico.badge.calls.count() === 2);
                expect(favico.badge.calls.mostRecent().args.pop()).toBe(0);

                // close chatbox and leave converse-chat page again
                view.close();
                view.model.isHidden.and.returnValue(true);

                // check that msg_counter is incremented from zero again
                await _converse.handleMessageStanza(msgFactory());
                view = _converse.chatboxviews.get(sender_jid);
                await u.waitUntil(() => u.isVisible(view));
                await u.waitUntil(() => favico.badge.calls.count() === 3);
                expect(favico.badge.calls.mostRecent().args.pop()).toBe(1);
            }),
        );
    });

    describe('For activity on one of your posts', function () {
        it(
            'shows a comment notification and opens the post when clicked',
            mock.initConverse(converse, [], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                const { api } = _converse;
                const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                spyOn(window, 'Notification').and.returnValue(stub);
                spyOn(window, 'focus');

                // The notifications plugin only needs the comment's display name
                // and text and the post reference to open on click.
                const comment = {
                    getDisplayName: () => 'Bob',
                    get: (k) => ({ title: 'great post!', author_name: 'Bob', id: 'c1' })[k],
                };
                const ref = { feedJid: 'romeo@montague.lit', node: 'urn:xmpp:microblog:0', itemId: 'p1' };
                const opened = [];
                api.listen.on('openMicroblogPost', (r) => opened.push(r));

                api.trigger('microblogNotification', { type: 'comment', comment, ref });

                await u.waitUntil(() => window.Notification.calls.count() === 1);
                const [title, opts] = window.Notification.calls.mostRecent().args;
                expect(title).toContain('Bob');
                expect(title).toContain('commented');
                expect(opts.body).toContain('great post');

                // Clicking the notification asks the Social app to open the thread.
                stub.onclick({ preventDefault: () => {} });
                expect(opened).toEqual([ref]);
            }),
        );

        it(
            'shows a like notification titled with the liker, bodied with the post',
            mock.initConverse(converse, [], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                const { api } = _converse;
                const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
                spyOn(window, 'Notification').and.returnValue(stub);
                spyOn(window, 'focus');

                // A ♥ like: the comment's title is just the marker, so the body
                // comes from the liked post's own text instead.
                const comment = {
                    getDisplayName: () => 'Bob',
                    get: (k) => ({ title: '♥', author_name: 'Bob', id: 'l1' })[k],
                };
                const post = { get: (k) => ({ title: 'my great post' })[k] };
                const ref = { feedJid: 'romeo@montague.lit', node: 'urn:xmpp:microblog:0', itemId: 'p1' };
                const opened = [];
                api.listen.on('openMicroblogPost', (r) => opened.push(r));

                api.trigger('microblogNotification', { type: 'like', post, comment, ref });

                await u.waitUntil(() => window.Notification.calls.count() === 1);
                const [title, opts] = window.Notification.calls.mostRecent().args;
                expect(title).toContain('Bob');
                expect(title).toContain('liked');
                expect(opts.body).toContain('my great post');

                // Clicking the notification asks the Social app to open the thread.
                stub.onclick({ preventDefault: () => {} });
                expect(opened).toEqual([ref]);
            }),
        );

        it(
            'ignores an unrecognised microblog notification type',
            mock.initConverse(converse, [], {}, async (_converse) => {
                await mock.waitForRoster(_converse, 'current');
                const { api } = _converse;
                spyOn(window, 'Notification');
                api.trigger('microblogNotification', {
                    type: 'repost',
                    comment: { get: () => '', getDisplayName: () => 'x' },
                    ref: {},
                });
                await new Promise((r) => setTimeout(r, 50));
                expect(window.Notification).not.toHaveBeenCalled();
            }),
        );
    });
});
