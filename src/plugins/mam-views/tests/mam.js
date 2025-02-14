/*global mock, converse */
const Model = converse.env.Model;
const Strophe = converse.env.Strophe;
const $iq = converse.env.$iq;
const $msg = converse.env.$msg;
const u = converse.env.utils;
const sizzle = converse.env.sizzle;
const original_timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
// See: https://xmpp.org/rfcs/rfc3921.html

// Implements the protocol defined in https://xmpp.org/extensions/xep-0313.html#config
describe("Message Archive Management", function () {

    beforeEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = 7000));
    afterEach(() => (jasmine.DEFAULT_TIMEOUT_INTERVAL = original_timeout));

    describe("The XEP-0313 Archive", function () {

        it("is queried when the user scrolls up",
                mock.initConverse(['discoInitialized'], {'archived_messages_page_size': 2}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            const view = _converse.chatboxviews.get(contact_jid);
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            let stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            const queryid = stanza.querySelector('query').getAttribute('queryid');
            let msg = $msg({'id': _converse.api.connection.get().getUniqueId(), 'to': _converse.bare_jid})
                        .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id': _converse.api.connection.get().getUniqueId()})
                            .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                .c('message', {
                                    'xmlns':'jabber:client',
                                    'to': _converse.bare_jid,
                                    'id': _converse.api.connection.get().getUniqueId(),
                                    'from': contact_jid,
                                    'type':'chat'
                                }).c('body').t("Meet me at the dance");
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg));

            msg = $msg({'id': _converse.api.connection.get().getUniqueId(), 'to': _converse.bare_jid})
                        .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id': _converse.api.connection.get().getUniqueId()})
                            .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                .c('message', {
                                    'xmlns':'jabber:client',
                                    'to': _converse.bare_jid,
                                    'id': _converse.api.connection.get().getUniqueId(),
                                    'from': contact_jid,
                                    'type':'chat'
                                }).c('body').t("Thrice the brinded cat hath mew'd.");
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg));

            const iq_result = $iq({'type': 'result', 'id': stanza.getAttribute('id')})
                .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                    .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                        .c('first', {'index': '0'}).t('23452-4534-1').up()
                        .c('last').t('09af3-cc343-b409f').up()
                        .c('count').t('16');
            _converse.api.connection.get()._dataRecv(mock.createRequest(iq_result));

            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);
            expect(view.model.messages.length).toBe(2);

            while (sent_IQs.length) { sent_IQs.pop(); }
            _converse.api.trigger('chatBoxScrolledUp', view);
            stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            expect(Strophe.serialize(stanza)).toBe(
                `<iq id="${stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                    `<query queryid="${stanza.querySelector('query').getAttribute('queryid')}" xmlns="urn:xmpp:mam:2">`+
                    `<x type="submit" xmlns="jabber:x:data">`+
                        `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field><field var="with"><value>mercutio@montague.lit</value></field>`+
                    `</x>`+
                    `<set xmlns="http://jabber.org/protocol/rsm"><before>${view.model.messages.at(0).get('stanza_id romeo@montague.lit')}</before><max>2</max></set></query>`+
                `</iq>`
            );
        }));

        it("is queried when the user enters a new MUC",
            mock.initConverse(['discoInitialized'],
                {
                    'archived_messages_page_size': 2,
                    'muc_clear_messages_on_leave': false,
                }, async function (_converse) {

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const muc_jid = 'orchard@chat.shakespeare.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            let view = _converse.chatboxviews.get(muc_jid);
            let iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            expect(Strophe.serialize(iq_get)).toBe(
                `<iq id="${iq_get.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">`+
                    `<query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="${Strophe.NS.MAM}">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                        `</x>`+
                        `<set xmlns="http://jabber.org/protocol/rsm"><before></before><max>2</max></set>`+
                    `</query>`+
                `</iq>`);

            let first_msg_id = _converse.api.connection.get().getUniqueId();
            let last_msg_id = _converse.api.connection.get().getUniqueId();
            let message = u.toStanza(
                `<message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${first_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:15:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>2nd Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            message = u.toStanza(
                `<message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${last_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:16:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>3rd Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            // Clear so that we don't match the older query
            while (sent_IQs.length) { sent_IQs.pop(); }

            // XXX: Even though the count is 3, when fetching messages for
            // the first time, we don't paginate, so that message
            // is not fetched. The user needs to manually load older
            // messages for it to be fetched.
            // TODO: we need to add a clickable link to load older messages
            let result = u.toStanza(
                `<iq type='result' id='${iq_get.getAttribute('id')}'>
                    <fin xmlns='urn:xmpp:mam:2'>
                        <set xmlns='http://jabber.org/protocol/rsm'>
                            <first index='0'>${first_msg_id}</first>
                            <last>${last_msg_id}</last>
                            <count>3</count>
                        </set>
                    </fin>
                </iq>`);
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.model.messages.length === 2);
            view.close();
            // Clear so that we don't match the older query
            while (sent_IQs.length) { sent_IQs.pop(); }

            await u.waitUntil(() => _converse.chatboxes.length === 1);

            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.model.messages.length);

            iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            expect(Strophe.serialize(iq_get)).toBe(
                `<iq id="${iq_get.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">`+
                    `<query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="${Strophe.NS.MAM}">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                        `</x>`+
                        `<set xmlns="http://jabber.org/protocol/rsm"><after>${message.querySelector('result').getAttribute('id')}</after><max>2</max></set>`+
                    `</query>`+
                `</iq>`);

            first_msg_id = _converse.api.connection.get().getUniqueId();
            last_msg_id = _converse.api.connection.get().getUniqueId();
            message = u.toStanza(
                `<message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${first_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:17:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>4th Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            message = u.toStanza(
                `<message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${last_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:18:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>5th Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            // Clear so that we don't match the older query
            while (sent_IQs.length) { sent_IQs.pop(); }

            result = u.toStanza(
                `<iq type='result' id='${iq_get.getAttribute('id')}'>
                    <fin xmlns='urn:xmpp:mam:2'>
                        <set xmlns='http://jabber.org/protocol/rsm'>
                            <first index='0'>${first_msg_id}</first>
                            <last>${last_msg_id}</last>
                            <count>5</count>
                        </set>
                    </fin>
                </iq>`);
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.model.messages.length === 4);

            iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            expect(Strophe.serialize(iq_get)).toBe(
                `<iq id="${iq_get.getAttribute('id')}" to="orchard@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                    `<query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="urn:xmpp:mam:2">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                        `</x>`+
                        `<set xmlns="http://jabber.org/protocol/rsm">`+
                            `<after>${last_msg_id}</after>`+
                            `<max>2</max>`+
                        `</set>`+
                    `</query>`+
                `</iq>`);

            const msg_id = _converse.api.connection.get().getUniqueId();
            message = u.toStanza(
                `<message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:19:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>6th Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            result = u.toStanza(
                `<iq type='result' id='${iq_get.getAttribute('id')}'>
                    <fin xmlns="urn:xmpp:mam:2" complete="true">
                        <set xmlns="http://jabber.org/protocol/rsm">
                            <first index="0">${msg_id}</first>
                            <last>${msg_id}</last>
                            <count>6</count>
                        </set>
                    </fin>
                </iq>`);
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.model.messages.length === 5);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
            await u.waitUntil(() => Array.from(view.querySelectorAll('.chat-msg__text'))
                .map(e => e.textContent).join(' ') === "2nd Message 3rd Message 4th Message 5th Message 6th Message", 1000);
        }));

        it("queries for messages since the most recent cached message in a newly entered MUC",
            mock.initConverse(['discoInitialized'],
                {
                    'archived_messages_page_size': 2,
                    'muc_nickname_from_jid': false,
                    'muc_clear_messages_on_leave': false,
                }, async function (_converse) {

            const { api } = _converse;
            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const muc_jid = 'orchard@chat.shakespeare.lit';
            const nick = 'romeo';
            const room_creation_promise = api.rooms.open(muc_jid);
            await mock.waitForMUCDiscoFeatures(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, nick);
            await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
            await room_creation_promise;
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));

            // Create "cached" message to test that only messages newer than the
            // last cached message with body text will be fetched
            view.model.messages.create({
                'type': 'groupchat',
                'to': muc_jid,
                'from': `${_converse.bare_jid}/orchard`,
                'body': 'Hello world',
                'message': 'Hello world',
                'time': '2021-02-02T12:00:00Z'
            });
            // Hack: Manually set attributes that would otherwise happen in fetchMessages
            view.model.messages.fetched_flag = true;
            view.model.afterMessagesFetched(view.model.messages);
            view.model.messages.fetched.resolve();

            const affs = api.settings.get('muc_fetch_members');
            const all_affiliations = Array.isArray(affs) ? affs :  (affs ? ['member', 'admin', 'owner'] : []);
            await mock.returnMemberLists(_converse, muc_jid, [], all_affiliations);

            const iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            expect(Strophe.serialize(iq_get)).toBe(
                `<iq id="${iq_get.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">`+
                    `<query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="${Strophe.NS.MAM}">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                            `<field var="start"><value>2021-02-02T12:00:00.000Z</value></field>`+
                        `</x>`+
                        `<set xmlns="http://jabber.org/protocol/rsm"><max>2</max></set>`+
                    `</query>`+
                `</iq>`);
        }));
    });

    describe("An archived message", function () {
        describe("when received", function () {

            it("is discarded if it doesn't come from the right sender",
                mock.initConverse(
                    ['discoInitialized'], {},
                    async function (_converse) {

                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                const sent_IQs = _converse.api.connection.get().IQ_stanzas;
                const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.MAM}"]`)).pop());
                const queryid = stanza.querySelector('query').getAttribute('queryid');
                let msg = $msg({'id': _converse.api.connection.get().getUniqueId(), 'from': 'impersonator@capulet.lit', 'to': _converse.bare_jid})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id': _converse.api.connection.get().getUniqueId()})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to': _converse.bare_jid,
                                        'id': _converse.api.connection.get().getUniqueId(),
                                        'from': contact_jid,
                                        'type':'chat'
                                    }).c('body').t("Meet me at the dance");
                spyOn(converse.env.log, 'warn');
                _converse.api.connection.get()._dataRecv(mock.createRequest(msg));
                expect(converse.env.log.warn).toHaveBeenCalledWith(`Ignoring alleged MAM message from ${msg.nodeTree.getAttribute('from')}`);

                msg = $msg({'id': _converse.api.connection.get().getUniqueId(), 'to': _converse.bare_jid})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id': _converse.api.connection.get().getUniqueId()})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to': _converse.bare_jid,
                                        'id': _converse.api.connection.get().getUniqueId(),
                                        'from': contact_jid,
                                        'type':'chat'
                                    }).c('body').t("Thrice the brinded cat hath mew'd.");
                _converse.api.connection.get()._dataRecv(mock.createRequest(msg));

                const iq_result = $iq({'type': 'result', 'id': stanza.getAttribute('id')})
                    .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                        .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                            .c('first', {'index': '0'}).t('23452-4534-1').up()
                            .c('last').t('09af3-cc343-b409f').up()
                            .c('count').t('16');
                _converse.api.connection.get()._dataRecv(mock.createRequest(iq_result));

                await u.waitUntil(() => Array.from(view.querySelectorAll('.chat-msg__text'))
                    .filter(el => el.textContent === "Thrice the brinded cat hath mew'd.").length, 1000);
                expect(view.model.messages.length).toBe(1);
                expect(view.model.messages.at(0).get('message')).toBe("Thrice the brinded cat hath mew'd.");
            }));

            it("is not discarded if it comes from the right sender",
                mock.initConverse(
                    ['discoInitialized'], {},
                    async function (_converse) {

                await mock.waitForRoster(_converse, 'current', 1);
                const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
                await mock.openChatBoxFor(_converse, contact_jid);
                const view = _converse.chatboxviews.get(contact_jid);
                await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);
                const sent_IQs = _converse.api.connection.get().IQ_stanzas;
                const stanza = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq[type="set"] query[xmlns="${Strophe.NS.MAM}"]`)).pop());
                const queryid = stanza.querySelector('query').getAttribute('queryid');
                let msg = $msg({'id': _converse.api.connection.get().getUniqueId(), 'from': _converse.bare_jid, 'to': _converse.bare_jid})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id': _converse.api.connection.get().getUniqueId()})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to': _converse.bare_jid,
                                        'id': _converse.api.connection.get().getUniqueId(),
                                        'from': contact_jid,
                                        'type':'chat'
                                    }).c('body').t("Meet me at the dance");
                spyOn(converse.env.log, 'warn');
                _converse.api.connection.get()._dataRecv(mock.createRequest(msg));

                msg = $msg({'id': _converse.api.connection.get().getUniqueId(), 'to': _converse.bare_jid})
                            .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id': _converse.api.connection.get().getUniqueId()})
                                .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                    .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                    .c('message', {
                                        'xmlns':'jabber:client',
                                        'to': _converse.bare_jid,
                                        'id': _converse.api.connection.get().getUniqueId(),
                                        'from': contact_jid,
                                        'type':'chat'
                                    }).c('body').t("Thrice the brinded cat hath mew'd.");
                _converse.api.connection.get()._dataRecv(mock.createRequest(msg));

                const iq_result = $iq({'type': 'result', 'id': stanza.getAttribute('id')})
                    .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                        .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                            .c('first', {'index': '0'}).t('23452-4534-1').up()
                            .c('last').t('09af3-cc343-b409f').up()
                            .c('count').t('16');
                _converse.api.connection.get()._dataRecv(mock.createRequest(iq_result));

                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);
                expect(view.model.messages.length).toBe(2);
                expect(view.model.messages.at(0).get('message')).toBe("Meet me at the dance");
                expect(view.model.messages.at(1).get('message')).toBe("Thrice the brinded cat hath mew'd.");
            }));

            it("updates the is_archived value of an already cached version",
                mock.initConverse(
                    ['discoInitialized'], {},
                    async function (_converse) {

                await mock.openAndEnterChatRoom(_converse, 'trek-radio@conference.lightwitch.org', 'romeo');

                const view = _converse.chatboxviews.get('trek-radio@conference.lightwitch.org');
                let stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="romeo@montague.lit/orchard" type="groupchat" from="trek-radio@conference.lightwitch.org/some1">
                        <body>Hello</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="45fbbf2a-1059-479d-9283-c8effaf05621" by="trek-radio@conference.lightwitch.org"/>
                    </message>`);
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => view.querySelectorAll('.chat-msg').length);
                expect(view.model.messages.length).toBe(1);
                expect(view.model.messages.at(0).get('is_archived')).toBe(false);
                expect(view.model.messages.at(0).get('stanza_id trek-radio@conference.lightwitch.org')).toBe('45fbbf2a-1059-479d-9283-c8effaf05621');

                stanza = u.toStanza(
                    `<message xmlns="jabber:client"
                            to="romeo@montague.lit/orchard"
                            from="trek-radio@conference.lightwitch.org">
                        <result xmlns="urn:xmpp:mam:2" queryid="82d9db27-6cf8-4787-8c2c-5a560263d823" id="45fbbf2a-1059-479d-9283-c8effaf05621">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:17:23Z"/>
                                <message from="trek-radio@conference.lightwitch.org/some1" type="groupchat">
                                    <body>Hello</body>
                                </message>
                            </forwarded>
                        </result>
                    </message>`);
                spyOn(view.model, 'getDuplicateMessage').and.callThrough();
                spyOn(view.model, 'updateMessage').and.callThrough();
                _converse.handleMAMResult(view.model, { 'messages': [stanza] });
                await u.waitUntil(() => view.model.getDuplicateMessage.calls.count());
                expect(view.model.getDuplicateMessage.calls.count()).toBe(1);
                const result = view.model.getDuplicateMessage.calls.all()[0].returnValue
                expect(result instanceof _converse.Message).toBe(true);
                expect(view.querySelectorAll('.chat-msg').length).toBe(1);

                await u.waitUntil(() => view.model.updateMessage.calls.count());
                expect(view.model.messages.length).toBe(1);
                expect(view.model.messages.at(0).get('is_archived')).toBe(true);
                expect(view.model.messages.at(0).get('stanza_id trek-radio@conference.lightwitch.org')).toBe('45fbbf2a-1059-479d-9283-c8effaf05621');
            }));

            it("isn't shown as duplicate by comparing its stanza id or archive id",
                mock.initConverse(
                    ['discoInitialized'], {},
                    async function (_converse) {

                await mock.openAndEnterChatRoom(_converse, 'trek-radio@conference.lightwitch.org', 'jcbrand');
                const view = _converse.chatboxviews.get('trek-radio@conference.lightwitch.org');
                let stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="jcbrand@lightwitch.org/converse.js-73057452" type="groupchat" from="trek-radio@conference.lightwitch.org/comndrdukath#0805 (STO)">
                        <body>negan</body>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="45fbbf2a-1059-479d-9283-c8effaf05621" by="trek-radio@conference.lightwitch.org"/>
                    </message>`);
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => view.querySelectorAll('.chat-msg').length);
                // Not sure whether such a race-condition might pose a problem
                // in "real-world" situations.
                stanza = u.toStanza(
                    `<message xmlns="jabber:client"
                            to="jcbrand@lightwitch.org/converse.js-73057452"
                            from="trek-radio@conference.lightwitch.org">
                        <result xmlns="urn:xmpp:mam:2" queryid="82d9db27-6cf8-4787-8c2c-5a560263d823" id="45fbbf2a-1059-479d-9283-c8effaf05621">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:17:23Z"/>
                                <message from="trek-radio@conference.lightwitch.org/comndrdukath#0805 (STO)" type="groupchat">
                                    <body>negan</body>
                                </message>
                            </forwarded>
                        </result>
                    </message>`);
                spyOn(view.model, 'getDuplicateMessage').and.callThrough();
                _converse.handleMAMResult(view.model, { 'messages': [stanza] });
                await u.waitUntil(() => view.model.getDuplicateMessage.calls.count());
                expect(view.model.getDuplicateMessage.calls.count()).toBe(1);
                const result = await view.model.getDuplicateMessage.calls.all()[0].returnValue
                expect(result instanceof _converse.Message).toBe(true);
                expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            }));

            it("isn't shown as duplicate by comparing only the archive id",
                mock.initConverse(
                    ['discoInitialized'], {},
                    async function (_converse) {

                await mock.openAndEnterChatRoom(_converse, 'discuss@conference.conversejs.org', 'romeo');
                const view = _converse.chatboxviews.get('discuss@conference.conversejs.org');
                let stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="romeo@montague.lit/orchard" from="discuss@conference.conversejs.org">
                        <result xmlns="urn:xmpp:mam:2" queryid="06fea9ca-97c9-48c4-8583-009ff54ea2e8" id="7a9fde91-4387-4bf8-b5d3-978dab8f6bf3">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <delay xmlns="urn:xmpp:delay" stamp="2018-12-05T04:53:12Z"/>
                                <message xmlns="jabber:client" to="discuss@conference.conversejs.org" type="groupchat" xml:lang="en" from="discuss@conference.conversejs.org/prezel">
                                    <body>looks like omemo fails completely with "bundle is undefined" when there is a device in the devicelist that has no keys published</body>
                                    <x xmlns="http://jabber.org/protocol/muc#user">
                                        <item affiliation="none" jid="prezel@blubber.im" role="participant"/>
                                    </x>
                                </message>
                            </forwarded>
                        </result>
                    </message>`);
                _converse.handleMAMResult(view.model, { 'messages': [stanza] });
                await u.waitUntil(() => view.querySelectorAll('.chat-msg').length);
                expect(view.querySelectorAll('.chat-msg').length).toBe(1);

                stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="romeo@montague.lit/orchard" from="discuss@conference.conversejs.org">
                        <result xmlns="urn:xmpp:mam:2" queryid="06fea9ca-97c9-48c4-8583-009ff54ea2e8" id="7a9fde91-4387-4bf8-b5d3-978dab8f6bf3">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <delay xmlns="urn:xmpp:delay" stamp="2018-12-05T04:53:12Z"/>
                                <message xmlns="jabber:client" to="discuss@conference.conversejs.org" type="groupchat" xml:lang="en" from="discuss@conference.conversejs.org/prezel">
                                    <body>looks like omemo fails completely with "bundle is undefined" when there is a device in the devicelist that has no keys published</body>
                                    <x xmlns="http://jabber.org/protocol/muc#user">
                                        <item affiliation="none" jid="prezel@blubber.im" role="participant"/>
                                    </x>
                                </message>
                            </forwarded>
                        </result>
                    </message>`);

                spyOn(view.model, 'getDuplicateMessage').and.callThrough();
                _converse.handleMAMResult(view.model, { 'messages': [stanza] });
                await u.waitUntil(() => view.model.getDuplicateMessage.calls.count());
                expect(view.model.getDuplicateMessage.calls.count()).toBe(1);
                const result = await view.model.getDuplicateMessage.calls.all()[0].returnValue
                expect(result instanceof _converse.Message).toBe(true);
                expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            }))
        });
    });

    describe("The default preference", function () {

        it("is set once server support for MAM has been confirmed",
                mock.initConverse([], {}, async function (_converse) {

            const { api } = _converse;

            const entity = await _converse.api.disco.entities.get(_converse.domain);
            spyOn(_converse.exports, 'onMAMPreferences').and.callThrough();
            api.settings.set('message_archiving', 'never');

            const feature = new Model({
                'var': Strophe.NS.MAM
            });
            spyOn(feature, 'save').and.callFake(feature.set); // Save will complain about a url not being set

            entity.onFeatureAdded(feature);

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            let sent_stanza = await u.waitUntil(() => IQ_stanzas.filter(s => sizzle('iq[type="get"] prefs[xmlns="urn:xmpp:mam:2"]', s).length).pop());
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq id="${sent_stanza.getAttribute('id')}" type="get" xmlns="jabber:client">`+
                    `<prefs xmlns="urn:xmpp:mam:2"/>`+
                `</iq>`);

            /* Example 20. Server responds with current preferences
             *
             * <iq type='result' id='juliet2'>
             *   <prefs xmlns='urn:xmpp:mam:0' default='roster'>
             *     <always/>
             *     <never/>
             *   </prefs>
             * </iq>
             */
            let stanza = $iq({'type': 'result', 'id': sent_stanza.getAttribute('id')})
                .c('prefs', {'xmlns': Strophe.NS.MAM, 'default':'roster'})
                .c('always').c('jid').t('romeo@montague.lit').up().up()
                .c('never').c('jid').t('montague@montague.lit');
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            await u.waitUntil(() => _converse.exports.onMAMPreferences.calls.count());
            expect(_converse.exports.onMAMPreferences).toHaveBeenCalled();

            sent_stanza = await u.waitUntil(() => IQ_stanzas.filter(s => sizzle('iq[type="set"] prefs[xmlns="urn:xmpp:mam:2"]', s).length).pop());
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                    `<prefs default="never" xmlns="urn:xmpp:mam:2">`+
                        `<always><jid>romeo@montague.lit</jid></always>`+
                        `<never><jid>montague@montague.lit</jid></never>`+
                    `</prefs>`+
                `</iq>`
            );

            expect(feature.get('preference')).toBe(undefined);
            /* <iq type='result' id='juliet3'>
             *   <prefs xmlns='urn:xmpp:mam:0' default='always'>
             *       <always>
             *          <jid>romeo@montague.lit</jid>
             *       </always>
             *       <never>
             *          <jid>montague@montague.lit</jid>
             *       </never>
             *   </prefs>
             * </iq>
             */
            stanza = $iq({'type': 'result', 'id': sent_stanza.getAttribute('id')})
                .c('prefs', {'xmlns': Strophe.NS.MAM, 'default':'always'})
                    .c('always').up()
                    .c('never');
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => feature.save.calls.count());
            expect(feature.save).toHaveBeenCalled();
            expect(feature.get('preferences')['default']).toBe('never'); // eslint-disable-line dot-notation
        }));
    });
});

describe("Chatboxes", function () {
    describe("A Chatbox", function () {

        it("will fetch archived messages once it's opened",
                mock.initConverse(['discoInitialized'], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);

            let sent_stanza, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            await u.waitUntil(() => sent_stanza);
            const stanza_el = sent_stanza;
            const queryid = stanza_el.querySelector('query').getAttribute('queryid');
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq id="${stanza_el.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                    `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                            `<field var="with"><value>mercutio@montague.lit</value></field>`+
                        `</x>`+
                        `<set xmlns="http://jabber.org/protocol/rsm"><before></before><max>50</max></set>`+
                    `</query>`+
                `</iq>`
            );
            const msg1 = $msg({'id':'aeb212', 'to': contact_jid})
                        .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'28482-98726-73623'})
                            .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                .c('message', {
                                    'xmlns':'jabber:client',
                                    'to': contact_jid,
                                    'from': _converse.bare_jid,
                                    'type':'chat' })
                                .c('body').t("Call me but love, and I'll be new baptized;");
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg1));
            const msg2 = $msg({'id':'aeb213', 'to': contact_jid})
                        .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'28482-98726-73624'})
                            .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                .c('message', {
                                    'xmlns':'jabber:client',
                                    'to': contact_jid,
                                    'from': _converse.bare_jid,
                                    'type':'chat' })
                                .c('body').t("Henceforth I never will be Romeo.");
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg2));
            const stanza = $iq({'type': 'result', 'id': IQ_id})
                .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                    .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                        .c('first', {'index': '0'}).t('23452-4534-1').up()
                        .c('last').t('09af3-cc343-b409f').up()
                        .c('count').t('16');
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
        }));

        it("will show an error message if the MAM query times out",
                mock.initConverse(['discoInitialized'], {}, async function (_converse) {

            const sendIQ = _converse.api.connection.get().sendIQ;

            let timeout_happened = false;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sendIQ.bind(this)(iq, callback, errback);
                if (!timeout_happened) {
                    if (typeof(iq.tree) === "function") {
                        iq = iq.tree();
                    }
                    if (sizzle('query[xmlns="urn:xmpp:mam:2"]', iq).length) {
                        // We emulate a timeout event
                        callback(null);
                        timeout_happened = true;
                    }
                }
            });
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await mock.openChatBoxFor(_converse, contact_jid);
            await mock.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, null, [Strophe.NS.MAM]);

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            let sent_stanza = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle('query[xmlns="urn:xmpp:mam:2"]', iq).length).pop());
            let queryid = sent_stanza.querySelector('query').getAttribute('queryid');

            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                    `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                            `<field var="with"><value>mercutio@montague.lit</value></field>`+
                        `</x>`+
                        `<set xmlns="http://jabber.org/protocol/rsm"><before></before><max>50</max></set>`+
                    `</query>`+
                `</iq>`);

            const view = _converse.chatboxviews.get(contact_jid);
            expect(view.model.messages.length).toBe(1);
            expect(view.model.messages.at(0).get('is_ephemeral')).toBe(20000);
            expect(view.model.messages.at(0).get('type')).toBe('error');
            expect(view.model.messages.at(0).get('message')).toBe('Timeout while trying to fetch archived messages.');

            let err_message = await u.waitUntil(() => view.querySelector('.message.chat-error'));
            err_message.querySelector('.retry').click();

            while (_converse.api.connection.get().IQ_stanzas.length) {
                _converse.api.connection.get().IQ_stanzas.pop();
            }
            sent_stanza = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle('query[xmlns="urn:xmpp:mam:2"]', iq).length).pop());
            queryid = sent_stanza.querySelector('query').getAttribute('queryid');
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                    `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                            `<field var="with"><value>mercutio@montague.lit</value></field>`+
                        `</x>`+
                        `<set xmlns="http://jabber.org/protocol/rsm"><before></before><max>50</max></set>`+
                    `</query>`+
                `</iq>`);

            const msg1 = $msg({'id':'aeb212', 'to': contact_jid})
                        .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid': queryid, 'id':'28482-98726-73623'})
                            .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                .c('message', {
                                    'xmlns':'jabber:client',
                                    'to': contact_jid,
                                    'from': _converse.bare_jid,
                                    'type':'chat' })
                                .c('body').t("Call me but love, and I'll be new baptized;");
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg1));

            const msg2 = $msg({'id':'aeb213', 'to': contact_jid})
                        .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid': queryid, 'id':'28482-98726-73624'})
                            .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:18:25Z'}).up()
                                .c('message', {
                                    'xmlns':'jabber:client',
                                    'to': contact_jid,
                                    'from': _converse.bare_jid,
                                    'type':'chat' })
                                .c('body').t("Henceforth I never will be Romeo.");
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg2));

            const stanza = $iq({'type': 'result', 'id': sent_stanza.getAttribute('id')})
                .c('fin', {'xmlns': 'urn:xmpp:mam:2', 'complete': true})
                    .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                        .c('first', {'index': '0'}).t('28482-98726-73623').up()
                        .c('last').t('28482-98726-73624').up()
                        .c('count').t('2');
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.model.messages.length === 2, 500);
            err_message = view.querySelector('.message.chat-error');
            expect(err_message).toBe(null);
        }));
    });
});
