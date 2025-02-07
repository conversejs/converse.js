/*global mock, converse */

const { Strophe, u, stx } = converse.env;

async function sendAndThenRetractMessage (_converse, view) {
    view.model.sendMessage({'body': 'hello world'});
    await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 1);
    const msg_obj = view.model.messages.last();
    const reflection_stanza = stx`
        <message xmlns="jabber:client"
                from="${msg_obj.get('from')}"
                to="${_converse.api.connection.get().jid}"
                type="groupchat">
            <msg_body>${msg_obj.get('message')}</msg_body>
            <stanza-id xmlns="urn:xmpp:sid:0"
                    id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                    by="lounge@montague.lit"/>
            <origin-id xmlns="urn:xmpp:sid:0" id="${msg_obj.get('origin_id')}"/>
        </message>`;
    await view.model.handleMessageStanza(reflection_stanza);
    await u.waitUntil(() => view.querySelectorAll('.chat-msg__body.chat-msg__body--received').length, 500);

    const retract_button = await u.waitUntil(() => view.querySelector('.chat-msg__content .chat-msg__action-retract'));
    retract_button.click();
    await u.waitUntil(() => u.isVisible(document.querySelector('#converse-modals .modal')));
    const submit_button = document.querySelector('#converse-modals .modal button[type="submit"]');
    submit_button.click();
    const sent_stanzas = _converse.api.connection.get().sent_stanzas;
    return u.waitUntil(() => sent_stanzas.filter(s => s.querySelector('message retract')).pop());
}


describe("Message Retractions", function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe("A groupchat message retraction", function () {

        it("is not applied if it's not from the right author",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);

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
                    <retract id="stanza-id-1" xmlns="urn:xmpp:message-retract:1"/>
                    <body>/me retracted a message</body>
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
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);

            const retraction_stanza = stx`
                <message type="groupchat"
                        id="retraction-id-1"
                        from="${muc_jid}/eve"
                        to="${muc_jid}/romeo"
                        xmlns="jabber:client">
                    <retract id="origin-id-1" xmlns="urn:xmpp:message-retract:1"/>
                    <fallback xmlns="urn:xmpp:fallback:0" for='urn:xmpp:message-retract:1'/>
                    <body>/me retracted a message</body>
                    <store xmlns="urn:xmpp:hints"/>
                </message>`;
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
                </message>`;
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
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
            const retraction_stanza = stx`
                <message xmlns="jabber:client" from="${muc_jid}" type="groupchat" id="retraction-id-1">
                    <retract id="stanza-id-1" xmlns='urn:xmpp:message-retract:1'>
                        <moderated xmlns="urn:xmpp:message-moderate:1" by="${muc_jid}/madison"/>
                        <reason>Insults</reason>
                    </retract>
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


    describe("A Received Groupchat Message", function () {

        it("can be followed up by a retraction by the author", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);

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

                    <retract id="origin-id-1" xmlns='urn:xmpp:message-retract:1'/>
                    <fallback xmlns="urn:xmpp:fallback:0" for='urn:xmpp:message-retract:1'/>
                    <body>/me retracted a previous message, but it's unsupported by your client.</body>
                    <store xmlns="urn:xmpp:hints"/>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(retraction_stanza));

            // We opportunistically save the message as retracted, even before receiving the retraction message
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('retracted')).toBeTruthy();
            expect(view.model.messages.at(0).get('editable')).toBe(false);
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const msg_el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(msg_el?.textContent.trim()).toBe('eve has removed a message');
            expect(msg_el.querySelector('.chat-msg--retracted q')).toBe(null);
        }));


        it("can be retracted by a moderator, with the IQ response received before the retraction message",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);

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
            await u.waitUntil(() => view.model.messages.length === 1);
            expect(view.model.messages.at(0).get('retracted')).toBeFalsy();

            const reason = "This content is inappropriate for this forum!"
            const retract_button = await u.waitUntil(() => view.querySelector('.chat-msg__content .chat-msg__action-retract'));
            retract_button.click();

            await u.waitUntil(() => u.isVisible(document.querySelector('#converse-modals .modal')));

            const reason_input = document.querySelector('#converse-modals .modal input[name="reason"]');
            reason_input.value = 'This content is inappropriate for this forum!';
            const submit_button = document.querySelector('#converse-modals .modal button[type="submit"]');
            submit_button.click();

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const stanza = await u.waitUntil(
                () => sent_IQs.filter(iq => iq.querySelector('iq retract')).pop());
            const message = view.model.messages.at(0);
            const stanza_id = message.get(`stanza_id ${view.model.get('jid')}`);

            expect(stanza).toEqualStanza(stx`
                <iq id="${stanza.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">
                    <moderate id="${stanza_id}" xmlns="urn:xmpp:message-moderate:1">
                        <retract xmlns="urn:xmpp:message-retract:1"/>
                        <reason>This content is inappropriate for this forum!</reason>
                    </moderate>
                </iq>`);

            const result_iq = stx`
                <iq from="${muc_jid}"
                    id="${stanza.getAttribute('id')}"
                    to="${_converse.bare_jid}"
                    type="result"
                    xmlns="jabber:client"/>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result_iq));

            // We opportunistically save the message as retracted, even before receiving the retraction message
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('moderated')).toBe('retracted');
            expect(view.model.messages.at(0).get('moderation_reason')).toBe(reason);
            expect(view.model.messages.at(0).get('is_ephemeral')).toBe(false);
            expect(view.model.messages.at(0).get('editable')).toBe(false);
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);

            const ret_el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(ret_el.firstElementChild.textContent.trim()).toBe('romeo has removed a message');

            const qel = ret_el.querySelector('q');
            expect(qel.textContent.trim()).toBe('This content is inappropriate for this forum!');

            // The server responds with a retraction message
            const retraction = stx`
                <message type="groupchat"
                        id="retraction-id-1"
                        from="${muc_jid}"
                        to="${muc_jid}/romeo"
                        xmlns="jabber:client">
                    <moderated by="${_converse.bare_jid}" xmlns="urn:xmpp:message-moderate:0">
                        <retract id="${stanza_id}" xmlns="urn:xmpp:message-retract:1"/>
                        <reason>${reason}</reason>
                    </moderated>
                </message>`;
            await view.model.handleMessageStanza(retraction);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('moderated')).toBe('retracted');
            expect(view.model.messages.at(0).get('moderation_reason')).toBe(reason);
            expect(view.model.messages.at(0).get('is_ephemeral')).toBe(false);
            expect(view.model.messages.at(0).get('editable')).toBe(false);
        }));

        it("can not be retracted if the MUC doesn't support message moderation",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
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


        it("can be retracted by a moderator, with the retraction message received before the IQ response",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
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
            await u.waitUntil(() => view.model.messages.length === 1);
            expect(view.model.messages.length).toBe(1);

            const retract_button = await u.waitUntil(() => view.querySelector('.chat-msg__content .chat-msg__action-retract'));
            retract_button.click();
            await u.waitUntil(() => u.isVisible(document.querySelector('#converse-modals .modal')));

            const reason_input = document.querySelector('#converse-modals .modal input[name="reason"]');
            const reason = "This content is inappropriate for this forum!"
            reason_input.value = reason;
            const submit_button = document.querySelector('#converse-modals .modal button[type="submit"]');
            submit_button.click();

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('iq retract')).pop());
            const message = view.model.messages.at(0);
            const stanza_id = message.get(`stanza_id ${view.model.get('jid')}`);
            // The server responds with a retraction message
            const retraction = stx`
                <message type="groupchat"
                        id='retraction-id-1'
                        from="${muc_jid}"
                        to="${muc_jid}/romeo"
                        xmlns="jabber:client">
                    <retract id="${stanza_id}" xmlns='urn:xmpp:message-retract:1'>
                        <moderated by="${_converse.bare_jid}" xmlns='urn:xmpp:message-moderate:1' />
                        <reason>${reason}</reason>
                    </retract>
                </message>`;
            await view.model.handleMessageStanza(retraction);

            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('moderated')).toBe('retracted');
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const msg_el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(msg_el.firstElementChild.textContent.trim()).toBe('romeo has removed a message');
            const qel = view.querySelector('.chat-msg--retracted .chat-msg__message q');
            expect(qel.textContent).toBe('This content is inappropriate for this forum!');

            const result_iq = stx`
                <iq from="${muc_jid}"
                    id="${stanza.getAttribute('id')}"
                    to="${_converse.bare_jid}"
                    type="result"
                    xmlns="jabber:client"/>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result_iq));
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('moderated')).toBe('retracted');
            expect(view.model.messages.at(0).get('moderated_by')).toBe(_converse.bare_jid);
            expect(view.model.messages.at(0).get('moderation_reason')).toBe(reason);
            expect(view.model.messages.at(0).get('editable')).toBe(false);
        }));
    });


    describe("A Sent Groupchat Message", function () {

        it("can be retracted by its author", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);
            const occupant = view.model.getOwnOccupant();
            expect(occupant.get('role')).toBe('moderator');
            occupant.save('role', 'member');
            const retraction_stanza = await sendAndThenRetractMessage(_converse, view);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1, 1000);

            const msg_obj = view.model.messages.last();
            expect(msg_obj.get('retracted')).toBeTruthy();

            expect(retraction_stanza).toEqualStanza(stx`
                <message id="${retraction_stanza.getAttribute('id')}" to="${muc_jid}" type="groupchat" xmlns="jabber:client">
                    <retract id="${msg_obj.get('origin_id')}" xmlns="urn:xmpp:message-retract:1"/>
                    <body>/me retracted a message</body>
                    <store xmlns="urn:xmpp:hints"/>
                    <fallback xmlns="urn:xmpp:fallback:0" for="urn:xmpp:message-retract:1"/>
                </message>`);

            const message = view.model.messages.last();
            expect(message.get('is_ephemeral')).toBe(false);
            expect(message.get('editable')).toBeFalsy();

            // The server responds with a retraction message
            const stanza_id = '5f3dbc5e-e1d3-4077-a492-693f3769c7ad';
            const reflection = stx`
                <message type="groupchat"
                        id="${retraction_stanza.getAttribute('id')}"
                        from="${muc_jid}"
                        to="${muc_jid}/romeo"
                        xmlns="jabber:client">
                    <stanza-id xmlns="urn:xmpp:sid:0" id="${stanza_id}" by="room@muc.example.com"/>
                    <retract id="${msg_obj.get('origin_id')}" xmlns="urn:xmpp:message-retract:1"/>
                    <body>/me retracted a message</body>
                    <store xmlns="urn:xmpp:hints"/>
                    <fallback xmlns="urn:xmpp:fallback:0" for="urn:xmpp:message-retract:1"/>
                </message>`;

            spyOn(view.model, 'handleRetraction').and.callThrough();
            _converse.api.connection.get()._dataRecv(mock.createRequest(reflection));
            await u.waitUntil(() => view.model.handleRetraction.calls.count() === 1, 1000);

            await u.waitUntil(() => view.model.messages.length === 2, 1000);
            expect(view.model.messages.last().get('retracted')).toBeTruthy();
            expect(view.model.messages.last().get('is_ephemeral')).toBe(false);
            expect(view.model.messages.last().get('editable')).toBe(false);
            expect(message.get(`stanza_id ${muc_jid}`)).toBe(stanza_id);
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
            const el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(el?.textContent.trim()).toBe('You have removed a message');
        }));

        it("can be retracted by its author, causing an error message in response",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);
            const occupant = view.model.getOwnOccupant();

            expect(occupant.get('role')).toBe('moderator');
            occupant.save('role', 'member');
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.includes("romeo is no longer a moderator"));
            const retraction_stanza = await sendAndThenRetractMessage(_converse, view);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1, 1000);

            expect(view.model.messages.length).toBe(1);
            await u.waitUntil(() => view.model.messages.last().get('retracted'), 1000);
            const el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(el?.textContent.trim()).toBe('You have removed a message');

            const message = view.model.messages.last();
            const stanza_id = message.get(`stanza_id ${view.model.get('jid')}`);
            // The server responds with an error message
            const error = stx`
                <message type="error"
                        id="${retraction_stanza.getAttribute('id')}"
                        from="${muc_jid}"
                        to="${view.model.get('jid')}/romeo"
                        xmlns="jabber:client">
                    <error by='${muc_jid}' type='auth'>
                        <forbidden xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                    </error>
                    <retract id="${stanza_id}" xmlns="urn:xmpp:message-retract:1"/>
                </message>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(error));

            await u.waitUntil(() => view.querySelectorAll('.chat-msg__error').length === 1, 1000);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 0, 1000);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('retracted')).toBeFalsy();
            expect(view.model.messages.at(0).get('is_ephemeral')).toBeFalsy();
            expect(view.model.messages.at(0).get('editable')).toBe(false);

            const errmsg = view.querySelector('.chat-msg__error');
            expect(errmsg.textContent.trim()).toBe(`Message delivery failed.\nYou're not allowed to retract your message.`);
        }));

        it("can be retracted by its author, causing a timeout error in response",
                mock.initConverse(['chatBoxesFetched'], { stanza_timeout: 1 }, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);
            const occupant = view.model.getOwnOccupant();
            expect(occupant.get('role')).toBe('moderator');
            occupant.save('role', 'member');
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.includes("romeo is no longer a moderator"))
            await sendAndThenRetractMessage(_converse, view);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.last().get('retracted')).toBeTruthy();
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
            const el = view.querySelector('.chat-msg--retracted .chat-msg__message .retraction');
            expect(el?.textContent.trim()).toBe('You have removed a message');

            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 0);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('retracted')).toBeFalsy();
            expect(view.model.messages.at(0).get('is_ephemeral')).toBeFalsy();
            expect(view.model.messages.at(0).get('editable')).toBeTruthy();

            const error_messages = view.querySelectorAll('.chat-msg__error');
            expect(error_messages.length).toBe(1);
            expect(error_messages[0].textContent.trim()).toBe(
                'Message delivery failed.\nA timeout happened while trying to retract your message.');
        }));


        it("can be retracted by a moderator", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);
            const occupant = view.model.getOwnOccupant();
            expect(occupant.get('role')).toBe('moderator');

            view.model.sendMessage({'body': 'Visit this site to get free bitcoin'});
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);
            const stanza_id = 'retraction-id-1';
            const msg_obj = view.model.messages.at(0);
            const reflection_stanza = stx`
                <message xmlns="jabber:client"
                        from="${msg_obj.get('from')}"
                        to="${_converse.api.connection.get().jid}"
                        type="groupchat">
                    <msg_body>${msg_obj.get('message')}</msg_body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                            id="${stanza_id}"
                            by="lounge@montague.lit"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${msg_obj.get('origin_id')}"/>
                </message>`;
            await view.model.handleMessageStanza(reflection_stanza);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__body.chat-msg__body--received').length, 500);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('editable')).toBe(true);

            // The server responds with a retraction message
            const reason = "This content is inappropriate for this forum!"
            const retraction = stx`
                <message type="groupchat"
                        id="retraction-id-1"
                        from="${muc_jid}"
                        to="${muc_jid}/romeo"
                        xmlns="jabber:client">

                    <retract id="${stanza_id}" xmlns='urn:xmpp:message-retract:1'>
                        <moderated by="${_converse.bare_jid}" xmlns="urn:xmpp:message-moderate:1"/>
                        <reason>${reason}</reason>
                    </retract>
                </message>`;
            await view.model.handleMessageStanza(retraction);
            expect(view.model.messages.length).toBe(1);
            await u.waitUntil(() => view.model.messages.at(0).get('moderated') === 'retracted');
            expect(view.model.messages.at(0).get('moderation_reason')).toBe(reason);
            expect(view.model.messages.at(0).get('is_ephemeral')).toBe(false);
            expect(view.model.messages.at(0).get('editable')).toBe(false);
        }));

        it("can be retracted by the sender if they're a moderator",
                mock.initConverse(['chatBoxesFetched'], {'allow_message_retraction': 'moderator'}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);
            const occupant = view.model.getOwnOccupant();
            expect(occupant.get('role')).toBe('moderator');

            view.model.sendMessage({body: 'Visit this site to get free bitcoin'});
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length === 1);

            // Check that you can only edit a message before it's been
            // reflected. You can't retract because it hasn't
            await u.waitUntil(() => view.querySelector('.chat-msg__content .chat-msg__action-edit'));
            expect(view.querySelector('.chat-msg__action .chat-msg__action-retract')).toBeNull();

            const stanza_id = 'retraction-id-1';
            const msg_obj = view.model.messages.at(0);
            const reflection_stanza = stx`
                <message xmlns="jabber:client"
                        from="${msg_obj.get('from')}"
                        to="${_converse.api.connection.get().jid}"
                        type="groupchat">
                    <msg_body>${msg_obj.get('message')}</msg_body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                            id="${stanza_id}"
                            by="lounge@montague.lit"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${msg_obj.get('origin_id')}"/>
                </message>`;

            await view.model.handleMessageStanza(reflection_stanza);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__body.chat-msg__body--received').length, 500);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('editable')).toBe(true);

            const retract_button = await u.waitUntil(() => view.querySelector('.chat-msg__content .chat-msg__action-retract'));
            retract_button.click();
            await u.waitUntil(() => u.isVisible(document.querySelector('#converse-modals .modal')));
            const submit_button = document.querySelector('#converse-modals .modal button[type="submit"]');
            submit_button.click();

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('iq moderate')).pop());

            expect(stanza).toEqualStanza(stx`
                <iq type="set" to="${muc_jid}" id="${stanza.getAttribute('id')}" xmlns="jabber:client">
                    <moderate id="${stanza_id}" xmlns="urn:xmpp:message-moderate:1">
                        <retract xmlns="urn:xmpp:message-retract:1"/>
                    </moderate>
                </iq>`);

            const result_iq = stx`
                <iq from="${muc_jid}"
                    id="${stanza.getAttribute('id')}"
                    to="${_converse.bare_jid}"
                    type="result"
                    xmlns="jabber:client"/>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result_iq));

            // We opportunistically save the message as retracted, even before receiving the retraction message
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('moderated')).toBe('retracted');
            expect(view.model.messages.at(0).get('moderation_reason')).toBe(undefined);
            expect(view.model.messages.at(0).get('is_ephemeral')).toBe(false);
            expect(view.model.messages.at(0).get('editable')).toBe(false);
            expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);

            const msg_el = view.querySelector('.chat-msg--retracted .chat-msg__message');
            expect(msg_el.querySelector('.retraction')?.textContent.trim()).toBe('romeo has removed a message');
            expect(msg_el.querySelector('q')).toBe(null);

            // The server responds with a retraction message
            const retraction = stx`
                <message type="groupchat"
                        id="${stanza_id}"
                        from="${muc_jid}"
                        to="${muc_jid}/romeo"
                        xmlns="jabber:client">
                    <retract id="${stanza_id}" xmlns="urn:xmpp:message-retract:1">
                        <moderated by="${_converse.bare_jid}" xmlns="urn:xmpp:message-moderate:1"/>
                    </retract>
                </message>`;
            await view.model.handleMessageStanza(retraction);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('moderated')).toBe('retracted');
            expect(view.model.messages.at(0).get('moderation_reason')).toBe(undefined);
            expect(view.model.messages.at(0).get('is_ephemeral')).toBe(false);
            expect(view.model.messages.at(0).get('editable')).toBe(false);
        }));
    });


    describe("when archived", function () {

        it("may be returned as a tombstone groupchat message",
            mock.initConverse(
                ['discoInitialized'], {},
                async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            const queryid = stanza.querySelector('query').getAttribute('queryid');

            const first_id = u.getUniqueId();
            const tombstone = stx`
                <message id="${u.getUniqueId()}" to="${_converse.jid}" from="${muc_jid}" xmlns="jabber:client">
                    <result xmlns="urn:xmpp:mam:2" queryid="${queryid}" id="stanza-id">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2019-09-20T23:08:25Z"/>
                            <message type="groupchat" from="${muc_jid}/eve" to="${_converse.bare_jid}" id="message-id-1">
                                <retracted stamp='2019-09-20T23:09:32Z' xmlns='urn:xmpp:message-retract:1' id='retract-message-1'/>
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
            expect(el?.textContent.trim()).toBe('eve has removed a message');
        }));

        it("may be returned as a tombstone moderated groupchat message",
            mock.initConverse(
                ['discoInitialized', 'chatBoxesFetched'], {},
                async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            const queryid = stanza.querySelector('query').getAttribute('queryid');

            const first_id = u.getUniqueId();
            const tombstone = stx`
                <message id="${u.getUniqueId()}" to="${_converse.jid}" from="${muc_jid}" xmlns="jabber:client">
                    <result xmlns="urn:xmpp:mam:2" queryid="${queryid}" id="stanza-id">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2019-09-20T23:08:25Z"/>
                            <message type="groupchat" from="${muc_jid}/eve" to="${_converse.bare_jid}" id="message-id-1">
                                <retracted stamp='2019-09-20T23:19:12Z' xmlns='urn:xmpp:message-retract:1'>
                                    <moderated by="${muc_jid}/bob" xmlns="urn:xmpp:message-moderate:1"/>
                                    <reason>This message contains inappropriate content for this forum</reason>
                                </retracted>
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
                                <retract id="stanza-id" xmlns='urn:xmpp:message-retract:1'>
                                    <moderated by='room@muc.example.com/macbeth' xmlns='urn:xmpp:message-moderate:1'/>
                                    <reason>This message contains inappropriate content</reason>
                                </retract>
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
})
