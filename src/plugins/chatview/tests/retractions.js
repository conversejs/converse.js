/*global mock, converse */

const { Strophe, u, stx, dayjs } = converse.env;

describe('A sent chat message', function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it(
        'can be retracted',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await mock.openChatBoxFor(_converse, contact_jid);

            view.model.sendMessage({ body: 'hello world' });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

            const message = view.model.messages.at(0);
            expect(view.model.messages.length).toBe(1);
            expect(message.get('retracted')).toBeFalsy();
            expect(message.get('editable')).toBeTruthy();

            const retract_button = await u.waitUntil(() =>
                view.querySelector('.chat-msg__content .chat-msg__action-retract')
            );
            retract_button.click();
            await u.waitUntil(() => u.isVisible(document.querySelector('#converse-modals .modal')));
            const submit_button = document.querySelector('#converse-modals .modal button[type="submit"]');
            submit_button.click();

            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);

            const msg_obj = view.model.messages.at(0);
            const retraction_stanza = await u.waitUntil(() =>
                sent_stanzas.filter((s) => s.querySelector('message retract')).pop()
            );
            expect(retraction_stanza).toEqualStanza(stx`
                <message id="${retraction_stanza.getAttribute('id')}" to="${contact_jid}" type="chat" xmlns="jabber:client">
                    <retract id="${msg_obj.get('origin_id')}" xmlns="urn:xmpp:message-retract:1" />
                    <body>/me retracted a message</body>
                    <store xmlns="urn:xmpp:hints"/>
                    <fallback xmlns="urn:xmpp:fallback:0" for="urn:xmpp:message-retract:1" />
                </message>`);

            expect(view.model.messages.length).toBe(1);
            expect(message.get('retracted')).toBeTruthy();
            expect(message.get('editable')).toBeFalsy();
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const el = view.querySelector('.chat-msg--retracted .chat-msg__message');
            expect(el.textContent.trim()).toBe('You have removed this message');
        })
    );
});

describe('A received chat message', function () {
    it(
        'can be followed up with a retraction',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await mock.openChatBoxFor(_converse, contact_jid);

            const received_stanza = stx`
            <message xmlns="jabber:client"
                    to="${_converse.bare_jid}"
                    type="chat"
                    id="29132ea0-0121-2897-b121-36638c259554"
                    from="${contact_jid}">
                <body>😊</body>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="29132ea0-0121-2897-b121-36638c259554"/>
                <stanza-id xmlns="urn:xmpp:sid:0" id="kxViLhgbnNMcWv10" by="${_converse.bare_jid}"/>
            </message>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(received_stanza));
            await u.waitUntil(() => view.model.messages.length === 1);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

            const retraction_stanza = stx`
                <message id="${u.getUniqueId()}"
                        to="${_converse.bare_jid}"
                        from="${contact_jid}"
                        type="chat"
                        xmlns="jabber:client">
                    <retract id="29132ea0-0121-2897-b121-36638c259554" xmlns="urn:xmpp:message-retract:1"/>
                    <fallback xmlns="urn:xmpp:fallback:0" for="urn:xmpp:message-retract:1" />
                    <body>/me retracted a message</body>
                    <store xmlns="urn:xmpp:hints"/>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);

            expect(view.model.messages.length).toBe(1);

            const message = view.model.messages.at(0);
            expect(message.get('retracted')).toBeTruthy();
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const msg_el = view.querySelector('.chat-msg--retracted .chat-msg__message');
            expect(msg_el.textContent.trim()).toBe('Mercutio has removed this message');
        })
    );

    it(
        'may be preceded with a retraction',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await mock.openChatBoxFor(_converse, contact_jid);

            const retraction_stanza = stx`
                <message id="${u.getUniqueId()}"
                         to="${_converse.bare_jid}"
                         from="${contact_jid}"
                         type="chat"
                         xmlns="jabber:client">
                    <retract id="29132ea0-0121-2897-b121-36638c259554" xmlns="urn:xmpp:message-retract:1"/>
                    <fallback xmlns="urn:xmpp:fallback:0" for="urn:xmpp:message-retract:1" />
                    <body>/me retracted a message</body>
                    <store xmlns="urn:xmpp:hints"/>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));
            await u.waitUntil(() => view.model.messages.length === 1);

            const hour_ago = dayjs().subtract(1, 'hour');

            const message_stanza = stx`
                <message xmlns="jabber:client"
                        to="${_converse.bare_jid}"
                        type="chat"
                        id="29132ea0-0121-2897-b121-36638c259554"
                        from="${contact_jid}">
                    <body>This message will be retracted</body>
                    <delay xmlns="urn:xmpp:delay" stamp="${hour_ago.toISOString()}"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="29132ea0-0121-2897-b121-36638c259554"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="kxViLhgbnNMcWv10" by="${_converse.bare_jid}"/>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(message_stanza));
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);

            expect(view.model.messages.length).toBe(1);
            const message = view.model.messages.at(0);
            expect(message.get('retracted')).toBeTruthy();
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const msg_el = view.querySelector('.chat-msg--retracted .chat-msg__message');
            expect(msg_el.textContent.trim()).toBe('Mercutio has removed this message');
        })
    );
});

describe('A message retraction', function () {
    it(
        'can be received before the message it pertains to',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const date = new Date().toISOString();
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.SID]);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await mock.openChatBoxFor(_converse, contact_jid);
            spyOn(view.model, 'handleRetraction').and.callThrough();

            const retraction_stanza = stx`
            <message id="${u.getUniqueId()}"
                        to="${_converse.bare_jid}"
                        from="${contact_jid}"
                        type="chat"
                        xmlns="jabber:client">
                <retract id="2e972ea0-0050-44b7-a830-f6638a2595b3" xmlns='urn:xmpp:message-retract:1'/>
                <fallback xmlns="urn:xmpp:fallback:0" for='urn:xmpp:message-retract:1'/>
                <body>/me retracted a previous message, but it's unsupported by your client.</body>
                <store xmlns="urn:xmpp:hints"/>
            </message>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));
            await u.waitUntil(() => view.model.messages.length === 1);
            const message = view.model.messages.at(0);
            expect(message.get('dangling_retraction')).toBe(true);
            expect(message.get('is_ephemeral')).toBe(false);
            expect(message.get('retracted')).toBeTruthy();
            expect(view.querySelectorAll('.chat-msg').length).toBe(0);

            const stanza = stx`
            <message xmlns="jabber:client"
                    to="${_converse.bare_jid}"
                    type="chat"
                    id="2e972ea0-0050-44b7-a830-f6638a2595b3"
                    from="${contact_jid}">
                <body>Hello world</body>
                <delay xmlns='urn:xmpp:delay' stamp='${date}'/>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="2e972ea0-0050-44b7-a830-f6638a2595b3"/>
                <stanza-id xmlns="urn:xmpp:sid:0" id="IxVDLJ0RYbWcWvqC" by="${_converse.bare_jid}"/>
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.model.handleRetraction.calls.count() === 2);
            expect(view.model.messages.length).toBe(1);
            expect(message.get('retracted')).toBeTruthy();
            expect(message.get('dangling_retraction')).toBe(false);
            expect(message.get('origin_id')).toBe('2e972ea0-0050-44b7-a830-f6638a2595b3');
            expect(message.get('time')).toBe(date);
            expect(message.get('type')).toBe('chat');
        })
    );

    it(
        'may be returned as a tombstone message',
        mock.initConverse(['discoInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const stanza = await u.waitUntil(() =>
                sent_IQs.filter((iq) => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.MAM}"]`)).pop()
            );
            const queryid = stanza.querySelector('query').getAttribute('queryid');
            const view = _converse.chatboxviews.get(contact_jid);
            const first_id = u.getUniqueId();

            spyOn(view.model, 'handleRetraction').and.callThrough();
            const first_message = stx`
                <message id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                    <result xmlns="urn:xmpp:mam:2" queryid="${queryid}" id="${first_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2019-09-20T23:01:15Z"/>
                            <message type="chat" from="${contact_jid}" to="${_converse.bare_jid}" id="message-id-0">
                                <body>😊</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(first_message));

            const tombstone = stx`
                <message id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                    <result xmlns="urn:xmpp:mam:2" queryid="${queryid}" id="${u.getUniqueId()}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2019-09-20T23:08:25Z"/>
                            <message type="chat" from="${contact_jid}" to="${_converse.bare_jid}" id="message-id-1">
                                <retracted id="retract-message-1" stamp="2019-09-20T23:09:32Z" xmlns="urn:xmpp:message-retract:1"/>
                            </message>
                        </forwarded>
                    </result>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(tombstone));

            const last_id = u.getUniqueId();
            const retraction = stx`
                <message id="${u.getUniqueId()}" to="${_converse.jid}" xmlns="jabber:client">
                    <result xmlns="urn:xmpp:mam:2" queryid="${queryid}" id="${last_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2019-09-20T23:08:25Z"/>
                            <message from="${contact_jid}" to="${_converse.bare_jid}" id="retract-message-1">
                                <retract id="message-id-1" xmlns='urn:xmpp:message-retract:1'/>
                                <fallback xmlns="urn:xmpp:fallback:0" for='urn:xmpp:message-retract:1'/>
                                <body>/me retracted a previous message, but it's unsupported by your client.</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction));

            const iq_result = stx`
                <iq type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                    <fin xmlns="urn:xmpp:mam:2">
                        <set xmlns="http://jabber.org/protocol/rsm">
                            <first index="0">${first_id}</first>
                            <last>${last_id}</last>
                            <count>2</count>
                        </set>
                    </fin>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(iq_result));

            await u.waitUntil(() => view.model.handleRetraction.calls.count() === 3);

            expect(view.model.messages.length).toBe(2);
            const message = view.model.messages.at(1);
            expect(message.get('retracted')).toBeTruthy();
            expect(message.get('is_tombstone')).toBe(true);
            expect(await view.model.handleRetraction.calls.first().returnValue).toBe(false);
            expect(await view.model.handleRetraction.calls.all()[1].returnValue).toBe(false);
            expect(await view.model.handleRetraction.calls.all()[2].returnValue).toBe(true);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(el.firstElementChild.textContent.trim()).toBe('Mercutio has removed a message');
            expect(u.hasClass('chat-msg--followup', el.parentElement)).toBe(false);
        })
    );
});

describe('A Received Chat Message', function () {
    it(
        'can be followed up by a retraction',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.SID]);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await mock.openChatBoxFor(_converse, contact_jid);

            let stanza = stx`
            <message xmlns="jabber:client"
                    to="${_converse.bare_jid}"
                    type="chat"
                    id="29132ea0-0121-2897-b121-36638c259554"
                    from="${contact_jid}">
                <body>😊</body>
                <markable xmlns="urn:xmpp:chat-markers:0"/>
                <origin-id xmlns="urn:xmpp:sid:0" id="29132ea0-0121-2897-b121-36638c259554"/>
                <stanza-id xmlns="urn:xmpp:sid:0" id="kxViLhgbnNMcWv10" by="${_converse.bare_jid}"/>
            </message>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.model.messages.length === 1);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

            const msgid = '2e972ea0-0050-44b7-a830-f6638a2595b3';

            stanza = stx`
                <message xmlns="jabber:client"
                        to="${_converse.bare_jid}"
                        type="chat"
                        id="${msgid}"
                        from="${contact_jid}">
                    <body>This message will be retracted</body>
                    <markable xmlns="urn:xmpp:chat-markers:0"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${msgid}"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="IxVDLJ0RYbWcWvqC" by="${_converse.bare_jid}"/>
                </message>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.model.messages.length === 2);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);

            const retraction_stanza = stx`
            <message id="${u.getUniqueId()}"
                        to="${_converse.bare_jid}"
                        from="${contact_jid}"
                        type="chat"
                        xmlns="jabber:client">
                <retract id="${msgid}" xmlns='urn:xmpp:message-retract:1'/>
                <fallback xmlns="urn:xmpp:fallback:0" for='urn:xmpp:message-retract:1'/>
                <body>/me retracted a previous message, but it's unsupported by your client.</body>
                <store xmlns="urn:xmpp:hints"/>
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);

            expect(view.model.messages.length).toBe(2);

            const message = view.model.messages.at(1);
            expect(message.get('retracted')).toBeTruthy();
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const msg_el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction span');
            expect(msg_el.textContent.trim()).toBe('Mercutio has removed a message');
        })
    );
});

describe('A Sent Chat Message', function () {
    it(
        'can be retracted by its author',
        mock.initConverse(['chatBoxesFetched'], { vcard: { nickname: '' } }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const view = await mock.openChatBoxFor(_converse, contact_jid);

            view.model.sendMessage({ 'body': 'hello world' });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

            const message = view.model.messages.at(0);
            expect(view.model.messages.length).toBe(1);
            expect(message.get('retracted')).toBeFalsy();
            expect(message.get('editable')).toBeTruthy();

            const retract_button = await u.waitUntil(() =>
                view.querySelector('.chat-msg__content .chat-msg__action-retract')
            );
            retract_button.click();
            await u.waitUntil(() => u.isVisible(document.querySelector('#converse-modals .modal')));
            const submit_button = document.querySelector('#converse-modals .modal button[type="submit"]');
            submit_button.click();

            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);

            const msg_obj = view.model.messages.at(0);
            const retraction_stanza = await u.waitUntil(() =>
                sent_stanzas.filter((s) => s.querySelector('message retract')).pop()
            );
            expect(retraction_stanza).toEqualStanza(stx`
            <message id="${retraction_stanza.getAttribute('id')}" to="${contact_jid}" type="chat" xmlns="jabber:client">
                <retract id="${msg_obj.get('origin_id')}" xmlns="urn:xmpp:message-retract:1"/>
                <body>/me retracted a message</body>
                <store xmlns="urn:xmpp:hints"/>
                <fallback xmlns="urn:xmpp:fallback:0" for="urn:xmpp:message-retract:1" />
            </message>`);

            expect(view.model.messages.length).toBe(1);
            expect(message.get('retracted')).toBeTruthy();
            expect(message.get('editable')).toBeFalsy();
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const el = view.querySelector('.chat-msg--retracted .chat-msg__message');
            expect(el.textContent.trim()).toBe('You have removed this message');
        })
    );
});
