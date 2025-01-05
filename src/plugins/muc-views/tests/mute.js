/*global mock, converse */

const { Strophe, Promise, stx, u }  = converse.env;

describe("Groupchats", function () {
    describe("A muted user", function () {

        it("will receive a user-friendly error message when trying to send a message",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'trollbox@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'troll');
            const view = _converse.chatboxviews.get(muc_jid);
            const textarea = await u.waitUntil(() => view.querySelector('textarea.chat-textarea'));
            textarea.value = 'Hello world';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onFormSubmitted(new Event('submit'));
            await new Promise(resolve => view.model.messages.once('rendered', resolve));

            let stanza =
                stx`<message id="${view.model.messages.at(0).get('msgid')}"
                         xmlns="jabber:client"
                         type="error"
                         to="troll@montague.lit/resource"
                         from="trollbox@montague.lit">
                    <error type="auth"><forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.querySelector('.chat-msg__error')?.textContent.trim(), 1000);

            expect(view.querySelector('.chat-msg__error').textContent.trim()).toBe(
                `Message delivery failed.\nYour message was not delivered because you weren't allowed to send it.`);

            textarea.value = 'Hello again';
            message_form.onFormSubmitted(new Event('submit'));
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);

            stanza = stx`<message id="${view.model.messages.at(1).get('msgid')}"
                         xmlns="jabber:client"
                         type="error"
                         to="troll@montague.lit/resource"
                         from="trollbox@montague.lit">
                    <error type="auth">
                        <forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        <text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">Thou shalt not!</text>
                    </error>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            await u.waitUntil(() => view.querySelectorAll('.chat-msg__error').length === 2);
            const sel = 'converse-message-history converse-chat-message:last-child .chat-msg__error';
            await u.waitUntil(() => view.querySelector(sel)?.textContent.trim());
            expect(view.querySelector(sel).textContent.trim()).toBe(`Message delivery failed.\nThou shalt not!`);
        }));

        it("will see an explanatory message instead of a textarea",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                Strophe.NS.SID,
                'muc_moderated',
            ]
            const muc_jid = 'trollbox@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'troll', features);
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('.chat-textarea'));

            let stanza =
                stx`<presence
                        from="trollbox@montague.lit/troll"
                        to="romeo@montague.lit/orchard"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none"
                            nick="troll"
                            role="visitor"/>
                        <status code="110"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            await u.waitUntil(() => view.querySelector('.chat-textarea') === null);
            let bottom_panel = view.querySelector('.muc-bottom-panel');
            expect(bottom_panel.textContent.trim()).toBe("You're not allowed to send messages in this room");

            // This only applies to moderated rooms, so let's check that
            // the textarea becomes visible when the room's
            // configuration changes to be non-moderated
            view.model.features.set('moderated', false);
            await u.waitUntil(() => view.querySelector('.muc-bottom-panel') === null);
            const textarea = await u.waitUntil(() => view.querySelector('textarea.chat-textarea'));
            expect(textarea === null).toBe(false);

            view.model.features.set('moderated', true);
            await u.waitUntil(() => view.querySelector('.chat-textarea') === null);
            bottom_panel = view.querySelector('.muc-bottom-panel');
            expect(bottom_panel.textContent.trim()).toBe("You're not allowed to send messages in this room");

            // Check now that things get restored when the user is given a voice
            await u.waitUntil(() =>
                Array.from(view.querySelectorAll('.chat-info__message')).pop()?.textContent.trim() ===
                "troll is no longer an owner of this groupchat"
            );

            stanza = stx`<presence
                    from="trollbox@montague.lit/troll"
                    to="romeo@montague.lit/orchard"
                    xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item affiliation="none"
                        nick="troll"
                        role="participant"/>
                    <status code="110"/>
                </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.querySelector('.muc-bottom-panel') === null);
            expect(textarea === null).toBe(false);
            // Check now that things get restored when the user is given a voice
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "troll has been given a voice");
        }));
    });
});
