/*global mock, converse */

const { u } = converse.env;

describe("A XEP-0316 MEP notification", function () {

    it("is rendered as an info message",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        const muc_jid = 'lounge@montague.lit';
        const nick = 'romeo';
        await mock.openAndEnterChatRoom(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);
        let msg = 'An anonymous user has saluted romeo';
        let reason = 'Thank you for helping me yesterday';
        let message = u.toStanza(`
            <message from='${muc_jid}'
                    to='${_converse.jid}'
                    type='headline'
                    id='zns61f38'>
                <event xmlns='http://jabber.org/protocol/pubsub#event'>
                    <items node='urn:ietf:params:xml:ns:conference-info'>
                        <item id='ehs51f40'>
                            <conference-info xmlns='urn:ietf:params:xml:ns:conference-info'>
                                <activity xmlns='http://jabber.org/protocol/activity'>
                                    <other/>
                                    <text id="activity-text" xml:lang="en">${msg}</text>
                                    <reference anchor="activity-text" xmlns="urn:xmpp:reference:0" begin="30" end="35" type="mention" uri="xmpp:${_converse.bare_jid}"/>
                                    <reason id="activity-reason">${reason}</reason>
                                </activity>
                            </conference-info>
                        </item>
                    </items>
                </event>
            </message>`);

        _converse.connection._dataRecv(mock.createRequest(message));
        await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 1);
        expect(view.querySelector('.chat-info__message').textContent.trim()).toBe(msg);
        expect(view.querySelector('.reason').textContent.trim()).toBe(reason);

        // Check that duplicates aren't created
        _converse.connection._dataRecv(mock.createRequest(message));
        let promise = u.getOpenPromise();
        setTimeout(() => {
            expect(view.querySelectorAll('.chat-info').length).toBe(1);
            promise.resolve();
        }, 250);
        await promise;

        // Also check a MEP message of type "groupchat"
        msg = 'An anonymous user has poked romeo';
        reason = 'Can you please help me with something else?';
        message = u.toStanza(`
            <message from='${muc_jid}'
                    to='${_converse.jid}'
                    type='groupchat'
                    id='zns61f39'>
                <event xmlns='http://jabber.org/protocol/pubsub#event'>
                    <items node='urn:ietf:params:xml:ns:conference-info'>
                        <item id='ehs51f40'>
                            <conference-info xmlns='urn:ietf:params:xml:ns:conference-info'>
                                <activity xmlns='http://jabber.org/protocol/activity'>
                                    <other/>
                                    <text id="activity-text" xml:lang="en">${msg}</text>
                                    <reference anchor="activity-text" xmlns="urn:xmpp:reference:0" begin="28" end="33" type="mention" uri="xmpp:${_converse.bare_jid}"/>
                                    <reason id="activity-reason">${reason}</reason>
                                </activity>
                            </conference-info>
                        </item>
                    </items>
                </event>
            </message>`);

        _converse.connection._dataRecv(mock.createRequest(message));
        await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 2);
        expect(view.querySelector('converse-chat-message:last-child .chat-info__message').textContent.trim()).toBe(msg);
        expect(view.querySelector('converse-chat-message:last-child .reason').textContent.trim()).toBe(reason);

        // Check that duplicates aren't created
        _converse.connection._dataRecv(mock.createRequest(message));
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
        const message = u.toStanza(`
            <message from='${muc_jid}'
                    to='${_converse.jid}'
                    type='headline'
                    id='zns61f38'>
                <event xmlns='http://jabber.org/protocol/pubsub#event'>
                    <items node='urn:ietf:params:xml:ns:conference-info'>
                        <item id='ehs51f40'>
                            <conference-info xmlns='urn:ietf:params:xml:ns:conference-info'>
                                <activity xmlns='http://jabber.org/protocol/activity'>
                                    <other/>
                                    <text id="activity-text" xml:lang="en">${msg}</text>
                                    <reference anchor="activity-text" xmlns="urn:xmpp:reference:0" begin="30" end="35" type="mention" uri="xmpp:${_converse.bare_jid}"/>
                                    <reason id="activity-reason">${reason}</reason>
                                </activity>
                            </conference-info>
                        </item>
                    </items>
                </event>
            </message>`);
        _converse.connection._dataRecv(mock.createRequest(message));
        await u.waitUntil(() => model.messages.length === 1);
        // expect(window.Notification.calls.count()).toBe(1);

        model.set('hidden', false);

        const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
        await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 1, 1000);
        expect(view.querySelector('.chat-info__message').textContent.trim()).toBe(msg);
        expect(view.querySelector('.reason').textContent.trim()).toBe(reason);
    }));
});
