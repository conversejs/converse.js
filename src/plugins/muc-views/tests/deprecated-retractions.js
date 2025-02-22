/*global mock, converse */
const { Strophe, u, stx, sizzle } = converse.env;

describe("Deprecated Message Retractions", function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe("A groupchat message retraction", function () {

        it("is not applied if it's not from the right author",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE0];
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);

            const received_stanza = stx`
                <message to="${_converse.jid}"
                        from="${muc_jid}/eve"
                        type="groupchat"
                        id="${_converse.api.connection.get().getUniqueId()}"
                        xmlns="jabber:client">
                    <body>Hello world</body>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="stanza-id-1" by="${muc_jid}"/>
                </message>
            `;
            const view = _converse.chatboxviews.get(muc_jid);
            await view.model.handleMessageStanza(received_stanza);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
            expect(view.model.messages.at(0).get('retracted')).toBeFalsy();
            expect(view.model.messages.at(0).get('is_ephemeral')).toBeFalsy();

            const retraction_stanza = stx`
                <message type="groupchat"
                        id='retraction-id-1'
                        from="${muc_jid}/mallory"
                        to="${muc_jid}/romeo"
                        xmlns="jabber:client">
                    <apply-to id="stanza-id-1" xmlns="urn:xmpp:fasten:0">
                        <retract xmlns="urn:xmpp:message-retract:0" />
                    </apply-to>
                </message>
            `;
            spyOn(view.model, 'handleRetraction').and.callThrough();

            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));
            await u.waitUntil(() => view.model.handleRetraction.calls.count() === 1);
            expect(await view.model.handleRetraction.calls.first().returnValue).toBe(true);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.model.messages.length).toBe(2);
            expect(view.model.messages.at(1).get('retracted')).toBeTruthy();
            expect(view.model.messages.at(1).get('is_ephemeral')).toBeFalsy();
            expect(view.model.messages.at(1).get('dangling_retraction')).toBe(true);

            expect(view.model.messages.at(0).get('retracted')).toBeFalsy();
            expect(view.model.messages.at(0).get('is_ephemeral')).toBeFalsy();
        }));

        it("can be received before the message it pertains to",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const date = (new Date()).toISOString();
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE0];
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);

            const retraction_stanza = stx`
                <message type="groupchat"
                        id="retraction-id-1"
                        from="${muc_jid}/eve"
                        to="${muc_jid}/romeo"
                        xmlns="jabber:client">
                    <apply-to id="origin-id-1" xmlns="urn:xmpp:fasten:0">
                        <retract by="${muc_jid}/eve" xmlns="urn:xmpp:message-retract:0" />
                    </apply-to>
                </message>
            `;
            const view = _converse.chatboxviews.get(muc_jid);
            spyOn(converse.env.log, 'warn');
            spyOn(view.model, 'handleRetraction').and.callThrough();
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));

            await u.waitUntil(() => view.model.handleRetraction.calls.count() === 1);
            await u.waitUntil(() => view.model.messages.length === 1);
            expect(await view.model.handleRetraction.calls.first().returnValue).toBe(true);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('retracted')).toBeTruthy();
            expect(view.model.messages.at(0).get('dangling_retraction')).toBe(true);

            const received_stanza = stx`
                <message to="${_converse.jid}"
                        from="${muc_jid}/eve"
                        type="groupchat"
                        id="${_converse.api.connection.get().getUniqueId()}"
                        xmlns="jabber:client">
                    <body>Hello world</body>
                    <delay xmlns="urn:xmpp:delay" stamp="${date}"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="stanza-id-1" by="${muc_jid}"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="origin-id-1"/>
                </message>
            `;
            _converse.api.connection.get()._dataRecv(mock.createRequest(received_stanza));
            await u.waitUntil(() => view.model.handleRetraction.calls.count() === 2);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1, 1000);
            expect(view.model.messages.length).toBe(1);

            const message = view.model.messages.at(0)
            expect(message.get('retracted')).toBeTruthy();
            expect(message.get('dangling_retraction')).toBe(false);
            expect(message.get('origin_id')).toBe('origin-id-1');
            expect(message.get(`stanza_id ${muc_jid}`)).toBe('stanza-id-1');
            expect(message.get('time')).toBe(date);
            expect(message.get('type')).toBe('groupchat');
            expect(await view.model.handleRetraction.calls.all().pop().returnValue).toBe(true);
        }));
    });

    describe("A groupchat message moderator retraction", function () {

        it("can be received before the message it pertains to",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const date = (new Date()).toISOString();
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE0];
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const retraction_stanza = stx`
                <message xmlns="jabber:client" from="${muc_jid}" type="groupchat" id="retraction-id-1">
                    <apply-to xmlns="urn:xmpp:fasten:0" id="stanza-id-1">
                        <moderated xmlns="urn:xmpp:message-moderate:0" by="${muc_jid}/madison">
                            <retract xmlns="urn:xmpp:message-retract:0"/>
                            <reason>Insults</reason>
                        </moderated>
                    </apply-to>
                </message>
            `;
            const view = _converse.chatboxviews.get(muc_jid);
            spyOn(converse.env.log, 'warn');
            spyOn(view.model, 'handleModeration').and.callThrough();
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));

            await u.waitUntil(() => view.model.handleModeration.calls.count() === 1);
            await u.waitUntil(() => view.model.messages.length === 1);
            expect(await view.model.handleModeration.calls.first().returnValue).toBe(true);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('moderated')).toBe('retracted');
            expect(view.model.messages.at(0).get('dangling_moderation')).toBe(true);

            const received_stanza = stx`
                <message to="${_converse.jid}"
                        from="${muc_jid}/eve"
                        type="groupchat"
                        id="${_converse.api.connection.get().getUniqueId()}"
                        xmlns="jabber:client">
                    <body>Hello world</body>
                    <delay xmlns="urn:xmpp:delay" stamp="${date}"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="stanza-id-1" by="${muc_jid}"/>
                </message>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(received_stanza));
            await u.waitUntil(() => view.model.handleModeration.calls.count() === 2);

            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.model.messages.length).toBe(1);

            const message = view.model.messages.at(0)
            expect(message.get('moderated')).toBe('retracted');
            expect(message.get('dangling_moderation')).toBe(false);
            expect(message.get(`stanza_id ${muc_jid}`)).toBe('stanza-id-1');
            expect(message.get('time')).toBe(date);
            expect(message.get('type')).toBe('groupchat');
            expect(await view.model.handleModeration.calls.all().pop().returnValue).toBe(true);
        }));
    });

    describe("A message retraction", function () {

        it("can be received before the message it pertains to",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const date = (new Date()).toISOString();
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.SID]);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            const view = await mock.openChatBoxFor(_converse, contact_jid);
            spyOn(view.model, 'handleRetraction').and.callThrough();

            const retraction_stanza =  stx`
                <message id="${u.getUniqueId()}"
                         to="${_converse.bare_jid}"
                         from="${contact_jid}"
                         type="chat"
                         xmlns="jabber:client">
                    <apply-to id="2e972ea0-0050-44b7-a830-f6638a2595b3" xmlns="urn:xmpp:fasten:0">
                        <retract xmlns="urn:xmpp:message-retract:0"/>
                    </apply-to>
                </message>
            `;

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
        }));
    });

    describe("A Received Chat Message", function () {

        it("can be followed up by a retraction", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.SID]);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
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

            stanza = stx`
                <message xmlns="jabber:client"
                        to="${_converse.bare_jid}"
                        type="chat"
                        id="2e972ea0-0050-44b7-a830-f6638a2595b3"
                        from="${contact_jid}">
                    <body>This message will be retracted</body>
                    <markable xmlns="urn:xmpp:chat-markers:0"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="2e972ea0-0050-44b7-a830-f6638a2595b3"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="IxVDLJ0RYbWcWvqC" by="${_converse.bare_jid}"/>
                </message>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.model.messages.length === 2);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 2);

            const retraction_stanza =  stx`
                <message id="${u.getUniqueId()}"
                         to="${_converse.bare_jid}"
                         from="${contact_jid}"
                         type="chat"
                         xmlns="jabber:client">
                    <apply-to id="2e972ea0-0050-44b7-a830-f6638a2595b3" xmlns="urn:xmpp:fasten:0">
                        <retract xmlns="urn:xmpp:message-retract:0"/>
                    </apply-to>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);

            expect(view.model.messages.length).toBe(2);

            const message = view.model.messages.at(1);
            expect(message.get('retracted')).toBeTruthy();
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const msg_el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(msg_el.firstElementChild.textContent.trim()).toBe('Mercutio has removed a message');
        }));
    });

    describe("A Received Groupchat Message", function () {

        it("can be followed up by a retraction by the author", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE0];
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);

            const received_stanza = stx`
            <message to="${_converse.jid}"
                        from="${muc_jid}/eve"
                        type="groupchat"
                        id="${_converse.api.connection.get().getUniqueId()}"
                        xmlns="jabber:client">
                    <body>Hello world</body>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="stanza-id-1" by="${muc_jid}"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="origin-id-1" by="${muc_jid}"/>
                </message>`;
            const view = _converse.chatboxviews.get(muc_jid);
            await view.model.handleMessageStanza(received_stanza);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
            expect(view.model.messages.at(0).get('retracted')).toBeFalsy();
            expect(view.model.messages.at(0).get('is_ephemeral')).toBeFalsy();

            const retraction_stanza = stx`
                <message type="groupchat"
                        id="retraction-id-1"
                        from="${muc_jid}/eve"
                        to="${muc_jid}/romeo"
                        xmlns="jabber:client">
                    <apply-to id="origin-id-1" xmlns="urn:xmpp:fasten:0">
                        <retract by="${muc_jid}/eve" xmlns="urn:xmpp:message-retract:0" />
                    </apply-to>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));

            // We opportunistically save the message as retracted, even before receiving the retraction message
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('retracted')).toBeTruthy();
            expect(view.model.messages.at(0).get('editable')).toBe(false);
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const msg_el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(msg_el.firstElementChild.textContent.trim()).toBe('eve has removed a message');
            expect(msg_el.querySelector('.chat-msg--retracted q')).toBe(null);
        }));

        it("can not be retracted if the MUC doesn't support message moderation",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            const occupant = view.model.getOwnOccupant();
            expect(occupant.get('role')).toBe('moderator');

            const received_stanza = stx`
                <message to="${_converse.jid}"
                        from="${muc_jid}/mallory"
                        type="groupchat"
                        id="${_converse.api.connection.get().getUniqueId()}"
                        xmlns="jabber:client">
                    <body>Visit this site to get free Bitcoin!</body>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="stanza-id-1" by="${muc_jid}"/>
                </message>`;
            await view.model.handleMessageStanza(received_stanza);
            await u.waitUntil(() => view.querySelector('.chat-msg__content'));
            expect(view.querySelector('.chat-msg__content .chat-msg__action-retract')).toBe(null);
            const result = await view.model.canModerateMessages();
            expect(result).toBe(false);
        }));
    });


    describe("when archived", function () {

        it("may be returned as a tombstone message",
            mock.initConverse(
                ['discoInitialized'], {},
                async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const stanza = await u.waitUntil(() => sent_IQs.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop());
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
                                <origin-id xmlns="urn:xmpp:sid:0" id="origin-id-0"/>
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
                                <origin-id xmlns="urn:xmpp:sid:0" id="origin-id-1"/>
                                <retracted stamp="2019-09-20T23:09:32Z" xmlns="urn:xmpp:message-retract:0"/>
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
                                <apply-to id="origin-id-1" xmlns="urn:xmpp:fasten:0">
                                    <retract xmlns="urn:xmpp:message-retract:0"/>
                                </apply-to>
                            </message>
                        </forwarded>
                    </result>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction));

            const iq_result = stx`
                <iq type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                    <fin xmlns="urn:xmpp:mam:2" complete="true">
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
        }));

        it("may be returned as a tombstone groupchat message",
            mock.initConverse(
                ['discoInitialized'], {},
                async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE0];
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const stanza = await u.waitUntil(() => sent_IQs.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop());
            const queryid = stanza.querySelector('query').getAttribute('queryid');

            const first_id = u.getUniqueId();
            const tombstone = stx`
                <message id="${u.getUniqueId()}" to="${_converse.jid}" from="${muc_jid}" xmlns="jabber:client">
                    <result xmlns="urn:xmpp:mam:2" queryid="${queryid}" id="${first_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2019-09-20T23:08:25Z"/>
                            <message type="groupchat" from="${muc_jid}/eve" to="${_converse.bare_jid}" id="message-id-1">
                                <origin-id xmlns='urn:xmpp:sid:0' id="origin-id-1"/>
                                <retracted stamp="2019-09-20T23:09:32Z" xmlns="urn:xmpp:message-retract:0"/>
                            </message>
                        </forwarded>
                    </result>
                </message>`;
            spyOn(view.model, 'handleRetraction').and.callThrough();
            _converse.api.connection.get()._dataRecv(mock.createRequest(tombstone));

            const last_id = u.getUniqueId();
            const retraction = stx`
                <message id="${u.getUniqueId()}" to="${_converse.jid}" from="${muc_jid}" xmlns="jabber:client">
                    <result xmlns="urn:xmpp:mam:2" queryid="${queryid}" id="${last_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2019-09-20T23:08:25Z"/>
                            <message type="groupchat" from="${muc_jid}/eve" to="${_converse.bare_jid}" id="retract-message-1">
                                <apply-to id="origin-id-1" xmlns="urn:xmpp:fasten:0">
                                    <retract xmlns="urn:xmpp:message-retract:0"/>
                                </apply-to>
                            </message>
                        </forwarded>
                    </result>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction));

            const iq_result = stx`
                <iq type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                    <fin xmlns="urn:xmpp:mam:2" complete="true">
                        <set xmlns="http://jabber.org/protocol/rsm">
                            <first index="0">${first_id}</first>
                            <last>${last_id}</last>
                            <count>2</count>
                        </set>
                    </fin>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(iq_result));

            await u.waitUntil(() => view.model.messages.length === 1);
            let message = view.model.messages.at(0);
            expect(message.get('retracted')).toBeTruthy();
            expect(message.get('is_tombstone')).toBe(true);

            await u.waitUntil(() => view.model.handleRetraction.calls.count() === 2);
            expect(await view.model.handleRetraction.calls.first().returnValue).toBe(false);
            expect(await view.model.handleRetraction.calls.all()[1].returnValue).toBe(true);
            expect(view.model.messages.length).toBe(1);
            message = view.model.messages.at(0);
            expect(message.get('retracted')).toBeTruthy();
            expect(message.get('is_tombstone')).toBe(true);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(el.firstElementChild.textContent.trim()).toBe('eve has removed a message');
        }));

        it("may be returned as a tombstone moderated groupchat message",
            mock.initConverse(
                ['discoInitialized', 'chatBoxesFetched'], {},
                async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE0];
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const stanza = await u.waitUntil(() => sent_IQs.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop());
            const queryid = stanza.querySelector('query').getAttribute('queryid');

            const first_id = u.getUniqueId();
            const tombstone = stx`
                <message id="${u.getUniqueId()}" to="${_converse.jid}" from="${muc_jid}" xmlns="jabber:client">
                    <result xmlns="urn:xmpp:mam:2" queryid="${queryid}" id="${first_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2019-09-20T23:08:25Z"/>
                            <message type="groupchat" from="${muc_jid}/eve" to="${_converse.bare_jid}" id="message-id-1">
                                <moderated by="${muc_jid}/bob" stamp="2019-09-20T23:09:32Z" xmlns='urn:xmpp:message-moderate:0'>
                                    <retracted xmlns="urn:xmpp:message-retract:0"/>
                                    <reason>This message contains inappropriate content</reason>
                                </moderated>
                            </message>
                        </forwarded>
                    </result>
                </message>`;
            spyOn(view.model, 'handleModeration').and.callThrough();
            _converse.api.connection.get()._dataRecv(mock.createRequest(tombstone));

            const last_id = u.getUniqueId();
            const retraction = stx`
                <message id="${u.getUniqueId()}" to="${_converse.jid}" from="${muc_jid}" xmlns="jabber:client">
                    <result xmlns="urn:xmpp:mam:2" queryid="${queryid}" id="${last_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2019-09-20T23:08:25Z"/>
                            <message type="groupchat" from="${muc_jid}" to="${_converse.bare_jid}" id="retract-message-1">
                                <apply-to id="${first_id}" xmlns="urn:xmpp:fasten:0">
                                    <moderated by="${muc_jid}/bob" xmlns='urn:xmpp:message-moderate:0'>
                                        <retract xmlns="urn:xmpp:message-retract:0"/>
                                        <reason>This message contains inappropriate content</reason>
                                    </moderated>
                                </apply-to>
                            </message>
                        </forwarded>
                    </result>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction));

            const iq_result = stx`
                <iq type="result" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                    <fin xmlns="urn:xmpp:mam:2" complete="true">
                        <set xmlns="http://jabber.org/protocol/rsm">
                            <first index="0">${first_id}</first>
                            <last>${last_id}</last>
                            <count>2</count>
                        </set>
                    </fin>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(iq_result));

            await u.waitUntil(() => view.model.messages.length);
            expect(view.model.messages.length).toBe(1);
            let message = view.model.messages.at(0);
            await u.waitUntil(() => message.get('retracted'));
            expect(message.get('is_tombstone')).toBe(true);

            await u.waitUntil(() => view.model.handleModeration.calls.count() === 2);
            expect(await view.model.handleModeration.calls.first().returnValue).toBe(false);
            expect(await view.model.handleModeration.calls.all()[1].returnValue).toBe(true);

            expect(view.model.messages.length).toBe(1);
            message = view.model.messages.at(0);
            expect(message.get('retracted')).toBeTruthy();
            expect(message.get('is_tombstone')).toBe(true);
            expect(message.get('moderation_reason')).toBe("This message contains inappropriate content");

            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length, 500);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);

            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(el.firstElementChild.textContent.trim()).toBe('A moderator has removed a message');
            const qel = view.querySelector('.chat-msg--retracted .chat-msg__message q');
            expect(qel.textContent.trim()).toBe('This message contains inappropriate content');
        }));
    });
});
