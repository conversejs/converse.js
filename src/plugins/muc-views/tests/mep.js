/*global mock, converse */
const { u, Strophe, stx } = converse.env;

describe("A XEP-0316 MEP notification", function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("is rendered as an info message",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);
        let msg = 'An anonymous user has saluted romeo';
        let reason = 'Thank you for helping me yesterday';
        let message = stx`
            <message from="${muc_jid}"
                    to="${_converse.jid}"
                    type="headline"
                    id="zns61f38"
                    xmlns="jabber:client">
                <event xmlns="http://jabber.org/protocol/pubsub#event">
                    <items node="urn:ietf:params:xml:ns:conference-info">
                        <item id="ehs51f40">
                            <conference-info xmlns="urn:ietf:params:xml:ns:conference-info">
                                <activity xmlns="http://jabber.org/protocol/activity">
                                    <other/>
                                    <text id="activity-text" xml:lang="en">${msg}</text>
                                    <reference anchor="activity-text" xmlns="urn:xmpp:reference:0" begin="30" end="35" type="mention" uri="xmpp:${_converse.bare_jid}"/>
                                    <reason id="activity-reason">${reason}</reason>
                                </activity>
                            </conference-info>
                        </item>
                    </items>
                </event>
            </message>`;

        _converse.api.connection.get()._dataRecv(mock.createRequest(message));
        await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 1);
        expect(view.querySelector('.chat-info__message converse-texture').textContent.trim()).toBe(msg);
        expect(view.querySelector('.reason').textContent.trim()).toBe(reason);

        // Check that duplicates aren't created
        _converse.api.connection.get()._dataRecv(mock.createRequest(message));
        let promise = u.getOpenPromise();
        setTimeout(() => {
            expect(view.querySelectorAll('.chat-info').length).toBe(1);
            promise.resolve();
        }, 250);
        await promise;

        // Also check a MEP message of type "groupchat"
        msg = 'An anonymous user has poked romeo';
        reason = 'Can you please help me with something else?';
        message = stx`
            <message from="${muc_jid}"
                    to="${_converse.jid}"
                    type="groupchat"
                    id="zns61f39"
                    xmlns="jabber:client">
                <event xmlns="http://jabber.org/protocol/pubsub#event">
                    <items node="urn:ietf:params:xml:ns:conference-info">
                        <item id="ehs51f40">
                            <conference-info xmlns="urn:ietf:params:xml:ns:conference-info">
                                <activity xmlns="http://jabber.org/protocol/activity">
                                    <other/>
                                    <text id="activity-text" xml:lang="en">${msg}</text>
                                    <reference anchor="activity-text" xmlns="urn:xmpp:reference:0" begin="28" end="33" type="mention" uri="xmpp:${_converse.bare_jid}"/>
                                    <reason id="activity-reason">${reason}</reason>
                                </activity>
                            </conference-info>
                        </item>
                    </items>
                </event>
            </message>`;

        _converse.api.connection.get()._dataRecv(mock.createRequest(message));
        await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 2);
        expect(view.querySelector('converse-chat-message:last-child .chat-info__message converse-texture').textContent.trim()).toBe(msg);
        expect(view.querySelector('converse-chat-message:last-child .reason').textContent.trim()).toBe(reason);

        // Check that duplicates aren't created
        _converse.api.connection.get()._dataRecv(mock.createRequest(message));
        promise = u.getOpenPromise();
        setTimeout(() => {
            expect(view.querySelectorAll('.chat-info').length).toBe(2);
            promise.resolve();
        }, 250);
        return promise;
    }));

    it("can trigger a notification if sent to a hidden MUC",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        // const stub = jasmine.createSpyObj('MyNotification', ['onclick', 'close']);
        // spyOn(window, 'Notification').and.returnValue(stub);

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, nick, [], [], true, {'hidden': true});
        const msg = 'An anonymous user has saluted romeo';
        const reason = 'Thank you for helping me yesterday';
        const message = stx`
            <message from="${muc_jid}"
                    to="${_converse.jid}"
                    type="headline"
                    id="zns61f38"
                    xmlns="jabber:client">
                <event xmlns="http://jabber.org/protocol/pubsub#event">
                    <items node="urn:ietf:params:xml:ns:conference-info">
                        <item id="ehs51f40">
                            <conference-info xmlns="urn:ietf:params:xml:ns:conference-info">
                                <activity xmlns="http://jabber.org/protocol/activity">
                                    <other/>
                                    <text id="activity-text" xml:lang="en">${msg}</text>
                                    <reference anchor="activity-text" xmlns="urn:xmpp:reference:0" begin="30" end="35" type="mention" uri="xmpp:${_converse.bare_jid}"/>
                                    <reason id="activity-reason">${reason}</reason>
                                </activity>
                            </conference-info>
                        </item>
                    </items>
                </event>
            </message>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(message));
        await u.waitUntil(() => model.messages.length === 1);
        // expect(window.Notification.calls.count()).toBe(1);

        model.set('hidden', false);

        const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
        await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 1, 1000);
        expect(view.querySelector('.chat-info__message converse-texture').textContent.trim()).toBe(msg);
        expect(view.querySelector('.reason').textContent.trim()).toBe(reason);
    }));

    it("renders URLs as links", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const model = await mock.openAndEnterChatRoom(_converse, muc_jid, nick, [], [], true);
        const msg = 'An anonymous user has waved at romeo';
        const reason = 'Check out https://conversejs.org';
        const message = stx`
            <message from="${muc_jid}"
                    to="${_converse.jid}"
                    type="headline"
                    id="zns61f38"
                    xmlns="jabber:client">
                <event xmlns="http://jabber.org/protocol/pubsub#event">
                    <items node="urn:ietf:params:xml:ns:conference-info">
                        <item id="ehs51f40">
                            <conference-info xmlns="urn:ietf:params:xml:ns:conference-info">
                                <activity xmlns="http://jabber.org/protocol/activity">
                                    <other/>
                                    <text id="activity-text" xml:lang="en">${msg}</text>
                                    <reference anchor="activity-text" xmlns="urn:xmpp:reference:0" begin="31" end="37" type="mention" uri="xmpp:${_converse.bare_jid}"/>
                                    <reason id="activity-reason">${reason}</reason>
                                </activity>
                            </conference-info>
                        </item>
                    </items>
                </event>
            </message>`;
        _converse.api.connection.get()._dataRecv(mock.createRequest(message));
        await u.waitUntil(() => model.messages.length === 1);

        const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
        await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 1, 1000);
        expect(view.querySelector('.chat-info__message converse-texture').textContent.trim()).toBe(msg);
        expect(view.querySelector('.reason converse-texture').innerHTML.replace(/<!-.*?->/g, '').trim()).toBe(
            'Check out <a target="_blank" rel="noopener" href="https://conversejs.org/">https://conversejs.org</a>');
    }));

    it("can be retracted by a moderator",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick, features);
        const view = _converse.chatboxviews.get(muc_jid);
        const msg = 'An anonymous user has saluted romeo';
        const reason = 'Thank you for helping me yesterday';
        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <message from="${muc_jid}"
                    to="${_converse.jid}"
                    type="headline"
                    id="zns61f38"
                    xmlns="jabber:client">
                <event xmlns="http://jabber.org/protocol/pubsub#event">
                    <items node="urn:ietf:params:xml:ns:conference-info">
                        <item id="ehs51f40">
                            <conference-info xmlns="urn:ietf:params:xml:ns:conference-info">
                                <activity xmlns="http://jabber.org/protocol/activity">
                                    <other/>
                                    <text id="activity-text" xml:lang="en">${msg}</text>
                                    <reference anchor="activity-text" xmlns="urn:xmpp:reference:0" begin="30" end="35" type="mention" uri="xmpp:${_converse.bare_jid}"/>
                                    <reason id="activity-reason">${reason}</reason>
                                </activity>
                            </conference-info>
                        </item>
                    </items>
                </event>
                <stanza-id xmlns="urn:xmpp:sid:0" id="stanza-id-1" by="${muc_jid}"/>
            </message>`
        ));

        await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 1);
        expect(view.querySelector('.chat-info__message converse-texture').textContent.trim()).toBe(msg);
        expect(view.querySelector('.reason').textContent.trim()).toBe(reason);
        expect(view.querySelectorAll('converse-message-actions converse-dropdown .chat-msg__action').length).toBeGreaterThanOrEqual(1);
        const action = view.querySelector('converse-message-actions converse-dropdown .chat-msg__action');
        expect(action.textContent.trim()).toBe('Retract');
        action.click();
        await u.waitUntil(() => u.isVisible(document.querySelector('#converse-modals .modal')));
        const submit_button = document.querySelector('#converse-modals .modal button[type="submit"]');
        submit_button.click();

        const sent_IQs = _converse.api.connection.get().IQ_stanzas;
        const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('iq moderate')).pop());
        const message = view.model.messages.at(0);
        const stanza_id = message.get(`stanza_id ${view.model.get('jid')}`);

        expect(stanza).toEqualStanza(stx`
            <iq id="${stanza.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">
                <moderate id="${stanza_id}" xmlns="urn:xmpp:message-moderate:1">
                    <retract xmlns="urn:xmpp:message-retract:1"/>
                </moderate>
            </iq>`);

        // The server responds with a retraction message
        const retraction = stx`
            <message type="groupchat"
                    id="retraction-id-1"
                    from="${muc_jid}"
                    to="${muc_jid}/${nick}"
                    xmlns="jabber:client">
                <retract id="${stanza_id}" xmlns="urn:xmpp:message-retract:1">
                    <moderated by="${_converse.bare_jid}" xmlns="urn:xmpp:message-moderate:1" />
                </retract>
            </message>`;
        await view.model.handleMessageStanza(retraction);
        expect(view.model.messages.length).toBe(1);
        expect(view.model.messages.at(0).get('moderated')).toBe('retracted');
        expect(view.model.messages.at(0).get('moderation_reason')).toBeUndefined;
        expect(view.model.messages.at(0).get('is_ephemeral')).toBe(false);
        expect(view.model.messages.at(0).get('editable')).toBe(false);
        const msg_el = view.querySelector('.chat-msg--retracted .chat-info__message div');
        expect(msg_el.textContent).toBe(`${nick} has removed this message`);
    }));
});
