/*global mock, converse */

const { Strophe, stx, u }  = converse.env;

describe("Groupchats", function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe("A XEP-0085 Chat Status Notification", function () {

        it("is is not sent out to a MUC if the user is a visitor in a moderated room",
            mock.initConverse(
                ['chatBoxesFetched'], {},
                async function (_converse) {

            spyOn(_converse.ChatRoom.prototype, 'sendChatState').and.callThrough();

            const muc_jid = 'lounge@montague.lit';
            const features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                'muc_passwordprotected',
                'muc_hidden',
                'muc_temporary',
                'muc_membersonly',
                'muc_moderated',
                'muc_anonymous'
            ]
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);

            const view = _converse.chatboxviews.get(muc_jid);
            view.model.setChatState(_converse.ACTIVE);

            expect(view.model.sendChatState).toHaveBeenCalled();
            const last_stanza = _converse.api.connection.get().sent_stanzas.pop();
            expect(last_stanza).toEqualStanza(stx`
                <message to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                    <no-store xmlns="urn:xmpp:hints"/>
                    <no-permanent-store xmlns="urn:xmpp:hints"/>
                </message>`);

            // Romeo loses his voice
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    stx`<presence
                            xmlns="jabber:client"
                            to="romeo@montague.lit/orchard"
                            from="${muc_jid}/romeo">
                        <x xmlns="${Strophe.NS.MUC_USER}">
                            <item affiliation="none" role="visitor"/>
                            <status code="110"/>
                        </x>
                    </presence>`)
            );

            const occupant = view.model.occupants.findWhere({'jid': _converse.bare_jid});
            await u.waitUntil(() => occupant.get('role') === 'visitor');

            spyOn(_converse.api.connection.get(), 'send');
            view.model.setChatState(_converse.INACTIVE);
            expect(view.model.sendChatState.calls.count()).toBe(2);
            expect(_converse.api.connection.get().send).not.toHaveBeenCalled();
        }));


        describe("A composing notification", function () {

            it("will be shown if received", mock.initConverse([], {}, async function (_converse) {
                const muc_jid = 'coven@chat.shakespeare.lit';
                const members = [
                    {'affiliation': 'member', 'nick': 'majortom', 'jid': 'majortom@example.org'},
                    {'affiliation': 'admin', 'nick': 'groundcontrol', 'jid': 'groundcontrol@example.org'}
                ];
                await mock.openAndEnterMUC(_converse, muc_jid, 'some1', [], members);
                const view = _converse.chatboxviews.get(muc_jid);

                let csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
                expect(csntext.trim()).toEqual("some1 has entered the groupchat");

                _converse.api.connection.get()._dataRecv(mock.createRequest(
                    stx`<presence to="romeo@montague.lit/_converse.js-29092160" from="coven@chat.shakespeare.lit/newguy" xmlns="jabber:client">
                        <x xmlns="${Strophe.NS.MUC_USER}">
                            <item affiliation="none" jid="newguy@montague.lit/_converse.js-290929789" role="participant"/>
                        </x>
                    </presence>`));
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                    "some1 and newguy have entered the groupchat");

                _converse.api.connection.get()._dataRecv(mock.createRequest(
                    stx`<presence to="romeo@montague.lit/_converse.js-29092160" from="coven@chat.shakespeare.lit/nomorenicks" xmlns="jabber:client">
                        <x xmlns="${Strophe.NS.MUC_USER}">
                            <item affiliation="none" jid="nomorenicks@montague.lit/_converse.js-290929789" role="participant"/>
                        </x>
                    </presence>`));
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                    "some1, newguy and nomorenicks have entered the groupchat", 1000);

                // Manually clear so that we can more easily test
                view.model.notifications.set('entered', []);
                await u.waitUntil(() => !view.querySelector('.chat-content__notifications').textContent, 1000);

                // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions

                const remove_notifications_timeouts = [];
                const setTimeout = window.setTimeout;
                spyOn(window, 'setTimeout').and.callFake((f, w) => {
                    if (f.toString() === "()=>this.removeNotification(actor, state)") {
                        remove_notifications_timeouts.push(f)
                    }
                    setTimeout(f, w);
                });

                // <composing> state
                let msg = stx`<message from="${muc_jid}/newguy" id="${u.getUniqueId()}" to="romeo@montague.lit" type="groupchat" xmlns="jabber:client">
                        <body>
                            <composing xmlns="${Strophe.NS.CHATSTATES}"/>
                        </body>
                    </message>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(msg));

                csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent, 1000);
                expect(csntext.trim()).toEqual('newguy is typing');
                expect(remove_notifications_timeouts.length).toBe(1);
                expect(view.querySelector('.chat-content__notifications').textContent.trim()).toEqual('newguy is typing');

                msg = stx`<message from="${muc_jid}/nomorenicks"
                            id="${u.getUniqueId()}"
                            to="romeo@montague.lit"
                            type="groupchat"
                            xmlns="jabber:client">
                        <body>
                            <composing xmlns="${Strophe.NS.CHATSTATES}"/>
                        </body>
                    </message>`;
                await view.model.handleMessageStanza(msg.tree());
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === 'newguy and nomorenicks are typing', 1000);

                msg = stx`<message from="${muc_jid}/majortom"
                            id="${u.getUniqueId()}"
                            to="romeo@montague.lit"
                            type="groupchat"
                            xmlns="jabber:client">
                        <body>
                            <composing xmlns="${Strophe.NS.CHATSTATES}"/>
                         </body>
                    </message>`;
                await view.model.handleMessageStanza(msg.tree());
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === 'newguy, nomorenicks and majortom are typing', 1000);

                msg = stx`<message from="${muc_jid}/groundcontrol"
                            id="${u.getUniqueId()}"
                            to="romeo@montague.lit"
                            type="groupchat"
                            xmlns="jabber:client">
                        <body>
                            <composing xmlns="${Strophe.NS.CHATSTATES}"/>
                        </body>
                    </message>`;
                await view.model.handleMessageStanza(msg.tree());
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === 'newguy, nomorenicks and others are typing', 1000);

                msg = stx`<message from="${muc_jid}/some1"
                            id="${u.getUniqueId()}"
                            to="romeo@montague.lit"
                            type="groupchat"
                            xmlns="jabber:client">
                        <body>hello world</body>
                    </message>`;
                await view.model.handleMessageStanza(msg.tree());

                await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
                expect(view.querySelector('.chat-msg .chat-msg__text').textContent.trim()).toBe('hello world');

                // Test that the composing notifications get removed via timeout.
                if (remove_notifications_timeouts.length) {
                    remove_notifications_timeouts[0]();
                }
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === 'nomorenicks, majortom and groundcontrol are typing', 1000);
            }));
        });

        describe("A paused notification", function () {

            it("will be shown if received", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
                const muc_jid = 'coven@chat.shakespeare.lit';
                await mock.openAndEnterMUC(_converse, muc_jid, 'some1');
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');

                /* <presence to="romeo@montague.lit/_converse.js-29092160"
                 *           from="coven@chat.shakespeare.lit/some1">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
                 *          <status code="110"/>
                 *      </x>
                 *  </presence></body>
                 */
                _converse.api.connection.get()._dataRecv(mock.createRequest(stx`<presence
                            to="romeo@montague.lit/_converse.js-29092160"
                            from="coven@chat.shakespeare.lit/some1"
                            xmlns="jabber:client">
                        <x xmlns="${Strophe.NS.MUC_USER}">
                            <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
                        </x>
                        <status code="110"/>
                    </presence>`));
                const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
                expect(csntext.trim()).toEqual("some1 has entered the groupchat");

                _converse.api.connection.get()._dataRecv(mock.createRequest(stx`<presence
                            to="romeo@montague.lit/_converse.js-29092160"
                            from="coven@chat.shakespeare.lit/newguy"
                            xmlns="jabber:client">
                        <x xmlns="${Strophe.NS.MUC_USER}">
                            <item affiliation="none" jid="newguy@montague.lit/_converse.js-290929789" role="participant"/>
                        </x>
                    </presence>`));
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "some1 and newguy have entered the groupchat");

                _converse.api.connection.get()._dataRecv(mock.createRequest(stx`<presence
                            to="romeo@montague.lit/_converse.js-29092160"
                            from="coven@chat.shakespeare.lit/nomorenicks"
                            xmlns="jabber:client">
                        <x xmlns="${Strophe.NS.MUC_USER}">
                            <item affiliation="none" jid="nomorenicks@montague.lit/_converse.js-290929789" role="participant"/>
                        </x>
                    </presence>`));

                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                    "some1, newguy and nomorenicks have entered the groupchat");

                // Manually clear so that we can more easily test
                view.model.notifications.set('entered', []);
                await u.waitUntil(() => !view.querySelector('.chat-content__notifications').textContent);

                // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions

                // <composing> state
                let msg = stx`<message from="${muc_jid}/newguy" id="${u.getUniqueId()}" to="romeo@montague.lit" type="groupchat" xmlns="jabber:client">
                        <body>
                            <composing xmlns="${Strophe.NS.CHATSTATES}"/>
                        </body>
                    </message>`;
                await view.model.handleMessageStanza(msg.tree());
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
                expect(view.querySelector('.chat-content__notifications').textContent.trim()).toBe('newguy is typing');

                // <composing> state for a different occupant
                msg = stx`<message from="${muc_jid}/nomorenicks" id="${u.getUniqueId()}" to="romeo@montague.lit" type="groupchat" xmlns="jabber:client">
                        <body>
                            <composing xmlns="${Strophe.NS.CHATSTATES}"/>
                        </body>
                    </message>`;
                await view.model.handleMessageStanza(msg.tree());

                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim()  == 'newguy and nomorenicks are typing');

                // <paused> state from occupant who typed first
                msg = stx`<message from="${muc_jid}/newguy" id="${u.getUniqueId()}" to="romeo@montague.lit" type="groupchat" xmlns="jabber:client">
                        <body>
                            <paused xmlns="${Strophe.NS.CHATSTATES}"/>
                        </body>
                    </message>`;
                await view.model.handleMessageStanza(msg.tree());
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim()  == 'nomorenicks is typing\nnewguy has stopped typing');
            }));
        });
    });
});
