/*global mock, converse */

const { $pres, $iq, $msg, Strophe, Promise, sizzle, u }  = converse.env;

describe("Groupchats", function () {

    describe("An instant groupchat", function () {

        it("will be created when muc_instant_rooms is set to true",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            let IQ_stanzas = _converse.connection.IQ_stanzas;
            const muc_jid = 'lounge@montague.lit';
            const nick = 'nicky';
            await mock.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');

            const disco_selector = `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`;
            const stanza = await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector(disco_selector)).pop());
            // We pretend this is a new room, so no disco info is returned.
            const features_stanza = $iq({
                    'from': 'lounge@montague.lit',
                    'id': stanza.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'error'
                }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            const view = _converse.chatboxviews.get('lounge@montague.lit');
            spyOn(view.model, 'join').and.callThrough();
            await mock.waitForReservedNick(_converse, muc_jid, '');
            const input = await u.waitUntil(() => view.querySelector('input[name="nick"]'), 1000);
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.NICKNAME_REQUIRED);
            input.value = nick;
            view.querySelector('input[type=submit]').click();
            expect(view.model.join).toHaveBeenCalled();

            _converse.connection.IQ_stanzas = [];
            await mock.getRoomFeatures(_converse, muc_jid);
            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);
            await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);

            // The user has just entered the room (because join was called)
            // and receives their own presence from the server.
            // See example 24:
            // https://xmpp.org/extensions/xep-0045.html#enter-pres
            //
            /* <presence xmlns="jabber:client" to="jordie.langen@chat.example.org/converse.js-11659299" from="myroom@conference.chat.example.org/jc">
             *    <x xmlns="http://jabber.org/protocol/muc#user">
             *        <item jid="jordie.langen@chat.example.org/converse.js-11659299" affiliation="owner" role="moderator"/>
             *        <status code="110"/>
             *        <status code="201"/>
             *    </x>
             *  </presence>
             */
            const presence = $pres({
                    to:'romeo@montague.lit/orchard',
                    from:'lounge@montague.lit/nicky',
                    id:'5025e055-036c-4bc5-a227-706e7e352053'
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
            .c('item').attrs({
                affiliation: 'owner',
                jid: 'romeo@montague.lit/orchard',
                role: 'moderator'
            }).up()
            .c('status').attrs({code:'110'}).up()
            .c('status').attrs({code:'201'}).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED);
            await mock.returnMemberLists(_converse, muc_jid);
            const num_info_msgs = await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-info').length);
            expect(num_info_msgs).toBe(1);

            const info_texts = Array.from(view.querySelectorAll('.chat-content .chat-info')).map(e => e.textContent.trim());
            expect(info_texts[0]).toBe('A new groupchat has been created');

            const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
            expect(csntext.trim()).toEqual("nicky has entered the groupchat");

            // An instant room is created by saving the default configuratoin.
            //
            /* <iq to="myroom@conference.chat.example.org" type="set" xmlns="jabber:client" id="5025e055-036c-4bc5-a227-706e7e352053:sendIQ">
             *   <query xmlns="http://jabber.org/protocol/muc#owner"><x xmlns="jabber:x:data" type="submit"/></query>
             * </iq>
             */
            const selector = `query[xmlns="${Strophe.NS.MUC_OWNER}"]`;
            IQ_stanzas = _converse.connection.IQ_stanzas;
            const iq = await u.waitUntil(() => IQ_stanzas.filter(s => s.querySelector(selector)).pop());
            expect(Strophe.serialize(iq)).toBe(
                `<iq id="${iq.getAttribute('id')}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#owner"><x type="submit" xmlns="jabber:x:data"/>`+
                `</query></iq>`);
        }));
    });

    describe("A Groupchat", function () {

        it("will be visible when opened as the first chat in fullscreen-view",
                mock.initConverse(['discoInitialized'],
                    { 'view_mode': 'fullscreen', 'auto_join_rooms': ['orchard@chat.shakespeare.lit']},
                    async function (_converse) {

            const { api } = _converse;
            await api.waitUntil('roomsAutoJoined');
            const room = await api.rooms.get('orchard@chat.shakespeare.lit');
            expect(room.get('hidden')).toBe(false);
        }));

        it("Can be configured to show cached messages before being joined",
            mock.initConverse(['discoInitialized'],
                {
                    'muc_show_logs_before_join': true,
                    'archived_messages_page_size': 2,
                    'muc_nickname_from_jid': false,
                    'muc_clear_messages_on_leave': false,
                }, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'orchard@chat.shakespeare.lit';
            const nick = 'romeo';
            api.rooms.open(muc_jid);
            await mock.getRoomFeatures(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid);
            const view = _converse.chatboxviews.get(muc_jid);
            await view.model.messages.fetched;

            view.model.messages.create({
                'type': 'groupchat',
                'to': muc_jid,
                'from': `${_converse.bare_jid}/orchard`,
                'body': 'Hello world',
                'message': 'Hello world',
                'time': '2021-02-02T12:00:00Z'
            });
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.NICKNAME_REQUIRED);
            await u.waitUntil(() => view.querySelectorAll('converse-chat-message').length === 1);

            const sel = 'converse-message-history converse-chat-message .chat-msg__text';
            await u.waitUntil(() => view.querySelector(sel)?.textContent.trim());
            expect(view.querySelector(sel).textContent.trim()).toBe('Hello world')

            const nick_input = await u.waitUntil(() => view.querySelector('[name="nick"]'));
            nick_input.value = nick;
            view.querySelector('.muc-nickname-form input[type="submit"]').click();
            _converse.connection.IQ_stanzas = [];
            await mock.getRoomFeatures(_converse, muc_jid);
            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);
            await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
        }));

        it("maintains its state across reloads",
            mock.initConverse([], {
                    'clear_messages_on_reconnection': true,
                    'enable_smacks': false
                }, async function (_converse) {

            const { api } = _converse;
            const nick = 'romeo';
            const sent_IQs = _converse.connection.IQ_stanzas;
            const muc_jid = 'lounge@montague.lit'
            await mock.openAndEnterChatRoom(_converse, muc_jid, nick, [], []);
            const view = _converse.chatboxviews.get(muc_jid);
            let iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            const first_msg_id = _converse.connection.getUniqueId();
            const last_msg_id = _converse.connection.getUniqueId();
            let message = u.toStanza(
                `<message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${first_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:15:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>1st Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(message));

            message = u.toStanza(
                `<message xmlns="jabber:client"
                        to="romeo@montague.lit/orchard"
                        from="${muc_jid}">
                    <result xmlns="urn:xmpp:mam:2" queryid="${iq_get.querySelector('query').getAttribute('queryid')}" id="${last_msg_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:16:23Z"/>
                            <message from="${muc_jid}/some1" type="groupchat">
                                <body>2nd Message</body>
                            </message>
                        </forwarded>
                    </result>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(message));

            const result = u.toStanza(
                `<iq type='result' id='${iq_get.getAttribute('id')}'>
                    <fin xmlns='urn:xmpp:mam:2'>
                        <set xmlns='http://jabber.org/protocol/rsm'>
                            <first index='0'>${first_msg_id}</first>
                            <last>${last_msg_id}</last>
                            <count>2</count>
                        </set>
                    </fin>
                </iq>`);
            _converse.connection._dataRecv(mock.createRequest(result));
            await u.waitUntil(()  => view.querySelectorAll('.chat-msg__text').length === 2);

            while (sent_IQs.length) { sent_IQs.pop(); } // Clear so that we don't match the older query
            await _converse.api.connection.reconnect();
            await mock.getRoomFeatures(_converse, muc_jid, []);
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

            // The user has just entered the room (because join was called)
            // and receives their own presence from the server.
            // See example 24: https://xmpp.org/extensions/xep-0045.html#enter-pres
            await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);

            message = u.toStanza(`
                <message xmlns="jabber:client" type="groupchat" id="918172de-d5c5-4da4-b388-446ef4a05bec" to="${_converse.jid}" xml:lang="en" from="${muc_jid}/juliet">
                    <body>Wherefore art though?</body>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="918172de-d5c5-4da4-b388-446ef4a05bec"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="88cc9c93-a8f4-4dd5-b02a-d19855eb6303" by="${muc_jid}"/>
                    <delay xmlns="urn:xmpp:delay" stamp="2020-07-14T17:46:47Z" from="juliet@shakespeare.lit"/>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(message));

            message = u.toStanza(`
                <message xmlns="jabber:client" type="groupchat" id="awQo6a-mi-Wa6NYh" to="${_converse.jid}" from="${muc_jid}/ews000" xml:lang="en">
                    <composing xmlns="http://jabber.org/protocol/chatstates"/>
                    <no-store xmlns="urn:xmpp:hints"/>
                    <no-permanent-store xmlns="urn:xmpp:hints"/>
                    <delay xmlns="urn:xmpp:delay" stamp="2020-07-14T17:46:54Z" from="juliet@shakespeare.lit"/>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(message));

            const affs = api.settings.get('muc_fetch_members');
            const all_affiliations = Array.isArray(affs) ? affs :  (affs ? ['member', 'admin', 'owner'] : []);
            await mock.returnMemberLists(_converse, muc_jid, [], all_affiliations);

            iq_get = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector(`iq query[xmlns="${Strophe.NS.MAM}"]`)).pop());
            expect(Strophe.serialize(iq_get)).toBe(
                `<iq id="${iq_get.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">`+
                    `<query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="${Strophe.NS.MAM}">`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>`+
                        `</x>`+
                        `<set xmlns="http://jabber.org/protocol/rsm"><before></before><max>50</max></set>`+
                    `</query>`+
                `</iq>`);
        }));

        it("shows a new messages indicator when you're scrolled up",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            const message = u.toStanza(`
                <message xmlns="jabber:client" type="groupchat" id="918172de-d5c5-4da4-b388-446ef4a05bec" to="${_converse.jid}" xml:lang="en" from="${muc_jid}/juliet">
                    <body>Wherefore art though?</body>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="918172de-d5c5-4da4-b388-446ef4a05bec"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="88cc9c93-a8f4-4dd5-b02a-d19855eb6303" by="${muc_jid}"/>
                    <delay xmlns="urn:xmpp:delay" stamp="2020-07-14T17:46:47Z" from="juliet@shakespeare.lit"/>
                </message>`);

            view.model.ui.set('scrolled', true); // hack
            _converse.connection._dataRecv(mock.createRequest(message));

            await u.waitUntil(() => view.model.messages.length);
            const chat_new_msgs_indicator = await u.waitUntil(() => view.querySelector('.new-msgs-indicator'));
            chat_new_msgs_indicator.click();
            expect(view.model.ui.get('scrolled')).toBeFalsy();
            await u.waitUntil(() => !u.isVisible(chat_new_msgs_indicator));
        }));


        describe("topic", function () {

            it("is shown the header", mock.initConverse([], {}, async function (_converse) {
                await mock.openAndEnterChatRoom(_converse, 'jdev@conference.jabber.org', 'jc');
                const text = 'Jabber/XMPP Development | RFCs and Extensions: https://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                let stanza = u.toStanza(`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>${text}</subject>
                        <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>
                        <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>
                    </message>`);
                _converse.connection._dataRecv(mock.createRequest(stanza));
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                await new Promise(resolve => view.model.once('change:subject', resolve));
                const head_desc = await u.waitUntil(() => view.querySelector('.chat-head__desc'), 1000);
                expect(head_desc?.textContent.trim()).toBe(text);

                stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>This is a message subject</subject>
                        <body>This is a message</body>
                    </message>`);
                _converse.connection._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                expect(sizzle('.chat-msg__subject', view).length).toBe(1);
                expect(sizzle('.chat-msg__subject', view).pop().textContent.trim()).toBe('This is a message subject');
                expect(sizzle('.chat-msg__text').length).toBe(1);
                expect(sizzle('.chat-msg__text').pop().textContent.trim()).toBe('This is a message');
                expect(view.querySelector('.chat-head__desc').textContent.trim()).toBe(text);
            }));

            it("can be toggled by the user", mock.initConverse([], {}, async function (_converse) {
                await mock.openAndEnterChatRoom(_converse, 'jdev@conference.jabber.org', 'jc');
                const text = 'Jabber/XMPP Development | RFCs and Extensions: https://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                let stanza = u.toStanza(`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>${text}</subject>
                        <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>
                        <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>
                    </message>`);
                _converse.connection._dataRecv(mock.createRequest(stanza));
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                await new Promise(resolve => view.model.once('change:subject', resolve));

                const head_desc = await u.waitUntil(() => view.querySelector('.chat-head__desc'));
                expect(head_desc?.textContent.trim()).toBe(text);

                stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>This is a message subject</subject>
                        <body>This is a message</body>
                    </message>`);
                _converse.connection._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                expect(sizzle('.chat-msg__subject', view).length).toBe(1);
                expect(sizzle('.chat-msg__subject', view).pop().textContent.trim()).toBe('This is a message subject');
                expect(sizzle('.chat-msg__text').length).toBe(1);
                expect(sizzle('.chat-msg__text').pop().textContent.trim()).toBe('This is a message');
                const topic_el = view.querySelector('.chat-head__desc');
                expect(topic_el.textContent.trim()).toBe(text);
                expect(u.isVisible(topic_el)).toBe(true);

                const toggle = view.querySelector('.hide-topic');
                expect(toggle.textContent.trim()).toBe('Hide topic');
                toggle.click();
                await u.waitUntil(() => view.querySelector('.hide-topic').textContent.trim() === 'Show topic');
            }));

            it("will always be shown when it's new", mock.initConverse([], {}, async function (_converse) {
                await mock.openAndEnterChatRoom(_converse, 'jdev@conference.jabber.org', 'jc');
                const text = 'Jabber/XMPP Development | RFCs and Extensions: https://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                let stanza = u.toStanza(`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>${text}</subject>
                    </message>`);
                _converse.connection._dataRecv(mock.createRequest(stanza));
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                await new Promise(resolve => view.model.once('change:subject', resolve));

                const head_desc = await u.waitUntil(() => view.querySelector('.chat-head__desc'));
                expect(head_desc?.textContent.trim()).toBe(text);

                let topic_el = view.querySelector('.chat-head__desc');
                expect(topic_el.textContent.trim()).toBe(text);
                expect(u.isVisible(topic_el)).toBe(true);

                const toggle = view.querySelector('.hide-topic');
                expect(toggle.textContent.trim()).toBe('Hide topic');
                toggle.click();
                await u.waitUntil(() => !u.isVisible(topic_el));

                stanza = u.toStanza(`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>Another topic</subject>
                    </message>`);
                _converse.connection._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => u.isVisible(view.querySelector('.chat-head__desc')));
                topic_el = view.querySelector('.chat-head__desc');
                expect(topic_el.textContent.trim()).toBe('Another topic');
            }));


            it("causes an info message to be shown when received in real-time", mock.initConverse([], {}, async function (_converse) {
                spyOn(_converse.ChatRoom.prototype, 'handleSubjectChange').and.callThrough();
                await mock.openAndEnterChatRoom(_converse, 'jdev@conference.jabber.org', 'romeo');
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');

                _converse.connection._dataRecv(mock.createRequest(u.toStanza(`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>This is an older topic</subject>
                        <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>
                        <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>
                    </message>`)));
                await u.waitUntil(() => view.model.handleSubjectChange.calls.count());
                expect(sizzle('.chat-info__message', view).length).toBe(0);

                const desc = await u.waitUntil(() => view.querySelector('.chat-head__desc'));
                expect(desc.textContent.trim()).toBe('This is an older topic');

                _converse.connection._dataRecv(mock.createRequest(u.toStanza(`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>This is a new topic</subject>
                    </message>`)));
                await u.waitUntil(() => view.model.handleSubjectChange.calls.count() === 2);

                await u.waitUntil(() => sizzle('.chat-info__message', view).pop()?.textContent.trim() === 'Topic set by ralphm');
                await u.waitUntil(() => desc.textContent.trim()  === 'This is a new topic');

                // Doesn't show multiple subsequent topic change notifications
                _converse.connection._dataRecv(mock.createRequest(u.toStanza(`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>Yet another topic</subject>
                    </message>`)));
                await u.waitUntil(() => view.model.handleSubjectChange.calls.count() === 3);
                await u.waitUntil(() => desc.textContent.trim()  === 'Yet another topic');
                expect(sizzle('.chat-info__message', view).length).toBe(1);

                // Sow multiple subsequent topic change notification from someone else
                _converse.connection._dataRecv(mock.createRequest(u.toStanza(`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/some1">
                        <subject>Some1's topic</subject>
                    </message>`)));
                await u.waitUntil(() => view.model.handleSubjectChange.calls.count() === 4);
                await u.waitUntil(() => desc.textContent.trim()  === "Some1's topic");
                expect(sizzle('.chat-info__message', view).length).toBe(2);
                const el = sizzle('.chat-info__message', view).pop();
                expect(el.textContent.trim()).toBe('Topic set by some1');

                // Removes current topic
                const stanza = u.toStanza(
                    `<message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/some1">
                        <subject/>
                    </message>`);
                _converse.connection._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => view.model.handleSubjectChange.calls.count() === 5);
                await u.waitUntil(() => view.querySelector('.chat-head__desc') === null);
                await u.waitUntil(() => view.querySelector('converse-chat-message:last-child .chat-info').textContent.trim() === "Topic cleared by some1");
            }));
        });

        it("restores cached messages when it reconnects and clear_messages_on_reconnection and muc_clear_messages_on_leave are false",
            mock.initConverse([], {
                    'clear_messages_on_reconnection': false,
                    'muc_clear_messages_on_leave': false
                },
                async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid , 'romeo');
            const model = _converse.chatboxes.get(muc_jid);
            const message = 'Hello world',
                    nick = mock.chatroom_names[0],
                    msg = $msg({
                    'from': 'lounge@montague.lit/'+nick,
                    'id': u.getUniqueId(),
                    'to': 'romeo@montague.lit',
                    'type': 'groupchat'
                }).c('body').t(message).tree();

            await model.handleMessageStanza(msg);
            await u.waitUntil(() => document.querySelector('converse-chat-message'));
            await model.close();
            await u.waitUntil(() => !document.querySelector('converse-chat-message'));

            _converse.connection.IQ_stanzas = [];
            await mock.openAndEnterChatRoom(_converse, muc_jid , 'romeo');
            await u.waitUntil(() => document.querySelector('converse-chat-message'));
            expect(model.messages.length).toBe(1);
            expect(document.querySelectorAll('converse-chat-message').length).toBe(1);
        }));

        it("clears cached messages when it reconnects and clear_messages_on_reconnection is true",
                mock.initConverse([], {'clear_messages_on_reconnection': true}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid , 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            const message = 'Hello world',
                    nick = mock.chatroom_names[0],
                    msg = $msg({
                    'from': 'lounge@montague.lit/'+nick,
                    'id': u.getUniqueId(),
                    'to': 'romeo@montague.lit',
                    'type': 'groupchat'
                }).c('body').t(message).tree();

            await view.model.handleMessageStanza(msg);
            await view.model.close();

            _converse.connection.IQ_stanzas = [];
            await mock.openAndEnterChatRoom(_converse, muc_jid , 'romeo');
            expect(view.model.messages.length).toBe(0);
            expect(view.querySelector('converse-chat-history')).toBe(null);
        }));

        it("is opened when an xmpp: URI is clicked inside another groupchat",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current');
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            if (!view.querySelectorAll('.chat-area').length) {
                view.renderChatArea();
            }
            expect(_converse.chatboxes.length).toEqual(2);
            const message = 'Please go to xmpp:coven@chat.shakespeare.lit?join',
                    nick = mock.chatroom_names[0],
                    msg = $msg({
                    'from': 'lounge@montague.lit/'+nick,
                    'id': u.getUniqueId(),
                    'to': 'romeo@montague.lit',
                    'type': 'groupchat'
                }).c('body').t(message).tree();

            await view.model.handleMessageStanza(msg);
            await u.waitUntil(()  => view.querySelector('.chat-msg__text a'));
            view.querySelector('.chat-msg__text a').click();
            await u.waitUntil(() => _converse.chatboxes.length === 3)
            expect(_converse.chatboxes.pluck('id').includes('coven@chat.shakespeare.lit')).toBe(true);
        }));

        it("shows a notification if it's not anonymous",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'coven@chat.shakespeare.lit';
            const nick = 'romeo';
            await _converse.api.rooms.open(muc_jid);
            await mock.getRoomFeatures(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, nick);

            const view = _converse.chatboxviews.get(muc_jid);
            /* <presence to="romeo@montague.lit/_converse.js-29092160"
             *           from="coven@chat.shakespeare.lit/some1">
             *      <x xmlns="http://jabber.org/protocol/muc#user">
             *          <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
             *          <status code="110"/>
             *          <status code="100"/>
             *      </x>
             *  </presence></body>
             */
            const presence = $pres({
                    to: 'romeo@montague.lit/orchard',
                    from: 'coven@chat.shakespeare.lit/some1'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'owner',
                    'jid': 'romeo@montague.lit/_converse.js-29092160',
                    'role': 'moderator'
                }).up()
                .c('status', {code: '110'}).up()
                .c('status', {code: '100'});
            _converse.connection._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
            await mock.returnMemberLists(_converse, muc_jid, [], ['member', 'admin', 'owner']);

            const num_info_msgs = await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-info').length);
            expect(num_info_msgs).toBe(1);
            expect(sizzle('div.chat-info', view).pop().textContent.trim()).toBe("This groupchat is not anonymous");

            const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
            expect(csntext.trim()).toEqual("some1 has entered the groupchat");
        }));


        it("shows join/leave messages when users enter or exit a groupchat",
                mock.initConverse(['chatBoxesFetched'], {'muc_fetch_members': false}, async function (_converse) {

            const muc_jid = 'coven@chat.shakespeare.lit';
            const nick = 'some1';
            const room_creation_promise = await _converse.api.rooms.open(muc_jid, {nick});
            await mock.getRoomFeatures(_converse, muc_jid);
            const sent_stanzas = _converse.connection.sent_stanzas;
            await u.waitUntil(() => sent_stanzas.filter(iq => sizzle('presence history', iq).length).pop());

            const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
            await _converse.api.waitUntil('chatRoomViewInitialized');

            /* We don't show join/leave messages for existing occupants. We
             * know about them because we receive their presences before we
             * receive our own.
             */
            let presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    from: 'coven@chat.shakespeare.lit/oldguy'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'oldguy@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));

            /* <presence to="romeo@montague.lit/_converse.js-29092160"
             *           from="coven@chat.shakespeare.lit/some1">
             *      <x xmlns="http://jabber.org/protocol/muc#user">
             *          <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
             *          <status code="110"/>
             *      </x>
             *  </presence></body>
             */
            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    from: 'coven@chat.shakespeare.lit/some1'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'owner',
                    'jid': 'romeo@montague.lit/_converse.js-29092160',
                    'role': 'moderator'
                }).up()
                .c('status', {code: '110'});
            _converse.connection._dataRecv(mock.createRequest(presence));

            const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications')?.textContent);
            expect(csntext.trim()).toEqual("some1 has entered the groupchat");

            await room_creation_promise;
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
            await view.model.messages.fetched;

            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    from: 'coven@chat.shakespeare.lit/newguy'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newguy@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1 and newguy have entered the groupchat");

            const msg = $msg({
                'from': 'coven@chat.shakespeare.lit/some1',
                'id': u.getUniqueId(),
                'to': 'romeo@montague.lit',
                'type': 'groupchat'
            }).c('body').t('hello world').tree();
            _converse.connection._dataRecv(mock.createRequest(msg));
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

            // Add another entrant, otherwise the above message will be
            // collapsed if "newguy" leaves immediately again
            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    from: 'coven@chat.shakespeare.lit/newgirl'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newgirl@montague.lit/_converse.js-213098781',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1, newguy and newgirl have entered the groupchat");

            // Don't show duplicate join messages
            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-290918392',
                    from: 'coven@chat.shakespeare.lit/newguy'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newguy@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));

            /*  <presence
             *      from='coven@chat.shakespeare.lit/thirdwitch'
             *      to='crone1@shakespeare.lit/desktop'
             *      type='unavailable'>
             *  <status>Disconnected: Replaced by new connection</status>
             *  <x xmlns='http://jabber.org/protocol/muc#user'>
             *      <item affiliation='member'
             *          jid='hag66@shakespeare.lit/pda'
             *          role='none'/>
             *  </x>
             *  </presence>
             */
            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    type: 'unavailable',
                    from: 'coven@chat.shakespeare.lit/newguy'
                })
                .c('status', 'Disconnected: Replaced by new connection').up()
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@montague.lit/_converse.js-290929789',
                        'role': 'none'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1 and newgirl have entered the groupchat\nnewguy has left the groupchat");

            // When the user immediately joins again, we collapse the
            // multiple join/leave messages.
            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    from: 'coven@chat.shakespeare.lit/newguy'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newguy@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1, newgirl and newguy have entered the groupchat");

            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    type: 'unavailable',
                    from: 'coven@chat.shakespeare.lit/newguy'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@montague.lit/_converse.js-290929789',
                        'role': 'none'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1 and newgirl have entered the groupchat\nnewguy has left the groupchat");

            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    from: 'coven@chat.shakespeare.lit/nomorenicks'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'nomorenicks@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1, newgirl and nomorenicks have entered the groupchat\nnewguy has left the groupchat");

            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-290918392',
                    type: 'unavailable',
                    from: 'coven@chat.shakespeare.lit/nomorenicks'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'nomorenicks@montague.lit/_converse.js-290929789',
                    'role': 'none'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1 and newgirl have entered the groupchat\nnewguy and nomorenicks have left the groupchat");

            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    from: 'coven@chat.shakespeare.lit/nomorenicks'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'nomorenicks@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1, newgirl and nomorenicks have entered the groupchat\nnewguy has left the groupchat");

            // Test a member joining and leaving
            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-290918392',
                    from: 'coven@chat.shakespeare.lit/insider'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'member',
                    'jid': 'insider@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));

            /*  <presence
             *      from='coven@chat.shakespeare.lit/thirdwitch'
             *      to='crone1@shakespeare.lit/desktop'
             *      type='unavailable'>
             *  <status>Disconnected: Replaced by new connection</status>
             *  <x xmlns='http://jabber.org/protocol/muc#user'>
             *      <item affiliation='member'
             *          jid='hag66@shakespeare.lit/pda'
             *          role='none'/>
             *  </x>
             *  </presence>
             */
            presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    type: 'unavailable',
                    from: 'coven@chat.shakespeare.lit/insider'
                })
                .c('status', 'Disconnected: Replaced by new connection').up()
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'member',
                        'jid': 'insider@montague.lit/_converse.js-290929789',
                        'role': 'none'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1, newgirl and nomorenicks have entered the groupchat\nnewguy and insider have left the groupchat");

            expect(view.model.occupants.length).toBe(5);
            expect(view.model.occupants.findWhere({'jid': 'insider@montague.lit'}).get('show')).toBe('offline');

            // New girl leaves
            presence = $pres({
                    'to': 'romeo@montague.lit/_converse.js-29092160',
                    'type': 'unavailable',
                    'from': 'coven@chat.shakespeare.lit/newgirl'
                })
                .c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newgirl@montague.lit/_converse.js-213098781',
                    'role': 'none'
                });

            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1 and nomorenicks have entered the groupchat\nnewguy, insider and newgirl have left the groupchat");
            expect(view.model.occupants.length).toBe(4);
        }));

        it("combines subsequent join/leave messages when users enter or exit a groupchat",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            await mock.openAndEnterChatRoom(_converse, 'coven@chat.shakespeare.lit', 'romeo')
            const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "romeo has entered the groupchat");

            let presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fabio">
                    <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "romeo and fabio have entered the groupchat");

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/Dele Olajide">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-39320524" role="participant"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "romeo, fabio and Dele Olajide have entered the groupchat");
            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/jcbrand">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="owner" jid="jc@opkode.com/converse.js-30645022" role="moderator"/>
                        <status code="110"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "romeo, fabio and others have entered the groupchat");

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/Dele Olajide">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-39320524" role="none"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, fabio and jcbrand have entered the groupchat\nDele Olajide has left the groupchat");

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/Dele Olajide">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-74567907" role="participant"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, fabio and others have entered the groupchat");

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fuvuv" xml:lang="en">
                    <c xmlns="http://jabber.org/protocol/caps" node="http://jabber.pix-art.de" ver="5tOurnuFnp2h50hKafeUyeN4Yl8=" hash="sha-1"/>
                    <x xmlns="vcard-temp:x:update"/>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fuvuv@blabber.im/Pix-Art Messenger.8zoB" role="participant"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, fabio and others have entered the groupchat");

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/fuvuv">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fuvuv@blabber.im/Pix-Art Messenger.8zoB" role="none"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, fabio and others have entered the groupchat\nfuvuv has left the groupchat");

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/fabio">
                    <status>Disconnected: Replaced by new connection</status>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="none"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, jcbrand and Dele Olajide have entered the groupchat\nfuvuv and fabio have left the groupchat");

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fabio">
                    <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                    <status>Ready for a new day</status>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, jcbrand and others have entered the groupchat\nfuvuv has left the groupchat");

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/fabio">
                    <status>Disconnected: closed</status>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="none"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, jcbrand and Dele Olajide have entered the groupchat\nfuvuv and fabio have left the groupchat");

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/Dele Olajide">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-74567907" role="none"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo and jcbrand have entered the groupchat\nfuvuv, fabio and Dele Olajide have left the groupchat");

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fabio">
                    <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, jcbrand and fabio have entered the groupchat\nfuvuv and Dele Olajide have left the groupchat");

            expect(1).toBe(1);
        }));

        it("doesn't show the disconnection messages when join_leave_events is not in muc_show_info_messages setting",
                mock.initConverse(['chatBoxesFetched'], {'muc_show_info_messages': []}, async function (_converse) {

            spyOn(_converse.ChatRoom.prototype, 'onOccupantAdded').and.callThrough();
            spyOn(_converse.ChatRoom.prototype, 'onOccupantRemoved').and.callThrough();
            await mock.openAndEnterChatRoom(_converse, 'coven@chat.shakespeare.lit', 'some1');
            const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
            let presence = $pres({
                    to: 'romeo@montague.lit/orchard',
                    from: 'coven@chat.shakespeare.lit/newguy'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'newguy@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() =>  view.model.onOccupantAdded.calls.count() === 2);
            expect(view.model.notifications.get('entered')).toBeFalsy();
            expect(view.querySelector('.chat-content__notifications').textContent.trim()).toBe('');
            await mock.sendMessage(view, 'hello world');

            presence = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/newguy">
                    <status>Gotta go!</status>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="newguy@montague.lit/_converse.js-290929789" role="none"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() =>  view.model.onOccupantRemoved.calls.count());
            expect(view.model.onOccupantRemoved.calls.count()).toBe(1);
            expect(view.model.notifications.get('entered')).toBeFalsy();
            await mock.sendMessage(view, 'hello world');
            expect(view.querySelector('.chat-content__notifications').textContent.trim()).toBe('');
        }));

        it("role-change messages that follow a MUC leave are left out",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            // See https://github.com/conversejs/converse.js/issues/1259

            await mock.openAndEnterChatRoom(_converse, 'conversations@conference.siacs.eu', 'romeo');

            const presence = $pres({
                    to: 'romeo@montague.lit/orchard',
                    from: 'conversations@conference.siacs.eu/Guus'
                }).c('x', {
                    'xmlns': Strophe.NS.MUC_USER
                }).c('item', {
                    'affiliation': 'none',
                    'jid': 'Guus@montague.lit/xxx',
                    'role': 'visitor'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));

            const view = _converse.chatboxviews.get('conversations@conference.siacs.eu');
            const msg = $msg({
                    'from': 'conversations@conference.siacs.eu/romeo',
                    'id': u.getUniqueId(),
                    'to': 'romeo@montague.lit',
                    'type': 'groupchat'
                }).c('body').t('Some message').tree();

            await view.model.handleMessageStanza(msg);
            await u.waitUntil(() => sizzle('.chat-msg:last .chat-msg__text', view).pop());

            let stanza = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="conversations@conference.siacs.eu/Guus">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" role="none"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));

            stanza = u.toStanza(
                `<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="conversations@conference.siacs.eu/Guus">
                    <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="ISg6+9AoK1/cwhbNEDviSvjdPzI=" hash="sha-1"/>
                    <x xmlns="vcard-temp:x:update">
                        <photo>bf987c486c51fbc05a6a4a9f20dd19b5efba3758</photo>
                    </x>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" role="visitor"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim()
                === "romeo and Guus have entered the groupchat");
            expect(1).toBe(1);
        }));

        it("can be configured if you're its owner", mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            let sent_IQ, IQ_id;
            const sendIQ = _converse.connection.sendIQ;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });

            await _converse.api.rooms.open('coven@chat.shakespeare.lit', {'nick': 'some1'});
            const view = await u.waitUntil(() => _converse.chatboxviews.get('coven@chat.shakespeare.lit'));
            await u.waitUntil(() => u.isVisible(view));
            // We pretend this is a new room, so no disco info is returned.
            const features_stanza = $iq({
                    from: 'coven@chat.shakespeare.lit',
                    'id': IQ_id,
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'error'
                }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            /* <presence to="romeo@montague.lit/_converse.js-29092160"
             *           from="coven@chat.shakespeare.lit/some1">
             *      <x xmlns="http://jabber.org/protocol/muc#user">
             *          <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
             *          <status code="110"/>
             *      </x>
             *  </presence></body>
             */
            const presence = $pres({
                    to: 'romeo@montague.lit/_converse.js-29092160',
                    from: 'coven@chat.shakespeare.lit/some1'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'owner',
                    'jid': 'romeo@montague.lit/_converse.js-29092160',
                    'role': 'moderator'
                }).up()
                .c('status', {code: '110'});
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.configure-chatroom-button') !== null);

            const own_occupant = view.model.getOwnOccupant();
            await u.waitUntil(() => own_occupant.get('affiliation') === 'owner');

            view.querySelector('.configure-chatroom-button').click();

            const sent_IQs = _converse.connection.IQ_stanzas;
            const sel = 'iq query[xmlns="http://jabber.org/protocol/muc#owner"]';
            const iq = await u.waitUntil(() => sent_IQs.filter(iq => sizzle(sel, iq).length).pop());

            /* Check that an IQ is sent out, asking for the
             * configuration form.
             * See: // https://xmpp.org/extensions/xep-0045.html#example-163
             *
             *  <iq from='crone1@shakespeare.lit/desktop'
             *      id='config1'
             *      to='coven@chat.shakespeare.lit'
             *      type='get'>
             *  <query xmlns='http://jabber.org/protocol/muc#owner'/>
             *  </iq>
             */
            expect(Strophe.serialize(iq)).toBe(
                `<iq id="${iq.getAttribute('id')}" to="coven@chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#owner"/>`+
                `</iq>`);

            /* Server responds with the configuration form.
             * See: // https://xmpp.org/extensions/xep-0045.html#example-165
             */
            const config_stanza = $iq({from: 'coven@chat.shakespeare.lit',
                'id': iq.getAttribute('id'),
                'to': 'romeo@montague.lit/desktop',
                'type': 'result'})
            .c('query', { 'xmlns': 'http://jabber.org/protocol/muc#owner'})
                .c('x', { 'xmlns': 'jabber:x:data', 'type': 'form'})
                    .c('title').t('Configuration for "coven" Room').up()
                    .c('instructions').t('Complete this form to modify the configuration of your room.').up()
                    .c('field', {'type': 'hidden', 'var': 'FORM_TYPE'})
                        .c('value').t('http://jabber.org/protocol/muc#roomconfig').up().up()
                    .c('field', {
                        'label': 'Natural-Language Room Name',
                        'type': 'text-single',
                        'var': 'muc#roomconfig_roomname'})
                        .c('value').t('A Dark Cave').up().up()
                    .c('field', {
                        'label': 'Short Description of Room',
                        'type': 'text-single',
                        'var': 'muc#roomconfig_roomdesc'})
                        .c('value').t('The place for all good witches!').up().up()
                    .c('field', {
                        'label': 'Enable Public Logging?',
                        'type': 'boolean',
                        'var': 'muc#roomconfig_enablelogging'})
                        .c('value').t(0).up().up()
                    .c('field', {
                        'label': 'Allow Occupants to Change Subject?',
                        'type': 'boolean',
                        'var': 'muc#roomconfig_changesubject'})
                        .c('value').t(0).up().up()
                    .c('field', {
                        'label': 'Allow Occupants to Invite Others?',
                        'type': 'boolean',
                        'var': 'muc#roomconfig_allowinvites'})
                        .c('value').t(0).up().up()
                    .c('field', {
                        'label': 'Who Can Send Private Messages?',
                        'type': 'list-single',
                        'var': 'muc#roomconfig_allowpm'})
                        .c('value').t('anyone').up()
                        .c('option', {'label': 'Anyone'})
                            .c('value').t('anyone').up().up()
                        .c('option', {'label': 'Anyone with Voice'})
                            .c('value').t('participants').up().up()
                        .c('option', {'label': 'Moderators Only'})
                            .c('value').t('moderators').up().up()
                        .c('option', {'label': 'Nobody'})
                            .c('value').t('none').up().up().up()
                    .c('field', {
                        'label': 'Roles for which Presence is Broadcasted',
                        'type': 'list-multi',
                        'var': 'muc#roomconfig_presencebroadcast'})
                        .c('value').t('moderator').up()
                        .c('value').t('participant').up()
                        .c('value').t('visitor').up()
                        .c('option', {'label': 'Moderator'})
                            .c('value').t('moderator').up().up()
                        .c('option', {'label': 'Participant'})
                            .c('value').t('participant').up().up()
                        .c('option', {'label': 'Visitor'})
                            .c('value').t('visitor').up().up().up()
                    .c('field', {
                        'label': 'Roles and Affiliations that May Retrieve Member List',
                        'type': 'list-multi',
                        'var': 'muc#roomconfig_getmemberlist'})
                        .c('value').t('moderator').up()
                        .c('value').t('participant').up()
                        .c('value').t('visitor').up()
                        .c('option', {'label': 'Moderator'})
                            .c('value').t('moderator').up().up()
                        .c('option', {'label': 'Participant'})
                            .c('value').t('participant').up().up()
                        .c('option', {'label': 'Visitor'})
                            .c('value').t('visitor').up().up().up()
                    .c('field', {
                        'label': 'Make Room Publicly Searchable?',
                        'type': 'boolean',
                        'var': 'muc#roomconfig_publicroom'})
                        .c('value').t(0).up().up()
                    .c('field', {
                        'label': 'Make Room Publicly Searchable?',
                        'type': 'boolean',
                        'var': 'muc#roomconfig_publicroom'})
                        .c('value').t(0).up().up()
                    .c('field', {
                        'label': 'Make Room Persistent?',
                        'type': 'boolean',
                        'var': 'muc#roomconfig_persistentroom'})
                        .c('value').t(0).up().up()
                    .c('field', {
                        'label': 'Make Room Moderated?',
                        'type': 'boolean',
                        'var': 'muc#roomconfig_moderatedroom'})
                        .c('value').t(0).up().up()
                    .c('field', {
                        'label': 'Make Room Members Only?',
                        'type': 'boolean',
                        'var': 'muc#roomconfig_membersonly'})
                        .c('value').t(0).up().up()
                    .c('field', {
                        'label': 'Password Required for Entry?',
                        'type': 'boolean',
                        'var': 'muc#roomconfig_passwordprotectedroom'})
                        .c('value').t(1).up().up()
                    .c('field', {'type': 'fixed'})
                        .c('value').t(
                            'If a password is required to enter this groupchat, you must specify the password below.'
                        ).up().up()
                    .c('field', {
                        'label': 'Password',
                        'type': 'text-private',
                        'var': 'muc#roomconfig_roomsecret'})
                        .c('value').t('cauldronburn');
            _converse.connection._dataRecv(mock.createRequest(config_stanza));

            const membersonly = await u.waitUntil(() => view.querySelector('input[name="muc#roomconfig_membersonly"]'));
            expect(membersonly.getAttribute('type')).toBe('checkbox');
            membersonly.checked = true;

            const moderated = view.querySelectorAll('input[name="muc#roomconfig_moderatedroom"]');
            expect(moderated.length).toBe(1);
            expect(moderated[0].getAttribute('type')).toBe('checkbox');
            moderated[0].checked = true;

            const password = view.querySelectorAll('input[name="muc#roomconfig_roomsecret"]');
            expect(password.length).toBe(1);
            expect(password[0].getAttribute('type')).toBe('password');

            const allowpm = view.querySelectorAll('select[name="muc#roomconfig_allowpm"]');
            expect(allowpm.length).toBe(1);
            allowpm[0].value = 'moderators';

            const presencebroadcast = view.querySelectorAll('select[name="muc#roomconfig_presencebroadcast"]');
            expect(presencebroadcast.length).toBe(1);
            presencebroadcast[0].value = ['moderator'];

            view.querySelector('.chatroom-form input[type="submit"]').click();

            expect(sent_IQ.querySelector('field[var="muc#roomconfig_membersonly"] value').textContent.trim()).toBe('1');
            expect(sent_IQ.querySelector('field[var="muc#roomconfig_moderatedroom"] value').textContent.trim()).toBe('1');
            expect(sent_IQ.querySelector('field[var="muc#roomconfig_allowpm"] value').textContent.trim()).toBe('moderators');
            expect(sent_IQ.querySelector('field[var="muc#roomconfig_presencebroadcast"] value').textContent.trim()).toBe('moderator');
        }));


        it("properly handles notification that a room has been destroyed",
                mock.initConverse([], {}, async function (_converse) {

            await mock.openChatRoomViaModal(_converse, 'problematic@muc.montague.lit', 'romeo')
            const presence = $pres().attrs({
                from:'problematic@muc.montague.lit',
                id:'n13mt3l',
                to:'romeo@montague.lit/pda',
                type:'error'})
            .c('error').attrs({'type':'cancel'})
                .c('gone').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'})
                    .t('xmpp:other-room@chat.jabberfr.org?join').up()
                .c('text').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'})
                    .t("We didn't like the name").nodeTree;

            const view = _converse.chatboxviews.get('problematic@muc.montague.lit');
            _converse.connection._dataRecv(mock.createRequest(presence));
            const msg = await u.waitUntil(() => view.querySelector('.chatroom-body .disconnect-msg'));
            expect(msg.textContent.trim()).toBe('This groupchat no longer exists');
            expect(view.querySelector('.chatroom-body .destroyed-reason').textContent.trim())
                .toBe(`The following reason was given: "We didn't like the name"`);
            expect(view.querySelector('.chatroom-body .moved-label').textContent.trim())
                .toBe('The conversation has moved to a new address. Click the link below to enter.');
            expect(view.querySelector('.chatroom-body .moved-link').textContent.trim())
                .toBe(`other-room@chat.jabberfr.org`);
        }));

        it("will use the user's reserved nickname, if it exists",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const IQ_stanzas = _converse.connection.IQ_stanzas;
            const muc_jid = 'lounge@montague.lit';
            await mock.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');

            let stanza = await u.waitUntil(() => IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop()
            );
            // We pretend this is a new room, so no disco info is returned.
            const features_stanza = $iq({
                    from: 'lounge@montague.lit',
                    'id': stanza.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'error'
                }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            _converse.connection._dataRecv(mock.createRequest(features_stanza));


            /* <iq from='hag66@shakespeare.lit/pda'
             *     id='getnick1'
             *     to='coven@chat.shakespeare.lit'
             *     type='get'>
             * <query xmlns='http://jabber.org/protocol/disco#info'
             *         node='x-roomuser-item'/>
             * </iq>
             */
            const iq = await u.waitUntil(() => IQ_stanzas.filter(
                    s => sizzle(`iq[to="${muc_jid}"] query[node="x-roomuser-item"]`, s).length
                ).pop());

            expect(Strophe.serialize(iq)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="${iq.getAttribute('id')}" to="lounge@montague.lit" `+
                    `type="get" xmlns="jabber:client">`+
                        `<query node="x-roomuser-item" xmlns="http://jabber.org/protocol/disco#info"/></iq>`);

            /* <iq from='coven@chat.shakespeare.lit'
             *     id='getnick1'
             *     to='hag66@shakespeare.lit/pda'
             *     type='result'>
             *     <query xmlns='http://jabber.org/protocol/disco#info'
             *             node='x-roomuser-item'>
             *         <identity
             *             category='conference'
             *             name='thirdwitch'
             *             type='text'/>
             *     </query>
             * </iq>
             */
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            stanza = $iq({
                'type': 'result',
                'id': iq.getAttribute('id'),
                'from': view.model.get('jid'),
                'to': _converse.connection.jid
            }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info', 'node': 'x-roomuser-item'})
            .c('identity', {'category': 'conference', 'name': 'thirdwitch', 'type': 'text'});
            _converse.connection._dataRecv(mock.createRequest(stanza));

            // The user has just entered the groupchat (because join was called)
            // and receives their own presence from the server.
            // See example 24:
            // https://xmpp.org/extensions/xep-0045.html#enter-pres
            const presence = $pres({
                    to:'romeo@montague.lit/orchard',
                    from:'lounge@montague.lit/thirdwitch',
                    id:'DC352437-C019-40EC-B590-AF29E879AF97'
            }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'member',
                    jid: 'romeo@montague.lit/orchard',
                    role: 'participant'
                }).up()
                .c('status').attrs({code:'110'}).up()
                .c('status').attrs({code:'210'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
            await mock.returnMemberLists(_converse, muc_jid, [], ['member', 'admin', 'owner']);
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-info').length);
            const info_text = sizzle('.chat-content .chat-info:first', view).pop().textContent.trim();
            expect(info_text).toBe('Your nickname has been automatically set to thirdwitch');
        }));

        it("allows the user to invite their roster contacts to enter the groupchat",
                mock.initConverse(['chatBoxesFetched'], {'view_mode': 'fullscreen'}, async function (_converse) {

            // We need roster contacts, so that we have someone to invite
            await mock.waitForRoster(_converse, 'current');
            const features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                'muc_passwordprotected',
                'muc_hidden',
                'muc_temporary',
                'muc_membersonly',
                'muc_unmoderated',
                'muc_anonymous'
            ]
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo', features);
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            expect(view.model.getOwnAffiliation()).toBe('owner');
            expect(view.model.features.get('open')).toBe(false);
            await u.waitUntil(() => view.querySelector('.open-invite-modal'));

            // Members can't invite if the room isn't open
            view.model.getOwnOccupant().set('affiliation', 'member');

            await u.waitUntil(() => view.querySelector('.open-invite-modal') === null);

            view.model.features.set('open', 'true');
            await u.waitUntil(() => view.querySelector('.open-invite-modal'));

            view.querySelector('.open-invite-modal').click();
            const modal = _converse.api.modal.get('muc-invite-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000)

            expect(modal.el.querySelectorAll('#invitee_jids').length).toBe(1);
            expect(modal.el.querySelectorAll('textarea').length).toBe(1);

            spyOn(view.model, 'directInvite').and.callThrough();

            const input = modal.el.querySelector('#invitee_jids');
            input.value = "Balt";
            modal.el.querySelector('button[type="submit"]').click();

            await u.waitUntil(() => modal.el.querySelector('.error'));

            const error = modal.el.querySelector('.error');
            expect(error.textContent).toBe('Please enter a valid XMPP address');

            let evt = new Event('input');
            input.dispatchEvent(evt);

            let sent_stanza;
            spyOn(_converse.connection, 'send').and.callFake(stanza => (sent_stanza = stanza));
            const hint = await u.waitUntil(() => modal.el.querySelector('.suggestion-box__results li'));
            expect(input.value).toBe('Balt');
            expect(hint.textContent.trim()).toBe('Balthasar');

            evt = new Event('mousedown', {'bubbles': true});
            evt.button = 0;
            hint.dispatchEvent(evt);

            const textarea = modal.el.querySelector('textarea');
            textarea.value = "Please join!";
            modal.el.querySelector('button[type="submit"]').click();

            expect(view.model.directInvite).toHaveBeenCalled();
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<message from="romeo@montague.lit/orchard" `+
                        `id="${sent_stanza.getAttribute("id")}" `+
                        `to="balthasar@montague.lit" `+
                        `xmlns="jabber:client">`+
                    `<x jid="lounge@montague.lit" reason="Please join!" xmlns="jabber:x:conference"/>`+
                `</message>`
            );
        }));

        it("can be joined automatically, based upon a received invite",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current'); // We need roster contacts, who can invite us
            const name = mock.cur_names[0];
            const from_jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await u.waitUntil(() => _converse.roster.get(from_jid).vcard.get('fullname'));

            spyOn(window, 'confirm').and.callFake(() => true);
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            await view.close(); // Hack, otherwise we have to mock stanzas.

            const muc_jid = 'lounge@montague.lit';
            const reason = "Please join this groupchat";

            expect(_converse.chatboxes.models.length).toBe(1);
            expect(_converse.chatboxes.models[0].id).toBe("controlbox");

            const stanza = u.toStanza(`
                <message xmlns="jabber:client" to="${_converse.bare_jid}" from="${from_jid}" id="9bceb415-f34b-4fa4-80d5-c0d076a24231">
                   <x xmlns="jabber:x:conference" jid="${muc_jid}" reason="${reason}"/>
                </message>`);
            await _converse.onDirectMUCInvitation(stanza);

            expect(window.confirm).toHaveBeenCalledWith(
                name + ' has invited you to join a groupchat: '+ muc_jid +
                ', and left the following reason: "'+reason+'"');
            expect(_converse.chatboxes.models.length).toBe(2);
            expect(_converse.chatboxes.models[0].id).toBe('controlbox');
            expect(_converse.chatboxes.models[1].id).toBe(muc_jid);
        }));

        it("shows received groupchat messages",
                mock.initConverse([], {}, async function (_converse) {

            const text = 'This is a received message';
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            spyOn(_converse.api, "trigger").and.callThrough();
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            const nick = mock.chatroom_names[0];
            view.model.occupants.create({
                'nick': nick,
                'muc_jid': `${view.model.get('jid')}/${nick}`
            });

            const message = $msg({
                from: 'lounge@montague.lit/'+nick,
                id: '1',
                to: 'romeo@montague.lit',
                type: 'groupchat'
            }).c('body').t(text);
            await view.model.handleMessageStanza(message.nodeTree);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.querySelector('.chat-msg__text').textContent.trim()).toBe(text);
            expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
        }));

        it("shows sent groupchat messages", mock.initConverse([], {}, async function (_converse) {
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            spyOn(_converse.api, "trigger").and.callThrough();
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            const text = 'This is a sent message';
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = text;
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

            expect(_converse.api.trigger).toHaveBeenCalledWith('sendMessage', jasmine.any(Object));
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);

            // Let's check that if we receive the same message again, it's
            // not shown.
            const stanza = u.toStanza(`
                <message xmlns="jabber:client"
                        from="lounge@montague.lit/romeo"
                        to="${_converse.connection.jid}"
                        type="groupchat">
                    <body>${text}</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                            id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                            by="lounge@montague.lit"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${view.model.messages.at(0).get('origin_id')}"/>
                </message>`);
            await view.model.handleMessageStanza(stanza);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(sizzle('.chat-msg__text:last').pop().textContent.trim()).toBe(text);
            expect(view.model.messages.length).toBe(1);
            // We don't emit an event if it's our own message
            expect(_converse.api.trigger.calls.count(), 1);
        }));

        it("will cause the chat area to be scrolled down only if it was at the bottom already",
                mock.initConverse([], {}, async function (_converse) {

            const message = 'This message is received while the chat area is scrolled up';
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            // Create enough messages so that there's a scrollbar.
            const promises = [];
            for (let i=0; i<20; i++) {
                promises.push(
                    view.model.handleMessageStanza(
                        $msg({
                            from: 'lounge@montague.lit/someone',
                            to: 'romeo@montague.lit.com',
                            type: 'groupchat',
                            id: u.getUniqueId(),
                        }).c('body').t('Message: '+i).tree())
                );
            }
            await Promise.all(promises);
            const promise = u.getOpenPromise();

            // Give enough time for `markScrolled` to have been called
            setTimeout(async () => {
                const content = view.querySelector('.chat-content');
                content.scrollTop = 0;
                await view.model.handleMessageStanza(
                    $msg({
                        from: 'lounge@montague.lit/someone',
                        to: 'romeo@montague.lit.com',
                        type: 'groupchat',
                        id: u.getUniqueId(),
                    }).c('body').t(message).tree());
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 21);
                // Now check that the message appears inside the chatbox in the DOM
                const msg_txt = sizzle('.chat-msg:last .chat-msg__text', content).pop().textContent;
                expect(msg_txt).toEqual(message);
                expect(content.scrollTop).toBe(0);
                promise.resolve();
            }, 500);

            return promise;
        }));


        it("informs users if the room configuration has changed",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'coven@chat.shakespeare.lit';
            await mock.openAndEnterChatRoom(_converse, 'coven@chat.shakespeare.lit', 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);

            const stanza = u.toStanza(`
                <message from='${muc_jid}'
                        id='80349046-F26A-44F3-A7A6-54825064DD9E'
                        to='${_converse.jid}'
                        type='groupchat'>
                <x xmlns='http://jabber.org/protocol/muc#user'>
                    <status code='170'/>
                </x>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-info').length);
            const info_messages = view.querySelectorAll('.chat-content .chat-info');
            expect(info_messages[0].textContent.trim()).toBe('Groupchat logging is now enabled');
        }));


        it("informs users if their nicknames have been changed.",
                mock.initConverse([], {}, async function (_converse) {

            /* The service then sends two presence stanzas to the full JID
             * of each occupant (including the occupant who is changing his
             * or her room nickname), one of type "unavailable" for the old
             * nickname and one indicating availability for the new
             * nickname.
             *
             * See: https://xmpp.org/extensions/xep-0045.html#changenick
             *
             *  <presence
             *      from='coven@montague.lit/thirdwitch'
             *      id='DC352437-C019-40EC-B590-AF29E879AF98'
             *      to='hag66@shakespeare.lit/pda'
             *      type='unavailable'>
             *  <x xmlns='http://jabber.org/protocol/muc#user'>
             *      <item affiliation='member'
             *          jid='hag66@shakespeare.lit/pda'
             *          nick='oldhag'
             *          role='participant'/>
             *      <status code='303'/>
             *      <status code='110'/>
             *  </x>
             *  </presence>
             *
             *  <presence
             *      from='coven@montague.lit/oldhag'
             *      id='5B4F27A4-25ED-43F7-A699-382C6B4AFC67'
             *      to='hag66@shakespeare.lit/pda'>
             *  <x xmlns='http://jabber.org/protocol/muc#user'>
             *      <item affiliation='member'
             *          jid='hag66@shakespeare.lit/pda'
             *          role='participant'/>
             *      <status code='110'/>
             *  </x>
             *  </presence>
             */
            const __ = _converse.__;
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'oldnick');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);

            await u.waitUntil(() => view.querySelectorAll('li .occupant-nick').length, 500);
            let occupants = view.querySelector('.occupant-list');
            expect(occupants.childElementCount).toBe(1);
            expect(occupants.firstElementChild.querySelector('.occupant-nick').textContent.trim()).toBe("oldnick");

            const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
            expect(csntext.trim()).toEqual("oldnick has entered the groupchat");

            let presence = $pres().attrs({
                    from:'lounge@montague.lit/oldnick',
                    id:'DC352437-C019-40EC-B590-AF29E879AF98',
                    to:'romeo@montague.lit/pda',
                    type:'unavailable'
                })
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'owner',
                    jid: 'romeo@montague.lit/pda',
                    nick: 'newnick',
                    role: 'moderator'
                }).up()
                .c('status').attrs({code:'303'}).up()
                .c('status').attrs({code:'110'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelectorAll('.chat-info').length);

            expect(sizzle('div.chat-info:last').pop().textContent.trim()).toBe(
                __(_converse.muc.new_nickname_messages["303"], "newnick")
            );
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);

            occupants = view.querySelector('.occupant-list');
            expect(occupants.childElementCount).toBe(1);

            presence = $pres().attrs({
                    from:'lounge@montague.lit/newnick',
                    id:'5B4F27A4-25ED-43F7-A699-382C6B4AFC67',
                    to:'romeo@montague.lit/pda'
                })
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'owner',
                    jid: 'romeo@montague.lit/pda',
                    role: 'moderator'
                }).up()
                .c('status').attrs({code:'110'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);
            expect(view.querySelectorAll('div.chat-info').length).toBe(1);
            expect(sizzle('div.chat-info', view)[0].textContent.trim()).toBe(
                __(_converse.muc.new_nickname_messages["303"], "newnick")
            );
            occupants = view.querySelector('.occupant-list');
            expect(occupants.childElementCount).toBe(1);
            expect(sizzle('.occupant-nick:first', occupants).pop().textContent.trim()).toBe("newnick");
        }));

        it("queries for the groupchat information before attempting to join the user",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const nick = "some1";
            const IQ_stanzas = _converse.connection.IQ_stanzas;
            const muc_jid = 'coven@chat.shakespeare.lit';

            await _converse.api.rooms.open(muc_jid, { nick });
            const stanza = await u.waitUntil(() => IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            // Check that the groupchat queried for the feautures.
            expect(Strophe.serialize(stanza)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="${stanza.getAttribute("id")}" to="${muc_jid}" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/disco#info"/>`+
                `</iq>`);

            /* <iq from='coven@chat.shakespeare.lit'
             *      id='ik3vs715'
             *      to='hag66@shakespeare.lit/pda'
             *      type='result'>
             *  <query xmlns='http://jabber.org/protocol/disco#info'>
             *      <identity
             *          category='conference'
             *          name='A Dark Cave'
             *          type='text'/>
             *      <feature var='http://jabber.org/protocol/muc'/>
             *      <feature var='muc_passwordprotected'/>
             *      <feature var='muc_hidden'/>
             *      <feature var='muc_temporary'/>
             *      <feature var='muc_open'/>
             *      <feature var='muc_unmoderated'/>
             *      <feature var='muc_nonanonymous'/>
             *  </query>
             *  </iq>
             */
            const features_stanza = $iq({
                    'from': muc_jid,
                    'id': stanza.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'result'
                })
                .c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {
                        'category': 'conference',
                        'name': 'A Dark Cave',
                        'type': 'text'
                    }).up()
                    .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                    .c('feature', {'var': 'muc_passwordprotected'}).up()
                    .c('feature', {'var': 'muc_hidden'}).up()
                    .c('feature', {'var': 'muc_temporary'}).up()
                    .c('feature', {'var': 'muc_open'}).up()
                    .c('feature', {'var': 'muc_unmoderated'}).up()
                    .c('feature', {'var': 'muc_nonanonymous'});
            _converse.connection._dataRecv(mock.createRequest(features_stanza));
            let view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');

            const sent_stanzas = _converse.connection.sent_stanzas;
            await u.waitUntil(() => sent_stanzas.filter(s => s.matches(`presence[to="${muc_jid}/${nick}"]`)).pop());
            view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
            expect(view.model.features.get('fetched')).toBeTruthy();
            expect(view.model.features.get('passwordprotected')).toBe(true);
            expect(view.model.features.get('hidden')).toBe(true);
            expect(view.model.features.get('temporary')).toBe(true);
            expect(view.model.features.get('open')).toBe(true);
            expect(view.model.features.get('unmoderated')).toBe(true);
            expect(view.model.features.get('nonanonymous')).toBe(true);
        }));

        it("updates the shown features when the groupchat configuration has changed",
                mock.initConverse([], {'view_mode': 'fullscreen'}, async function (_converse) {

            let features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                'muc_passwordprotected',
                'muc_publicroom',
                'muc_temporary',
                'muc_open',
                'muc_unmoderated',
                'muc_nonanonymous'
            ];
            const muc_jid = 'room@conference.example.org';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);

            const info_el = view.querySelector(".show-muc-details-modal");
            info_el.click();
            let modal = _converse.api.modal.get('muc-details-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000);

            let features_list = modal.el.querySelector('.features-list');
            let features_shown = features_list.textContent.split('\n').map(s => s.trim()).filter(s => s);

            expect(features_shown.join(' ')).toBe(
                'Password protected - This groupchat requires a password before entry '+
                'Open - Anyone can join this groupchat '+
                'Temporary - This groupchat will disappear once the last person leaves '+
                'Not anonymous - All other groupchat participants can see your XMPP address '+
                'Not moderated - Participants entering this groupchat can write right away');
            expect(view.model.features.get('hidden')).toBe(false);
            expect(view.model.features.get('mam_enabled')).toBe(false);
            expect(view.model.features.get('membersonly')).toBe(false);
            expect(view.model.features.get('moderated')).toBe(false);
            expect(view.model.features.get('nonanonymous')).toBe(true);
            expect(view.model.features.get('open')).toBe(true);
            expect(view.model.features.get('passwordprotected')).toBe(true);
            expect(view.model.features.get('persistent')).toBe(false);
            expect(view.model.features.get('publicroom')).toBe(true);
            expect(view.model.features.get('semianonymous')).toBe(false);
            expect(view.model.features.get('temporary')).toBe(true);
            expect(view.model.features.get('unmoderated')).toBe(true);
            expect(view.model.features.get('unsecured')).toBe(false);
            await u.waitUntil(() => view.querySelector('.chatbox-title__text').textContent.trim() === 'Room');

            modal.el.querySelector('.close').click();
            view.querySelector('.configure-chatroom-button').click();

            const IQs = _converse.connection.IQ_stanzas;
            const s = `iq[to="${muc_jid}"] query[xmlns="${Strophe.NS.MUC_OWNER}"]`;
            let iq = await u.waitUntil(() => IQs.filter(iq => iq.querySelector(s)).pop());

            const response_el = u.toStanza(
               `<iq xmlns="jabber:client"
                     type="result"
                     to="romeo@montague.lit/pda"
                     from="room@conference.example.org" id="${iq.getAttribute('id')}">
                 <query xmlns="http://jabber.org/protocol/muc#owner">
                     <x xmlns="jabber:x:data" type="form">
                     <title>Configuration for room@conference.example.org</title>
                     <instructions>Complete and submit this form to configure the room.</instructions>
                     <field var="FORM_TYPE" type="hidden">
                        <value>http://jabber.org/protocol/muc#roomconfig</value>
                    </field>
                    <field type="fixed">
                        <value>Room information</value>
                    </field>
                    <field var="muc#roomconfig_roomname" type="text-single" label="Title">
                        <value>Room</value>
                    </field>
                    <field var="muc#roomconfig_roomdesc" type="text-single" label="Description">
                        <desc>A brief description of the room</desc>
                        <value>This room is used in tests</value>
                    </field>
                    <field var="muc#roomconfig_lang" type="text-single" label="Language tag for room (e.g. 'en', 'de', 'fr' etc.)">
                        <desc>Indicate the primary language spoken in this room</desc>
                        <value>en</value>
                    </field>
                    <field var="muc#roomconfig_persistentroom" type="boolean" label="Persistent (room should remain even when it is empty)">
                        <desc>Rooms are automatically deleted when they are empty, unless this option is enabled</desc>
                        <value>1</value>
                    </field>
                    <field var="muc#roomconfig_publicroom" type="boolean" label="Include room information in public lists">
                        <desc>Enable this to allow people to find the room</desc>
                        <value>1</value>
                    </field>
                    <field type="fixed"><value>Access to the room</value></field>
                    <field var="muc#roomconfig_roomsecret" type="text-private" label="Password"><value/></field>
                    <field var="muc#roomconfig_membersonly" type="boolean" label="Only allow members to join">
                        <desc>Enable this to only allow access for room owners, admins and members</desc>
                    </field>
                    <field var="{http://prosody.im/protocol/muc}roomconfig_allowmemberinvites" type="boolean" label="Allow members to invite new members"/>
                        <field type="fixed"><value>Permissions in the room</value>
                    </field>
                    <field var="muc#roomconfig_changesubject" type="boolean" label="Allow anyone to set the room's subject">
                        <desc>Choose whether anyone, or only moderators, may set the room's subject</desc>
                    </field>
                    <field var="muc#roomconfig_moderatedroom" type="boolean" label="Moderated (require permission to speak)">
                        <desc>In moderated rooms occupants must be given permission to speak by a room moderator</desc>
                    </field>
                    <field var="muc#roomconfig_whois" type="list-single" label="Addresses (JIDs) of room occupants may be viewed by:">
                        <option label="Moderators only"><value>moderators</value></option>
                        <option label="Anyone"><value>anyone</value></option>
                        <value>anyone</value>
                    </field>
                    <field type="fixed"><value>Other options</value></field>
                    <field var="muc#roomconfig_historylength" type="text-single" label="Maximum number of history messages returned by room">
                        <desc>Specify the maximum number of previous messages that should be sent to users when they join the room</desc>
                        <value>50</value>
                    </field>
                    <field var="muc#roomconfig_defaulthistorymessages" type="text-single" label="Default number of history messages returned by room">
                        <desc>Specify the number of previous messages sent to new users when they join the room</desc>
                        <value>20</value>
                    </field>
                 </x>
                 </query>
                 </iq>`);
            _converse.connection._dataRecv(mock.createRequest(response_el));
            await u.waitUntil(() => document.querySelector('.chatroom-form input'));
            expect(view.querySelector('.chatroom-form legend').textContent.trim()).toBe("Configuration for room@conference.example.org");
            sizzle('[name="muc#roomconfig_membersonly"]', view).pop().click();
            sizzle('[name="muc#roomconfig_roomname"]', view).pop().value = "New room name"
            view.querySelector('.chatroom-form input[type="submit"]').click();

            iq = await u.waitUntil(() => IQs.filter(iq => u.matchesSelector(iq, `iq[to="${muc_jid}"][type="set"]`)).pop());
            const result = $iq({
                "xmlns": "jabber:client",
                "type": "result",
                "to": "romeo@montague.lit/orchard",
                "from": "lounge@muc.montague.lit",
                "id": iq.getAttribute('id')
            });

            IQs.length = 0; // Empty the array
            _converse.connection._dataRecv(mock.createRequest(result));

            iq = await u.waitUntil(() => IQs.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            const features_stanza = $iq({
                'from': muc_jid,
                'id': iq.getAttribute('id'),
                'to': 'romeo@montague.lit/desktop',
                'type': 'result'
            }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                .c('identity', {
                    'category': 'conference',
                    'name': 'New room name',
                    'type': 'text'
                }).up();
            features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                'muc_passwordprotected',
                'muc_hidden',
                'muc_temporary',
                'muc_membersonly',
                'muc_unmoderated',
                'muc_nonanonymous'
            ];
            features.forEach(f => features_stanza.c('feature', {'var': f}).up());
            features_stanza.c('x', { 'xmlns':'jabber:x:data', 'type':'result'})
                .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                    .c('value').t('http://jabber.org/protocol/muc#roominfo').up().up()
                .c('field', {'type':'text-single', 'var':'muc#roominfo_description', 'label':'Description'})
                    .c('value').t('This is the description').up().up()
                .c('field', {'type':'text-single', 'var':'muc#roominfo_occupants', 'label':'Number of occupants'})
                    .c('value').t(0);

            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            await u.waitUntil(() => new Promise(success => view.model.features.on('change', success)));

            info_el.click();
            modal = _converse.api.modal.get('muc-details-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000);

            features_list = modal.el.querySelector('.features-list');
            features_shown = features_list.textContent.split('\n').map(s => s.trim()).filter(s => s);
            expect(features_shown.join(' ')).toBe(
                'Password protected - This groupchat requires a password before entry '+
                'Hidden - This groupchat is not publicly searchable '+
                'Members only - This groupchat is restricted to members only '+
                'Temporary - This groupchat will disappear once the last person leaves '+
                'Not anonymous - All other groupchat participants can see your XMPP address '+
                'Not moderated - Participants entering this groupchat can write right away');
            expect(view.model.features.get('hidden')).toBe(true);
            expect(view.model.features.get('mam_enabled')).toBe(false);
            expect(view.model.features.get('membersonly')).toBe(true);
            expect(view.model.features.get('moderated')).toBe(false);
            expect(view.model.features.get('nonanonymous')).toBe(true);
            expect(view.model.features.get('open')).toBe(false);
            expect(view.model.features.get('passwordprotected')).toBe(true);
            expect(view.model.features.get('persistent')).toBe(false);
            expect(view.model.features.get('publicroom')).toBe(false);
            expect(view.model.features.get('semianonymous')).toBe(false);
            expect(view.model.features.get('temporary')).toBe(true);
            expect(view.model.features.get('unmoderated')).toBe(true);
            expect(view.model.features.get('unsecured')).toBe(false);
            await u.waitUntil(() => view.querySelector('.chatbox-title__text')?.textContent.trim() === 'New room name');
        }));

        it("indicates when a room is no longer anonymous",
                mock.initConverse([], {}, async function (_converse) {

            let IQ_id;
            const sendIQ = _converse.connection.sendIQ;

            await mock.openAndEnterChatRoom(_converse, 'coven@chat.shakespeare.lit', 'some1');
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });

            // We pretend this is a new room, so no disco info is returned.
            const features_stanza = $iq({
                    from: 'coven@chat.shakespeare.lit',
                    'id': IQ_id,
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'error'
                }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
            /* <message xmlns="jabber:client"
            *              type="groupchat"
            *              to="romeo@montague.lit/_converse.js-27854181"
            *              from="coven@chat.shakespeare.lit">
            *      <x xmlns="http://jabber.org/protocol/muc#user">
            *          <status code="104"/>
            *          <status code="172"/>
            *      </x>
            *  </message>
            */
            const message = $msg({
                    type:'groupchat',
                    to: 'romeo@montague.lit/_converse.js-27854181',
                    from: 'coven@chat.shakespeare.lit'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('status', {code: '104'}).up()
                .c('status', {code: '172'});
            _converse.connection._dataRecv(mock.createRequest(message));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-info').length);
            const chat_body = view.querySelector('.chatroom-body');
            expect(sizzle('.message:last', chat_body).pop().textContent.trim())
                .toBe('This groupchat is now no longer anonymous');
        }));

        it("informs users if they have been kicked out of the groupchat",
                mock.initConverse([], {}, async function (_converse) {

            /*  <presence
             *      from='harfleur@chat.shakespeare.lit/pistol'
             *      to='pistol@shakespeare.lit/harfleur'
             *      type='unavailable'>
             *  <x xmlns='http://jabber.org/protocol/muc#user'>
             *      <item affiliation='none' role='none'>
             *          <actor nick='Fluellen'/>
             *          <reason>Avaunt, you cullion!</reason>
             *      </item>
             *      <status code='110'/>
             *      <status code='307'/>
             *  </x>
             *  </presence>
             */
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);

            const presence = $pres().attrs({
                    from:'lounge@montague.lit/romeo',
                    to:'romeo@montague.lit/pda',
                    type:'unavailable'
                })
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'none',
                    jid: 'romeo@montague.lit/pda',
                    role: 'none'
                })
                .c('actor').attrs({nick: 'Fluellen'}).up()
                .c('reason').t('Avaunt, you cullion!').up()
                .up()
                .c('status').attrs({code:'110'}).up()
                .c('status').attrs({code:'307'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => !u.isVisible(view.querySelector('.chat-area')));
            expect(u.isVisible(view.querySelector('.occupants'))).toBeFalsy();
            const chat_body = view.querySelector('.chatroom-body');
            expect(chat_body.querySelectorAll('.disconnect-msg').length).toBe(3);
            expect(chat_body.querySelector('.disconnect-msg:first-child').textContent.trim()).toBe(
                'You have been kicked from this groupchat');
            expect(chat_body.querySelector('.disconnect-msg:nth-child(2)').textContent.trim()).toBe(
                'This action was done by Fluellen.');
            expect(chat_body.querySelector('.disconnect-msg:nth-child(3)').textContent.trim()).toBe(
                'The reason given is: "Avaunt, you cullion!".');

            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.DISCONNECTED);
        }));

        it("informs users if they have exited the groupchat due to a technical reason",
                mock.initConverse([], {}, async function (_converse) {

            /*  <presence
             *      from='harfleur@chat.shakespeare.lit/pistol'
             *      to='pistol@shakespeare.lit/harfleur'
             *      type='unavailable'>
             *  <x xmlns='http://jabber.org/protocol/muc#user'>
             *      <item affiliation='none' role='none'>
             *          <actor nick='Fluellen'/>
             *          <reason>Avaunt, you cullion!</reason>
             *      </item>
             *      <status code='110'/>
             *      <status code='307'/>
             *  </x>
             *  </presence>
             */
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const presence = $pres().attrs({
                    from:'lounge@montague.lit/romeo',
                    to:'romeo@montague.lit/pda',
                    type:'unavailable'
                })
                .c('x').attrs({xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item').attrs({
                    affiliation: 'none',
                    jid: 'romeo@montague.lit/pda',
                    role: 'none'
                })
                .c('reason').t('Flux capacitor overload!').up()
                .up()
                .c('status').attrs({code:'110'}).up()
                .c('status').attrs({code:'333'}).up()
                .c('status').attrs({code:'307'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));

            const view = _converse.chatboxviews.get('lounge@montague.lit');
            await u.waitUntil(() => !u.isVisible(view.querySelector('.chat-area')));
            expect(u.isVisible(view.querySelector('.occupants'))).toBeFalsy();
            const chat_body = view.querySelector('.chatroom-body');
            expect(chat_body.querySelectorAll('.disconnect-msg').length).toBe(2);
            expect(chat_body.querySelector('.disconnect-msg:first-child').textContent.trim()).toBe(
                'You have exited this groupchat due to a technical problem');
            expect(chat_body.querySelector('.disconnect-msg:nth-child(2)').textContent.trim()).toBe(
                'The reason given is: "Flux capacitor overload!".');
        }));


        it("can be saved to, and retrieved from, browserStorage",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            await mock.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');
            // We instantiate a new ChatBoxes collection, which by default
            // will be empty.
            await mock.openControlBox(_converse);
            const newchatboxes = new _converse.ChatBoxes();
            expect(newchatboxes.length).toEqual(0);
            // The chatboxes will then be fetched from browserStorage inside the
            // onConnected method
            newchatboxes.onConnected();
            await new Promise(resolve => _converse.api.listen.once('chatBoxesFetched', resolve));

            expect(newchatboxes.length).toEqual(2);
            // Check that the chatrooms retrieved from browserStorage
            // have the same attributes values as the original ones.
            const attrs = ['id', 'box_id', 'visible'];
            let new_attrs, old_attrs;
            for (let i=0; i<attrs.length; i++) {
                new_attrs = newchatboxes.models.map(m => m.attributes[attrs[i]]);
                old_attrs = _converse.chatboxes.models.map(m => m.attributes[attrs[i]]);
                expect(new_attrs.sort()).toEqual(old_attrs.sort());
            }
        }));

        it("can be closed again by clicking a DOM element with class 'close-chatbox-button'",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const model = await mock.openChatRoom(_converse, 'lounge', 'montague.lit', 'romeo');
            spyOn(model, 'close').and.callThrough();
            spyOn(_converse.api, "trigger").and.callThrough();
            spyOn(model, 'leave');
            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            const view = await u.waitUntil(() => _converse.chatboxviews.get('lounge@montague.lit'));
            const button = await u.waitUntil(() => view.querySelector('.close-chatbox-button'));
            button.click();
            await u.waitUntil(() => model.close.calls.count());
            expect(model.leave).toHaveBeenCalled();
            await u.waitUntil(() => _converse.api.trigger.calls.count());
            expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));
        }));

        it("informs users of role and affiliation changes",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            let presence = $pres({
                    'from': 'lounge@montague.lit/annoyingGuy',
                    'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo and annoyingGuy have entered the groupchat");

            presence = $pres({
                    'from': 'lounge@montague.lit/annoyingGuy',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'visitor'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo has entered the groupchat\nannoyingGuy has been muted");

            presence = $pres({
                    'from': 'lounge@montague.lit/annoyingGuy',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo has entered the groupchat\nannoyingGuy has been given a voice");

            // Check that we don't see an info message concerning the role,
            // if the affiliation has changed.
            presence = $pres({
                    'from': 'lounge@montague.lit/annoyingGuy',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'none',
                        'role': 'visitor'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() =>
                Array.from(view.querySelectorAll('.chat-info__message')).pop()?.textContent.trim() ===
                "annoyingGuy is no longer a member of this groupchat"
            );
            expect(1).toBe(1);
        }));

        it("notifies users of role and affiliation changes for members not currently in the groupchat",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);

            let message = $msg({
                from: 'lounge@montague.lit',
                id: '2CF9013B-E8A8-42A1-9633-85AD7CA12F40',
                to: 'romeo@montague.lit'
            })
            .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
            .c('item', {
                'jid': 'absentguy@montague.lit',
                'affiliation': 'member',
                'role': 'none'
            });
            _converse.connection._dataRecv(mock.createRequest(message));
            await u.waitUntil(() => view.model.occupants.length > 1);
            expect(view.model.occupants.length).toBe(2);
            expect(view.model.occupants.findWhere({'jid': 'absentguy@montague.lit'}).get('affiliation')).toBe('member');

            message = $msg({
                from: 'lounge@montague.lit',
                id: '2CF9013B-E8A8-42A1-9633-85AD7CA12F41',
                to: 'romeo@montague.lit'
            })
            .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
            .c('item', {
                'jid': 'absentguy@montague.lit',
                'affiliation': 'none',
                'role': 'none'
            });
            _converse.connection._dataRecv(mock.createRequest(message));
            expect(view.model.occupants.length).toBe(2);
            expect(view.model.occupants.findWhere({'jid': 'absentguy@montague.lit'}).get('affiliation')).toBe('none');

        }));
    });


    describe("Each chat groupchat can take special commands", function () {

        it("takes /help to show the available commands",
                mock.initConverse([], {}, async function (_converse) {

            spyOn(window, 'confirm').and.callFake(() => true);
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            const enter = { 'target': textarea, 'preventDefault': function preventDefault () {}, 'keyCode': 13 };
            textarea.value = '/help';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown(enter);

            await u.waitUntil(() => sizzle('converse-chat-help .chat-info', view).length);
            let chat_help_el = view.querySelector('converse-chat-help');
            let info_messages = sizzle('.chat-info', chat_help_el);
            expect(info_messages.length).toBe(19);
            expect(info_messages.pop().textContent.trim()).toBe('/voice: Allow muted user to post messages');
            expect(info_messages.pop().textContent.trim()).toBe('/topic: Set groupchat subject (alias for /subject)');
            expect(info_messages.pop().textContent.trim()).toBe('/subject: Set groupchat subject');
            expect(info_messages.pop().textContent.trim()).toBe('/revoke: Revoke the user\'s current affiliation');
            expect(info_messages.pop().textContent.trim()).toBe('/register: Register your nickname');
            expect(info_messages.pop().textContent.trim()).toBe('/owner: Grant ownership of this groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/op: Grant moderator role to user');
            expect(info_messages.pop().textContent.trim()).toBe('/nick: Change your nickname');
            expect(info_messages.pop().textContent.trim()).toBe('/mute: Remove user\'s ability to post messages');
            expect(info_messages.pop().textContent.trim()).toBe('/modtools: Opens up the moderator tools GUI');
            expect(info_messages.pop().textContent.trim()).toBe('/member: Grant membership to a user');
            expect(info_messages.pop().textContent.trim()).toBe('/me: Write in 3rd person');
            expect(info_messages.pop().textContent.trim()).toBe('/kick: Kick user from groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/help: Show this menu');
            expect(info_messages.pop().textContent.trim()).toBe('/destroy: Remove this groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/deop: Change user role to participant');
            expect(info_messages.pop().textContent.trim()).toBe('/clear: Clear the chat area');
            expect(info_messages.pop().textContent.trim()).toBe('/ban: Ban user by changing their affiliation to outcast');
            expect(info_messages.pop().textContent.trim()).toBe('/admin: Change user\'s affiliation to admin');

            const occupant = view.model.occupants.findWhere({'jid': _converse.bare_jid});
            occupant.set('affiliation', 'admin');

            view.querySelector('.close-chat-help').click();
            expect(view.model.get('show_help_messages')).toBe(false);
            await u.waitUntil(() => view.querySelector('converse-chat-help') === null);

            textarea.value = '/help';
            message_form.onKeyDown(enter);
            chat_help_el = await u.waitUntil(() => view.querySelector('converse-chat-help'));
            info_messages = sizzle('.chat-info', chat_help_el);
            expect(info_messages.length).toBe(18);
            let commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
            expect(commands).toEqual([
                "/admin", "/ban", "/clear", "/deop", "/destroy",
                "/help", "/kick", "/me", "/member", "/modtools", "/mute", "/nick",
                "/op", "/register", "/revoke", "/subject", "/topic", "/voice"
            ]);
            occupant.set('affiliation', 'member');
            view.querySelector('.close-chat-help').click();
            await u.waitUntil(() => view.querySelector('converse-chat-help') === null);

            textarea.value = '/help';
            message_form.onKeyDown(enter);
            chat_help_el = await u.waitUntil(() => view.querySelector('converse-chat-help'));
            info_messages = sizzle('.chat-info', chat_help_el);
            expect(info_messages.length).toBe(9);
            commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
            expect(commands).toEqual(["/clear", "/help", "/kick", "/me", "/modtools", "/mute", "/nick", "/register", "/voice"]);

            view.querySelector('.close-chat-help').click();
            await u.waitUntil(() => view.querySelector('converse-chat-help') === null);
            expect(view.model.get('show_help_messages')).toBe(false);

            occupant.set('role', 'participant');
            // Role changes causes rerender, so we need to get the new textarea

            textarea.value = '/help';
            message_form.onKeyDown(enter);
            await u.waitUntil(() => view.model.get('show_help_messages'));
            chat_help_el = await u.waitUntil(() => view.querySelector('converse-chat-help'));
            info_messages = sizzle('.chat-info', chat_help_el);
            expect(info_messages.length).toBe(5);
            commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
            expect(commands).toEqual(["/clear", "/help", "/me", "/nick", "/register"]);

            // Test that /topic is available if all users may change the subject
            // Note: we're making a shortcut here, this value should never be set manually
            view.model.config.set('changesubject', true);
            view.querySelector('.close-chat-help').click();
            await u.waitUntil(() => view.querySelector('converse-chat-help') === null);

            textarea.value = '/help';
            message_form.onKeyDown(enter);
            chat_help_el = await u.waitUntil(() => view.querySelector('converse-chat-help'));
            info_messages = sizzle('.chat-info', chat_help_el);
            expect(info_messages.length).toBe(7);
            commands = info_messages.map(m => m.textContent.replace(/:.*$/, ''));
            expect(commands).toEqual(["/clear", "/help", "/me", "/nick", "/register", "/subject", "/topic"]);
        }));

        it("takes /help to show the available commands and commands can be disabled by config",
                mock.initConverse([], {muc_disable_slash_commands: ['mute', 'voice']}, async function (_converse) {

            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            const enter = { 'target': textarea, 'preventDefault': function () {}, 'keyCode': 13 };
            spyOn(window, 'confirm').and.callFake(() => true);
            textarea.value = '/clear';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown(enter);
            textarea.value = '/help';
            message_form.onKeyDown(enter);

            await u.waitUntil(() => sizzle('.chat-info:not(.chat-event)', view).length);
            const info_messages = sizzle('.chat-info:not(.chat-event)', view);
            expect(info_messages.length).toBe(17);
            expect(info_messages.pop().textContent.trim()).toBe('/topic: Set groupchat subject (alias for /subject)');
            expect(info_messages.pop().textContent.trim()).toBe('/subject: Set groupchat subject');
            expect(info_messages.pop().textContent.trim()).toBe('/revoke: Revoke the user\'s current affiliation');
            expect(info_messages.pop().textContent.trim()).toBe('/register: Register your nickname');
            expect(info_messages.pop().textContent.trim()).toBe('/owner: Grant ownership of this groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/op: Grant moderator role to user');
            expect(info_messages.pop().textContent.trim()).toBe('/nick: Change your nickname');
            expect(info_messages.pop().textContent.trim()).toBe('/modtools: Opens up the moderator tools GUI');
            expect(info_messages.pop().textContent.trim()).toBe('/member: Grant membership to a user');
            expect(info_messages.pop().textContent.trim()).toBe('/me: Write in 3rd person');
            expect(info_messages.pop().textContent.trim()).toBe('/kick: Kick user from groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/help: Show this menu');
            expect(info_messages.pop().textContent.trim()).toBe('/destroy: Remove this groupchat');
            expect(info_messages.pop().textContent.trim()).toBe('/deop: Change user role to participant');
            expect(info_messages.pop().textContent.trim()).toBe('/clear: Clear the chat area');
            expect(info_messages.pop().textContent.trim()).toBe('/ban: Ban user by changing their affiliation to outcast');
            expect(info_messages.pop().textContent.trim()).toBe('/admin: Change user\'s affiliation to admin');
        }));

        it("takes /member to make an occupant a member",
                mock.initConverse([], {}, async function (_converse) {

            let iq_stanza;
            await mock.openAndEnterChatRoom(_converse, 'lounge@muc.montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@muc.montague.lit');
            /* We don't show join/leave messages for existing occupants. We
             * know about them because we receive their presences before we
             * receive our own.
             */
            const presence = $pres({
                    to: 'romeo@montague.lit/orchard',
                    from: 'lounge@muc.montague.lit/marc'
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {
                    'affiliation': 'none',
                    'jid': 'marc@montague.lit/_converse.js-290929789',
                    'role': 'participant'
                });
            _converse.connection._dataRecv(mock.createRequest(presence));
            expect(view.model.occupants.length).toBe(2);

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            let sent_stanza;
            spyOn(_converse.connection, 'send').and.callFake((stanza) => {
                sent_stanza = stanza;
            });

            // First check that an error message appears when a
            // non-existent nick is used.
            textarea.value = '/member chris Welcome to the club!';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            expect(_converse.connection.send).not.toHaveBeenCalled();
            await u.waitUntil(() => view.querySelectorAll('.chat-error').length);
            expect(view.querySelector('.chat-error').textContent.trim())
                .toBe('Error: couldn\'t find a groupchat participant based on your arguments');

            // Now test with an existing nick
            textarea.value = '/member marc Welcome to the club!';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            await u.waitUntil(() => Strophe.serialize(sent_stanza) ===
                `<iq id="${sent_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item affiliation="member" jid="marc@montague.lit">`+
                            `<reason>Welcome to the club!</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            let result = $iq({
                "xmlns": "jabber:client",
                "type": "result",
                "to": "romeo@montague.lit/orchard",
                "from": "lounge@muc.montague.lit",
                "id": sent_stanza.getAttribute('id')
            });
            _converse.connection.IQ_stanzas = [];
            _converse.connection._dataRecv(mock.createRequest(result));
            iq_stanza = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector('iq[to="lounge@muc.montague.lit"][type="get"] item[affiliation="member"]')).pop()
            );

            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item affiliation="member"/>`+
                    `</query>`+
                `</iq>`)
            expect(view.model.occupants.length).toBe(2);

            result = $iq({
                "xmlns": "jabber:client",
                "type": "result",
                "to": "romeo@montague.lit/orchard",
                "from": "lounge@muc.montague.lit",
                "id": iq_stanza.getAttribute("id")
            }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                .c("item", {"jid": "marc", "affiliation": "member"});
            _converse.connection._dataRecv(mock.createRequest(result));

            expect(view.model.occupants.length).toBe(2);
            iq_stanza = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector('iq[to="lounge@muc.montague.lit"][type="get"] item[affiliation="owner"]')).pop()
            );

            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item affiliation="owner"/>`+
                    `</query>`+
                `</iq>`)
            expect(view.model.occupants.length).toBe(2);

            result = $iq({
                "xmlns": "jabber:client",
                "type": "result",
                "to": "romeo@montague.lit/orchard",
                "from": "lounge@muc.montague.lit",
                "id": iq_stanza.getAttribute("id")
            }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
                .c("item", {"jid": "romeo@montague.lit", "affiliation": "owner"});
            _converse.connection._dataRecv(mock.createRequest(result));

            expect(view.model.occupants.length).toBe(2);
            iq_stanza = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector('iq[to="lounge@muc.montague.lit"][type="get"] item[affiliation="admin"]')).pop()
            );

            expect(Strophe.serialize(iq_stanza)).toBe(
                `<iq id="${iq_stanza.getAttribute('id')}" to="lounge@muc.montague.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item affiliation="admin"/>`+
                    `</query>`+
                `</iq>`)
            expect(view.model.occupants.length).toBe(2);

            result = $iq({
                "xmlns": "jabber:client",
                "type": "result",
                "to": "romeo@montague.lit/orchard",
                "from": "lounge@muc.montague.lit",
                "id": iq_stanza.getAttribute("id")
            }).c("query", {"xmlns": "http://jabber.org/protocol/muc#admin"})
            _converse.connection._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => view.querySelectorAll('.occupant').length, 500);
            await u.waitUntil(() => view.querySelectorAll('.badge').length > 1);
            expect(view.model.occupants.length).toBe(2);
            expect(view.querySelectorAll('.occupant').length).toBe(2);
        }));

        it("takes /topic to set the groupchat topic", mock.initConverse([], {}, async function (_converse) {
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            // Check the alias /topic
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/topic This is the groupchat subject';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            const { sent_stanzas } = _converse.connection;
            await u.waitUntil(() => sent_stanzas.filter(s => s.textContent.trim() === 'This is the groupchat subject'));

            // Check /subject
            textarea.value = '/subject This is a new subject';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });

            let sent_stanza = await u.waitUntil(() => sent_stanzas.filter(s => s.textContent.trim() === 'This is a new subject').pop());
            expect(Strophe.serialize(sent_stanza).toLocaleString()).toBe(
                '<message from="romeo@montague.lit/orchard" to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">'+
                    '<subject xmlns="jabber:client">This is a new subject</subject>'+
                '</message>');

            // Check case insensitivity
            textarea.value = '/Subject This is yet another subject';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            sent_stanza = await u.waitUntil(() => sent_stanzas.filter(s => s.textContent.trim() === 'This is yet another subject').pop());
            expect(Strophe.serialize(sent_stanza).toLocaleString()).toBe(
                '<message from="romeo@montague.lit/orchard" to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">'+
                    '<subject xmlns="jabber:client">This is yet another subject</subject>'+
                '</message>');

            while (sent_stanzas.length) {
                sent_stanzas.pop();
            }
            // Check unsetting the topic
            textarea.value = '/topic';
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            sent_stanza = await u.waitUntil(() => sent_stanzas.pop());
            expect(Strophe.serialize(sent_stanza).toLocaleString()).toBe(
                '<message from="romeo@montague.lit/orchard" to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">'+
                    '<subject xmlns="jabber:client"></subject>'+
                '</message>');
        }));

        it("takes /clear to clear messages", mock.initConverse([], {}, async function (_converse) {
            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/clear';
            spyOn(window, 'confirm').and.callFake(() => false);
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            await u.waitUntil(() => window.confirm.calls.count() === 1);
            expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to clear the messages from this conversation?');
        }));

        it("takes /owner to make a user an owner", mock.initConverse([], {}, async function (_converse) {
            let sent_IQ, IQ_id;
            const sendIQ = _converse.connection.sendIQ;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });

            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            spyOn(view.model, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

            let presence = $pres({
                    'from': 'lounge@montague.lit/annoyingGuy',
                    'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/owner';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count());
            const err_msg = await u.waitUntil(() => view.querySelector('.chat-error'));
            expect(err_msg.textContent.trim()).toBe(
                "Error: the \"owner\" command takes two arguments, the user's nickname and optionally a reason.");

            const sel = 'iq[type="set"] query[xmlns="http://jabber.org/protocol/muc#admin"]';
            const stanzas = _converse.connection.IQ_stanzas.filter(s => sizzle(sel, s).length);
            expect(stanzas.length).toBe(0);

            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/owner nobody You\'re responsible';
            message_form.onFormSubmitted(new Event('submit'));
            await u.waitUntil(() => view.querySelectorAll('.chat-error').length === 2);
            expect(Array.from(view.querySelectorAll('.chat-error')).pop().textContent.trim()).toBe(
                "Error: couldn't find a groupchat participant based on your arguments");

            expect(_converse.connection.IQ_stanzas.filter(s => sizzle(sel, s).length).length).toBe(0);

            // Call now with the correct of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/owner annoyingGuy You\'re responsible';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 3);
            // Check that the member list now gets updated
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item affiliation="owner" jid="annoyingguy@montague.lit">`+
                            `<reason>You&apos;re responsible</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            presence = $pres({
                    'from': 'lounge@montague.lit/annoyingGuy',
                    'id':'27C55F89-1C6A-459A-9EB5-77690145D628',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'owner',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() =>
                Array.from(view.querySelectorAll('.chat-info__message')).pop()?.textContent.trim() ===
                "annoyingGuy is now an owner of this groupchat"
            );
        }));

        it("takes /ban to ban a user", mock.initConverse([], {}, async function (_converse) {
            let sent_IQ, IQ_id;
            const sendIQ = _converse.connection.sendIQ;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });

            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            spyOn(view.model, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

            let presence = $pres({
                    'from': 'lounge@montague.lit/annoyingGuy',
                    'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/ban';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count());
            await u.waitUntil(() => view.querySelector('.message:last-child')?.textContent?.trim() ===
                "Error: the \"ban\" command takes two arguments, the user's nickname and optionally a reason.");

            const sel = 'iq[type="set"] query[xmlns="http://jabber.org/protocol/muc#admin"]';
            const stanzas = _converse.connection.IQ_stanzas.filter(s => sizzle(sel, s).length);
            expect(stanzas.length).toBe(0);

            // Call now with the correct amount of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/ban annoyingGuy You\'re annoying';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 2);
            // Check that the member list now gets updated
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item affiliation="outcast" jid="annoyingguy@montague.lit">`+
                            `<reason>You&apos;re annoying</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            presence = $pres({
                'from': 'lounge@montague.lit/annoyingGuy',
                'id':'27C55F89-1C6A-459A-9EB5-77690145D628',
                'to': 'romeo@montague.lit/desktop'
            }).c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                .c('item', {
                    'jid': 'annoyingguy@montague.lit',
                    'affiliation': 'outcast',
                    'role': 'participant'
                }).c('actor', {'nick': 'romeo'}).up()
                    .c('reason').t("You're annoying").up().up()
                .c('status', {'code': '301'});

            _converse.connection._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 2);
            expect(view.querySelectorAll('.chat-info__message')[1].textContent.trim()).toBe("annoyingGuy has been banned by romeo");
            expect(view.querySelector('.chat-info:last-child q').textContent.trim()).toBe("You're annoying");
            presence = $pres({
                    'from': 'lounge@montague.lit/joe2',
                    'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'joe2@montague.lit',
                        'affiliation': 'member',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));

            textarea.value = '/ban joe22';
            message_form.onFormSubmitted(new Event('submit'));
            await u.waitUntil(() => view.querySelector('converse-chat-message:last-child')?.textContent?.trim() ===
                "Error: couldn't find a groupchat participant based on your arguments");
        }));


        it("takes a /kick command to kick a user", mock.initConverse([], {}, async function (_converse) {
            let sent_IQ, IQ_id;
            const sendIQ = _converse.connection.sendIQ;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            spyOn(view.model, 'setRole').and.callThrough();
            spyOn(view.model, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

            let presence = $pres({
                    'from': 'lounge@montague.lit/annoying guy',
                    'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'none',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/kick';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });
            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count());
            await u.waitUntil(() => view.querySelector('.message:last-child')?.textContent?.trim() ===
                "Error: the \"kick\" command takes two arguments, the user's nickname and optionally a reason.");
            expect(view.model.setRole).not.toHaveBeenCalled();
            // Call now with the correct amount of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/kick @annoying guy You\'re annoying';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 2);
            expect(view.model.setRole).toHaveBeenCalled();
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item nick="annoying guy" role="none">`+
                            `<reason>You&apos;re annoying</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            /* <presence
             *     from='harfleur@chat.shakespeare.lit/pistol'
             *     to='gower@shakespeare.lit/cell'
             *     type='unavailable'>
             *       <x xmlns='http://jabber.org/protocol/muc#user'>
             *         <item affiliation='none' role='none'/>
             *         <status code='307'/>
             *       </x>
             *     </presence>
             */
            presence = $pres({
                    'from': 'lounge@montague.lit/annoying guy',
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'unavailable'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'affiliation': 'none',
                        'role': 'none'
                    }).c('actor', {'nick': 'romeo'}).up()
                      .c('reason').t("You're annoying").up().up()
                    .c('status', {'code': '307'});

            _converse.connection._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => view.querySelectorAll('.chat-info').length === 2);
            expect(view.querySelectorAll('.chat-info__message')[1].textContent.trim()).toBe("annoying guy has been kicked out by romeo");
            expect(view.querySelector('.chat-info:last-child q').textContent.trim()).toBe("You're annoying");
        }));


        it("takes /op and /deop to make a user a moderator or not",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            let sent_IQ, IQ_id;
            const sendIQ = _converse.connection.sendIQ;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            spyOn(view.model, 'setRole').and.callThrough();
            spyOn(view.model, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

            // New user enters the groupchat
            /* <presence
             *     from='coven@chat.shakespeare.lit/thirdwitch'
             *     id='27C55F89-1C6A-459A-9EB5-77690145D624'
             *     to='crone1@shakespeare.lit/desktop'>
             * <x xmlns='http://jabber.org/protocol/muc#user'>
             *     <item affiliation='member' role='moderator'/>
             * </x>
             * </presence>
             */
            let presence = $pres({
                    'from': 'lounge@montague.lit/trustworthyguy',
                    'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'trustworthyguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo and trustworthyguy have entered the groupchat");

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/op';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count());
            await u.waitUntil(() => view.querySelector('.message:last-child')?.textContent?.trim() ===
                "Error: the \"op\" command takes two arguments, the user's nickname and optionally a reason.");

            expect(view.model.setRole).not.toHaveBeenCalled();
            // Call now with the correct amount of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/op trustworthyguy You\'re trustworthy';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 2);
            expect(view.model.setRole).toHaveBeenCalled();
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item nick="trustworthyguy" role="moderator">`+
                            `<reason>You&apos;re trustworthy</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            /* <presence
             *     from='coven@chat.shakespeare.lit/thirdwitch'
             *     to='crone1@shakespeare.lit/desktop'>
             * <x xmlns='http://jabber.org/protocol/muc#user'>
             *     <item affiliation='member'
             *         jid='hag66@shakespeare.lit/pda'
             *         role='moderator'/>
             * </x>
             * </presence>
             */
            presence = $pres({
                    'from': 'lounge@montague.lit/trustworthyguy',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'trustworthyguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'moderator'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            // Check now that things get restored when the user is given a voice
            await u.waitUntil(
                () => view.querySelector('.chat-content__notifications').textContent.split('\n', 2).pop()?.trim() ===
                    "trustworthyguy is now a moderator");

            // Call now with the correct amount of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/deop trustworthyguy Perhaps not';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 3);
            expect(view.model.setRole).toHaveBeenCalled();
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item nick="trustworthyguy" role="participant">`+
                            `<reason>Perhaps not</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            /* <presence
             *     from='coven@chat.shakespeare.lit/thirdwitch'
             *     to='crone1@shakespeare.lit/desktop'>
             * <x xmlns='http://jabber.org/protocol/muc#user'>
             *     <item affiliation='member'
             *         jid='hag66@shakespeare.lit/pda'
             *         role='participant'/>
             * </x>
             * </presence>
             */
            presence = $pres({
                    'from': 'lounge@montague.lit/trustworthyguy',
                    'to': 'romeo@montague.lit/desktop'
                }).c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'trustworthyguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'participant'
            });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.includes("trustworthyguy is no longer a moderator"));
        }));

        it("takes /mute and /voice to mute and unmute a user",
            mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            var sent_IQ, IQ_id;
            var sendIQ = _converse.connection.sendIQ;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            spyOn(view.model, 'setRole').and.callThrough();
            spyOn(view.model, 'validateRoleOrAffiliationChangeArgs').and.callThrough();

            // New user enters the groupchat
            /* <presence
             *     from='coven@chat.shakespeare.lit/thirdwitch'
             *     id='27C55F89-1C6A-459A-9EB5-77690145D624'
             *     to='crone1@shakespeare.lit/desktop'>
             * <x xmlns='http://jabber.org/protocol/muc#user'>
             *     <item affiliation='member' role='participant'/>
             * </x>
             * </presence>
             */
            let presence = $pres({
                    'from': 'lounge@montague.lit/annoyingGuy',
                    'id':'27C55F89-1C6A-459A-9EB5-77690145D624',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo and annoyingGuy have entered the groupchat");

            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/mute';
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                keyCode: 13
            });

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count());
            await u.waitUntil(() => view.querySelector('.message:last-child')?.textContent?.trim() ===
                "Error: the \"mute\" command takes two arguments, the user's nickname and optionally a reason.");
            expect(view.model.setRole).not.toHaveBeenCalled();
            // Call now with the correct amount of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/mute annoyingGuy You\'re annoying';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 2)
            expect(view.model.setRole).toHaveBeenCalled();
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item nick="annoyingGuy" role="visitor">`+
                            `<reason>You&apos;re annoying</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            /* <presence
             *     from='coven@chat.shakespeare.lit/thirdwitch'
             *     to='crone1@shakespeare.lit/desktop'>
             * <x xmlns='http://jabber.org/protocol/muc#user'>
             *     <item affiliation='member'
             *         jid='hag66@shakespeare.lit/pda'
             *         role='visitor'/>
             * </x>
             * </presence>
             */
            presence = $pres({
                    'from': 'lounge@montague.lit/annoyingGuy',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'visitor'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.includes("annoyingGuy has been muted"));

            // Call now with the correct of arguments.
            // XXX: Calling onFormSubmitted directly, trying
            // again via triggering Event doesn't work for some weird
            // reason.
            textarea.value = '/voice annoyingGuy Now you can talk again';
            message_form.onFormSubmitted(new Event('submit'));

            await u.waitUntil(() => view.model.validateRoleOrAffiliationChangeArgs.calls.count() === 3);
            expect(view.model.setRole).toHaveBeenCalled();
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${IQ_id}" to="lounge@montague.lit" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#admin">`+
                        `<item nick="annoyingGuy" role="participant">`+
                            `<reason>Now you can talk again</reason>`+
                        `</item>`+
                    `</query>`+
                `</iq>`);

            /* <presence
             *     from='coven@chat.shakespeare.lit/thirdwitch'
             *     to='crone1@shakespeare.lit/desktop'>
             * <x xmlns='http://jabber.org/protocol/muc#user'>
             *     <item affiliation='member'
             *         jid='hag66@shakespeare.lit/pda'
             *         role='visitor'/>
             * </x>
             * </presence>
             */
            presence = $pres({
                    'from': 'lounge@montague.lit/annoyingGuy',
                    'to': 'romeo@montague.lit/desktop'
                })
                .c('x', { 'xmlns': 'http://jabber.org/protocol/muc#user'})
                    .c('item', {
                        'jid': 'annoyingguy@montague.lit',
                        'affiliation': 'member',
                        'role': 'participant'
                    });
            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.includes("annoyingGuy has been given a voice"));
        }));

        it("takes /destroy to destroy a muc",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            const new_muc_jid = 'foyer@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            let view = _converse.chatboxviews.get(muc_jid);
            spyOn(_converse.api, 'confirm').and.callThrough();
            let textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/destroy';
            let message_form = view.querySelector('converse-muc-message-form');
            message_form.onFormSubmitted(new Event('submit'));
            let modal = await u.waitUntil(() => document.querySelector('.modal-dialog'));
            await u.waitUntil(() => u.isVisible(modal));

            let challenge_el = modal.querySelector('[name="challenge"]');
            challenge_el.value = muc_jid+'e';
            const reason_el = modal.querySelector('[name="reason"]');
            reason_el.value = 'Moved to a new location';
            const newjid_el = modal.querySelector('[name="newjid"]');
            newjid_el.value = new_muc_jid;
            let submit = modal.querySelector('[type="submit"]');
            submit.click();
            expect(u.isVisible(modal)).toBeTruthy();
            expect(u.hasClass('error', challenge_el)).toBeTruthy();
            challenge_el.value = muc_jid;
            submit.click();

            let sent_IQs = _converse.connection.IQ_stanzas;
            let sent_IQ = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('destroy')).pop());
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${sent_IQ.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#owner">`+
                        `<destroy jid="${new_muc_jid}">`+
                            `<reason>`+
                                `Moved to a new location`+
                            `</reason>`+
                        `</destroy>`+
                    `</query>`+
                `</iq>`);

            let result_stanza = $iq({
                'type': 'result',
                'id': sent_IQ.getAttribute('id'),
                'from': view.model.get('jid'),
                'to': _converse.connection.jid
            });
            expect(_converse.chatboxes.length).toBe(2);
            spyOn(_converse.api, "trigger").and.callThrough();
            _converse.connection._dataRecv(mock.createRequest(result_stanza));
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED));
            await u.waitUntil(() => _converse.chatboxes.length === 1);
            expect(_converse.api.trigger).toHaveBeenCalledWith('chatBoxClosed', jasmine.any(Object));

            // Try again without reason or new JID
            _converse.connection.IQ_stanzas = [];
            sent_IQs = _converse.connection.IQ_stanzas;
            await mock.openAndEnterChatRoom(_converse, new_muc_jid, 'romeo');
            view = _converse.chatboxviews.get(new_muc_jid);
            textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = '/destroy';
            message_form = view.querySelector('converse-muc-message-form');
            message_form.onFormSubmitted(new Event('submit'));
            modal = await u.waitUntil(() => document.querySelector('.modal-dialog'));
            await u.waitUntil(() => u.isVisible(modal));

            challenge_el = modal.querySelector('[name="challenge"]');
            challenge_el.value = new_muc_jid;
            submit = modal.querySelector('[type="submit"]');
            submit.click();

            sent_IQ = await u.waitUntil(() => sent_IQs.filter(iq => iq.querySelector('destroy')).pop());
            expect(Strophe.serialize(sent_IQ)).toBe(
                `<iq id="${sent_IQ.getAttribute('id')}" to="${new_muc_jid}" type="set" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/muc#owner">`+
                        `<destroy/>`+
                    `</query>`+
                `</iq>`);

            result_stanza = $iq({
                'type': 'result',
                'id': sent_IQ.getAttribute('id'),
                'from': view.model.get('jid'),
                'to': _converse.connection.jid
            });
            expect(_converse.chatboxes.length).toBe(2);
            _converse.connection._dataRecv(mock.createRequest(result_stanza));
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.DISCONNECTED));
            await u.waitUntil(() => _converse.chatboxes.length === 1);
        }));
    });

    describe("When attempting to enter a groupchat", function () {

        it("will use the nickname set in the global settings if the user doesn't have a VCard nickname",
                mock.initConverse(['chatBoxesFetched'], {'nickname': 'Benedict-Cucumberpatch'},
                async function (_converse) {

            await mock.openChatRoomViaModal(_converse, 'roomy@muc.montague.lit');
            const view = _converse.chatboxviews.get('roomy@muc.montague.lit');
            expect(view.model.get('nick')).toBe('Benedict-Cucumberpatch');
        }));

        it("will show an error message if the groupchat requires a password",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'protected';
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);

            const presence = $pres().attrs({
                    'from': `${muc_jid}/romeo`,
                    'id': u.getUniqueId(),
                    'to': 'romeo@montague.lit/pda',
                    'type': 'error'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                  .c('error').attrs({by:'lounge@montague.lit', type:'auth'})
                      .c('not-authorized').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'});

            _converse.connection._dataRecv(mock.createRequest(presence));

            const chat_body = view.querySelector('.chatroom-body');
            await u.waitUntil(() => chat_body.querySelectorAll('form.chatroom-form').length === 1);
            expect(chat_body.querySelector('.chatroom-form label').textContent.trim())
                .toBe('This groupchat requires a password');

            // Let's submit the form
            spyOn(view.model, 'join');
            const input_el = view.querySelector('[name="password"]');
            input_el.value = 'secret';
            view.querySelector('input[type=submit]').click();
            expect(view.model.join).toHaveBeenCalledWith('romeo', 'secret');
        }));

        it("will show an error message if the groupchat is members-only and the user not included",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'members-only@muc.montague.lit'
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            // State that the chat is members-only via the features IQ
            const features_stanza = $iq({
                    'from': muc_jid,
                    'id': iq.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'result'
                })
                .c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {
                        'category': 'conference',
                        'name': 'A Dark Cave',
                        'type': 'text'
                    }).up()
                    .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                    .c('feature', {'var': 'muc_hidden'}).up()
                    .c('feature', {'var': 'muc_temporary'}).up()
                    .c('feature', {'var': 'muc_membersonly'}).up();
            _converse.connection._dataRecv(mock.createRequest(features_stanza));
            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);

            const presence = $pres().attrs({
                    from: `${muc_jid}/romeo`,
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit/pda',
                    type: 'error'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                  .c('error').attrs({by:'lounge@montague.lit', type:'auth'})
                      .c('registration-required').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child')?.textContent?.trim() ===
                'You are not on the member list of this groupchat.');
        }));

        it("will show an error message if the user has been banned",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'off-limits@muc.montague.lit'
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo');

            const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            const features_stanza = $iq({
                    'from': muc_jid,
                    'id': iq.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'result'
                })
                .c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                    .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                    .c('feature', {'var': 'muc_hidden'}).up()
                    .c('feature', {'var': 'muc_temporary'}).up()
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);

            const presence = $pres().attrs({
                    from: `${muc_jid}/romeo`,
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit/pda',
                    type: 'error'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                  .c('error').attrs({by:'lounge@montague.lit', type:'auth'})
                      .c('forbidden').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(presence));

            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe('You have been banned from this groupchat');
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.BANNED);
        }));

        it("will render a nickname form if a nickname conflict happens and muc_nickname_from_jid=false",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'conflicted@muc.montague.lit';
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo');
            const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            const features_stanza = $iq({
                    'from': muc_jid,
                    'id': iq.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'result'
                })
                .c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                    .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
                    .c('feature', {'var': 'muc_hidden'}).up()
                    .c('feature', {'var': 'muc_temporary'}).up()
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);

            const presence = $pres().attrs({
                    from: `${muc_jid}/romeo`,
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit/pda',
                    type: 'error'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                  .c('error').attrs({by: muc_jid, type:'cancel'})
                      .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(presence));

            const el = await u.waitUntil(() => view.querySelector('.muc-nickname-form .validation-message'));
            expect(el.textContent.trim()).toBe('The nickname you chose is reserved or currently in use, please choose a different one.');
        }));


        it("will automatically choose a new nickname if a nickname conflict happens and muc_nickname_from_jid=true",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'conflicting@muc.montague.lit'
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo');
            /* <presence
             *      from='coven@chat.shakespeare.lit/thirdwitch'
             *      id='n13mt3l'
             *      to='hag66@shakespeare.lit/pda'
             *      type='error'>
             *  <x xmlns='http://jabber.org/protocol/muc'/>
             *  <error by='coven@chat.shakespeare.lit' type='cancel'>
             *      <conflict xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
             *  </error>
             *  </presence>
             */
            api.settings.set('muc_nickname_from_jid', true);

            const attrs = {
                'from': `${muc_jid}/romeo`,
                'id': u.getUniqueId(),
                'to': 'romeo@montague.lit/pda',
                'type': 'error'
            };
            let presence = $pres().attrs(attrs)
                .c('x').attrs({'xmlns':'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({'by': muc_jid, 'type':'cancel'})
                    .c('conflict').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

            const view = _converse.chatboxviews.get(muc_jid);
            spyOn(view.model, 'join').and.callThrough();

            // Simulate repeatedly that there's already someone in the groupchat
            // with that nickname
            _converse.connection._dataRecv(mock.createRequest(presence));
            expect(view.model.join).toHaveBeenCalledWith('romeo-2');

            attrs.from = `${muc_jid}/romeo-2`;
            attrs.id = u.getUniqueId();
            presence = $pres().attrs(attrs)
                .c('x').attrs({'xmlns':'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({'by': muc_jid, type:'cancel'})
                    .c('conflict').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(presence));

            expect(view.model.join).toHaveBeenCalledWith('romeo-3');

            attrs.from = `${muc_jid}/romeo-3`;
            attrs.id = new Date().getTime();
            presence = $pres().attrs(attrs)
                .c('x').attrs({'xmlns': 'http://jabber.org/protocol/muc'}).up()
                .c('error').attrs({'by': muc_jid, 'type': 'cancel'})
                    .c('conflict').attrs({'xmlns':'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(presence));
            expect(view.model.join).toHaveBeenCalledWith('romeo-4');
        }));

        it("will show an error message if the user is not allowed to have created the groupchat",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'impermissable@muc.montague.lit'
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo')

            // We pretend this is a new room, so no disco info is returned.
            const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());
            const features_stanza = $iq({
                    'from': 'room@conference.example.org',
                    'id': iq.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'error'
                }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

            const presence = $pres().attrs({
                    from: `${muc_jid}/romeo`,
                    id: u.getUniqueId(),
                    to:'romeo@montague.lit/pda',
                    type:'error'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                  .c('error').attrs({by:'lounge@montague.lit', type:'cancel'})
                      .c('not-allowed').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(presence));
            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe('You are not allowed to create new groupchats.');
        }));

        it("will show an error message if the user's nickname doesn't conform to groupchat policy",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'conformist@muc.montague.lit'
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo');

            const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());
            const features_stanza = $iq({
                    'from': muc_jid,
                    'id': iq.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'result'
                }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                    .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

            const presence = $pres().attrs({
                    from: `${muc_jid}/romeo`,
                    id: u.getUniqueId(),
                    to:'romeo@montague.lit/pda',
                    type:'error'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                  .c('error').attrs({by:'lounge@montague.lit', type:'cancel'})
                      .c('not-acceptable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));
            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe("Your nickname doesn't conform to this groupchat's policies.");
        }));

        it("will show an error message if the groupchat doesn't yet exist",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'nonexistent@muc.montague.lit'
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo');

            const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());
            const features_stanza = $iq({
                    'from': muc_jid,
                    'id': iq.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'result'
                }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                    .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

            const presence = $pres().attrs({
                    from: `${muc_jid}/romeo`,
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit/pda',
                    type:'error'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                  .c('error').attrs({by:'lounge@montague.lit', type:'cancel'})
                      .c('item-not-found').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));
            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe("This groupchat does not (yet) exist.");
        }));

        it("will show an error message if the groupchat has reached its maximum number of participants",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'maxed-out@muc.montague.lit'
            await mock.openChatRoomViaModal(_converse, muc_jid, 'romeo')

            const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());
            const features_stanza = $iq({
                    'from': muc_jid,
                    'id': iq.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'result'
                }).c('query', { 'xmlns': 'http://jabber.org/protocol/disco#info'})
                    .c('identity', {'category': 'conference', 'name': 'A Dark Cave', 'type': 'text'}).up()
                    .c('feature', {'var': 'http://jabber.org/protocol/muc'}).up()
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

            const presence = $pres().attrs({
                    from: `${muc_jid}/romeo`,
                    id: u.getUniqueId(),
                    to:'romeo@montague.lit/pda',
                    type:'error'
                }).c('x').attrs({xmlns:'http://jabber.org/protocol/muc'}).up()
                  .c('error').attrs({by:'lounge@montague.lit', type:'cancel'})
                      .c('service-unavailable').attrs({xmlns:'urn:ietf:params:xml:ns:xmpp-stanzas'}).nodeTree;

            _converse.connection._dataRecv(mock.createRequest(presence));
            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe("This groupchat has reached its maximum number of participants.");
        }));
    });


    describe("The affiliations delta", function () {

        it("can be computed in various ways", mock.initConverse([], {}, async function (_converse) {
            await mock.openChatRoom(_converse, 'coven', 'chat.shakespeare.lit', 'romeo');
            var exclude_existing = false;
            var remove_absentees = false;
            var new_list = [];
            var old_list = [];
            const muc_utils = converse.env.muc_utils;
            let delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
            expect(delta.length).toBe(0);

            new_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
            old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
            delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
            expect(delta.length).toBe(0);

            // When remove_absentees is false, then affiliations in the old
            // list which are not in the new one won't be removed.
            old_list = [{'jid': 'oldhag666@shakespeare.lit', 'affiliation': 'owner'},
                        {'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
            delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
            expect(delta.length).toBe(0);

            // With exclude_existing set to false, any changed affiliations
            // will be included in the delta (i.e. existing affiliations are included in the comparison).
            old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'owner'}];
            delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
            expect(delta.length).toBe(1);
            expect(delta[0].jid).toBe('wiccarocks@shakespeare.lit');
            expect(delta[0].affiliation).toBe('member');

            // To also remove affiliations from the old list which are not
            // in the new list, we set remove_absentees to true
            remove_absentees = true;
            old_list = [{'jid': 'oldhag666@shakespeare.lit', 'affiliation': 'owner'},
                        {'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'member'}];
            delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
            expect(delta.length).toBe(1);
            expect(delta[0].jid).toBe('oldhag666@shakespeare.lit');
            expect(delta[0].affiliation).toBe('none');

            delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, [], old_list);
            expect(delta.length).toBe(2);
            expect(delta[0].jid).toBe('oldhag666@shakespeare.lit');
            expect(delta[0].affiliation).toBe('none');
            expect(delta[1].jid).toBe('wiccarocks@shakespeare.lit');
            expect(delta[1].affiliation).toBe('none');

            // To only add a user if they don't already have an
            // affiliation, we set 'exclude_existing' to true
            exclude_existing = true;
            old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'owner'}];
            delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
            expect(delta.length).toBe(0);

            old_list = [{'jid': 'wiccarocks@shakespeare.lit', 'affiliation': 'admin'}];
            delta = muc_utils.computeAffiliationsDelta(exclude_existing, remove_absentees, new_list, old_list);
            expect(delta.length).toBe(0);
        }));
    });

    describe("The \"Groupchats\" Add modal", function () {

        it("can be opened from a link in the \"Groupchats\" section of the controlbox",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);

            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('add-chatroom-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000)

            let label_name = modal.el.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat address:');
            let name_input = modal.el.querySelector('input[name="chatroom"]');
            expect(name_input.placeholder).toBe('name@conference.example.org');

            const label_nick = modal.el.querySelector('label[for="nickname"]');
            expect(label_nick.textContent.trim()).toBe('Nickname:');
            const nick_input = modal.el.querySelector('input[name="nickname"]');
            expect(nick_input.value).toBe('');
            nick_input.value = 'romeo';

            expect(modal.el.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
            modal.el.querySelector('input[name="chatroom"]').value = 'lounce@muc.montague.lit';
            modal.el.querySelector('form input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.length);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);

            roomspanel.model.set('muc_domain', 'muc.example.org');
            roomspanel.querySelector('.show-add-muc-modal').click();
            label_name = modal.el.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat address:');
            name_input = modal.el.querySelector('input[name="chatroom"]');
            expect(name_input.placeholder).toBe('name@muc.example.org');
        }));

        it("doesn't show the nickname field if locked_muc_nickname is true",
                mock.initConverse(['chatBoxesFetched'], {'locked_muc_nickname': true, 'muc_nickname_from_jid': true}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('add-chatroom-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000)
            const name_input = modal.el.querySelector('input[name="chatroom"]');
            name_input.value = 'lounge@montague.lit';
            expect(modal.el.querySelector('label[for="nickname"]')).toBe(null);
            expect(modal.el.querySelector('input[name="nickname"]')).toBe(null);
            modal.el.querySelector('form input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.length > 1);
            const chatroom = _converse.chatboxes.get('lounge@montague.lit');
            expect(chatroom.get('nick')).toBe('romeo');
        }));

        it("uses the JID node if muc_nickname_from_jid is set to true",
                mock.initConverse(['chatBoxesFetched'], {'muc_nickname_from_jid': true}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('add-chatroom-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000)
            const label_nick = modal.el.querySelector('label[for="nickname"]');
            expect(label_nick.textContent.trim()).toBe('Nickname:');
            const nick_input = modal.el.querySelector('input[name="nickname"]');
            expect(nick_input.value).toBe('romeo');
        }));

        it("uses the nickname passed in to converse.initialize",
                mock.initConverse(['chatBoxesFetched'], {'nickname': 'st.nick'}, async function (_converse) {

            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current', 0);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('add-chatroom-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000)
            const label_nick = modal.el.querySelector('label[for="nickname"]');
            expect(label_nick.textContent.trim()).toBe('Nickname:');
            const nick_input = modal.el.querySelector('input[name="nickname"]');
            expect(nick_input.value).toBe('st.nick');
        }));

        it("doesn't require the domain when muc_domain is set",
                mock.initConverse(['chatBoxesFetched'], {'muc_domain': 'muc.example.org'}, async function (_converse) {

            await mock.openControlBox(_converse);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            const modal = _converse.api.modal.get('add-chatroom-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000)
            expect(modal.el.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
            const label_name = modal.el.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat name:');
            let name_input = modal.el.querySelector('input[name="chatroom"]');
            expect(name_input.placeholder).toBe('name@muc.example.org');
            name_input.value = 'lounge';
            let nick_input = modal.el.querySelector('input[name="nickname"]');
            nick_input.value = 'max';

            modal.el.querySelector('form input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.length);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes('lounge@muc.example.org')).toBe(true);

            // However, you can still open MUCs with different domains
            roomspanel.querySelector('.show-add-muc-modal').click();
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            name_input = modal.el.querySelector('input[name="chatroom"]');
            name_input.value = 'lounge@conference.example.org';
            nick_input = modal.el.querySelector('input[name="nickname"]');
            nick_input.value = 'max';
            modal.el.querySelector('form input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.models.filter(c => c.get('type') === 'chatroom').length === 2);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 2);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes('lounge@conference.example.org')).toBe(true);
        }));

        it("only uses the muc_domain is locked_muc_domain is true",
                mock.initConverse(['chatBoxesFetched'], {'muc_domain': 'muc.example.org', 'locked_muc_domain': true},
                async function (_converse) {

            await mock.openControlBox(_converse);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-add-muc-modal').click();
            const modal = _converse.api.modal.get('add-chatroom-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000)
            expect(modal.el.querySelector('.modal-title').textContent.trim()).toBe('Enter a new Groupchat');
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called
            const label_name = modal.el.querySelector('label[for="chatroom"]');
            expect(label_name.textContent.trim()).toBe('Groupchat name:');
            let name_input = modal.el.querySelector('input[name="chatroom"]');
            expect(name_input.placeholder).toBe('');
            name_input.value = 'lounge';
            let nick_input = modal.el.querySelector('input[name="nickname"]');
            nick_input.value = 'max';
            modal.el.querySelector('form input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.length);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 1);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes('lounge@muc.example.org')).toBe(true);

            // However, you can still open MUCs with different domains
            roomspanel.querySelector('.show-add-muc-modal').click();
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            name_input = modal.el.querySelector('input[name="chatroom"]');
            name_input.value = 'lounge@conference';
            nick_input = modal.el.querySelector('input[name="nickname"]');
            nick_input.value = 'max';
            modal.el.querySelector('form input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.models.filter(c => c.get('type') === 'chatroom').length === 2);
            await u.waitUntil(() => sizzle('.chatroom', _converse.el).filter(u.isVisible).length === 2);
            expect(_converse.chatboxes.models.map(m => m.get('id')).includes('lounge\\40conference@muc.example.org')).toBe(true);
        }));
    });

    describe("The \"Groupchats\" List modal", function () {

        it("can be opened from a link in the \"Groupchats\" section of the controlbox",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            await mock.openControlBox(_converse);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-list-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('muc-list-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

            // See: https://xmpp.org/extensions/xep-0045.html#disco-rooms
            expect(modal.el.querySelectorAll('.available-chatrooms li').length).toBe(0);

            const server_input = modal.el.querySelector('input[name="server"]');
            expect(server_input.placeholder).toBe('conference.example.org');
            server_input.value = 'chat.shakespeare.lit';
            modal.el.querySelector('input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.length);

            const IQ_stanzas = _converse.connection.IQ_stanzas;
            const sent_stanza = await u.waitUntil(
                () => IQ_stanzas.filter(s => sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"]`, s).length).pop()
            );
            const id = sent_stanza.getAttribute('id');
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="${id}" `+
                    `to="chat.shakespeare.lit" `+
                    `type="get" `+
                    `xmlns="jabber:client">`+
                        `<query xmlns="http://jabber.org/protocol/disco#items"/>`+
                `</iq>`
            );
            const iq = $iq({
                'from':'muc.montague.lit',
                'to':'romeo@montague.lit/pda',
                'id': id,
                'type':'result'
            }).c('query')
            .c('item', { jid:'heath@chat.shakespeare.lit', name:'A Lonely Heath'}).up()
            .c('item', { jid:'coven@chat.shakespeare.lit', name:'A Dark Cave'}).up()
            .c('item', { jid:'forres@chat.shakespeare.lit', name:'The Palace'}).up()
            .c('item', { jid:'inverness@chat.shakespeare.lit', name:'Macbeth&apos;s Castle'}).up()
            .c('item', { jid:'orchard@chat.shakespeare.lit', name:'Capulet\'s Orchard'}).up()
            .c('item', { jid:'friar@chat.shakespeare.lit', name:'Friar Laurence\'s cell'}).up()
            .c('item', { jid:'hall@chat.shakespeare.lit', name:'Hall in Capulet\'s house'}).up()
            .c('item', { jid:'chamber@chat.shakespeare.lit', name:'Juliet\'s chamber'}).up()
            .c('item', { jid:'public@chat.shakespeare.lit', name:'A public place'}).up()
            .c('item', { jid:'street@chat.shakespeare.lit', name:'A street'}).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(iq));

            await u.waitUntil(() => modal.el.querySelectorAll('.available-chatrooms li').length === 11);
            const rooms = modal.el.querySelectorAll('.available-chatrooms li');
            expect(rooms[0].textContent.trim()).toBe("Groupchats found");
            expect(rooms[1].textContent.trim()).toBe("A Lonely Heath");
            expect(rooms[2].textContent.trim()).toBe("A Dark Cave");
            expect(rooms[3].textContent.trim()).toBe("The Palace");
            expect(rooms[4].textContent.trim()).toBe("Macbeth's Castle");
            expect(rooms[5].textContent.trim()).toBe('Capulet\'s Orchard');
            expect(rooms[6].textContent.trim()).toBe('Friar Laurence\'s cell');
            expect(rooms[7].textContent.trim()).toBe('Hall in Capulet\'s house');
            expect(rooms[8].textContent.trim()).toBe('Juliet\'s chamber');
            expect(rooms[9].textContent.trim()).toBe('A public place');
            expect(rooms[10].textContent.trim()).toBe('A street');

            rooms[4].querySelector('.open-room').click();
            await u.waitUntil(() => _converse.chatboxes.length > 1);
            expect(sizzle('.chatroom', _converse.el).filter(u.isVisible).length).toBe(1); // There should now be an open chatroom
            const view = _converse.chatboxviews.get('inverness@chat.shakespeare.lit');
            expect(view.querySelector('.chatbox-title__text').textContent.trim()).toBe("Macbeth's Castle");
        }));

        it("is pre-filled with the muc_domain",
            mock.initConverse(
                ['chatBoxesFetched'],
                {'muc_domain': 'muc.example.org'},
                async function (_converse) {

            await mock.openControlBox(_converse);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-list-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('muc-list-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            const server_input = modal.el.querySelector('input[name="server"]');
            expect(server_input.value).toBe('muc.example.org');
        }));

        it("doesn't let you set the MUC domain if it's locked",
            mock.initConverse(
                ['chatBoxesFetched'],
                {'muc_domain': 'chat.shakespeare.lit', 'locked_muc_domain': true},
                async function (_converse) {

            await mock.openControlBox(_converse);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-list-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('muc-list-modal');
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());
            roomspanel.delegateEvents(); // We need to rebind all events otherwise our spy won't be called

            expect(modal.el.querySelector('input[name="server"]')).toBe(null);
            expect(modal.el.querySelector('input[type="submit"]')).toBe(null);
            await u.waitUntil(() => _converse.chatboxes.length);
            const sent_stanza = await u.waitUntil(() =>
                _converse.connection.sent_stanzas.filter(
                    s => sizzle(`query[xmlns="http://jabber.org/protocol/disco#items"]`, s).length).pop()
            );
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}" `+
                        `to="chat.shakespeare.lit" type="get" xmlns="jabber:client">`+
                    `<query xmlns="http://jabber.org/protocol/disco#items"/>`+
                `</iq>`
            );
            const iq = $iq({
                from:'muc.montague.lit',
                to:'romeo@montague.lit/pda',
                id: sent_stanza.getAttribute('id'),
                type:'result'
            }).c('query')
            .c('item', { jid:'heath@chat.shakespeare.lit', name:'A Lonely Heath'}).up()
            .c('item', { jid:'coven@chat.shakespeare.lit', name:'A Dark Cave'}).up()
            .c('item', { jid:'forres@chat.shakespeare.lit', name:'The Palace'}).up()
            _converse.connection._dataRecv(mock.createRequest(iq));

            await u.waitUntil(() => modal.el.querySelectorAll('.available-chatrooms li').length === 4);
            const rooms = modal.el.querySelectorAll('.available-chatrooms li');
            expect(rooms[0].textContent.trim()).toBe("Groupchats found");
            expect(rooms[1].textContent.trim()).toBe("A Lonely Heath");
            expect(rooms[2].textContent.trim()).toBe("A Dark Cave");
            expect(rooms[3].textContent.trim()).toBe("The Palace");
        }));
    });

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
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo', features);

            const view = _converse.chatboxviews.get(muc_jid);
            view.model.setChatState(_converse.ACTIVE);

            expect(view.model.sendChatState).toHaveBeenCalled();
            const last_stanza = _converse.connection.sent_stanzas.pop();
            expect(Strophe.serialize(last_stanza)).toBe(
                `<message to="lounge@montague.lit" type="groupchat" xmlns="jabber:client">`+
                    `<active xmlns="http://jabber.org/protocol/chatstates"/>`+
                    `<no-store xmlns="urn:xmpp:hints"/>`+
                    `<no-permanent-store xmlns="urn:xmpp:hints"/>`+
                `</message>`);

            // Romeo loses his voice
            const presence = $pres({
                    to: 'romeo@montague.lit/orchard',
                    from: `${muc_jid}/romeo`
                }).c('x', {xmlns: Strophe.NS.MUC_USER})
                .c('item', {'affiliation': 'none', 'role': 'visitor'}).up()
                .c('status', {code: '110'});
            _converse.connection._dataRecv(mock.createRequest(presence));

            const occupant = view.model.occupants.findWhere({'jid': _converse.bare_jid});
            await u.waitUntil(() => occupant.get('role') === 'visitor');

            spyOn(_converse.connection, 'send');
            view.model.setChatState(_converse.INACTIVE);
            expect(view.model.sendChatState.calls.count()).toBe(2);
            expect(_converse.connection.send).not.toHaveBeenCalled();
        }));


        describe("A composing notification", function () {

            it("will be shown if received", mock.initConverse([], {}, async function (_converse) {
                const muc_jid = 'coven@chat.shakespeare.lit';
                const members = [
                    {'affiliation': 'member', 'nick': 'majortom', 'jid': 'majortom@example.org'},
                    {'affiliation': 'admin', 'nick': 'groundcontrol', 'jid': 'groundcontrol@example.org'}
                ];
                await mock.openAndEnterChatRoom(_converse, muc_jid, 'some1', [], members);
                const view = _converse.chatboxviews.get(muc_jid);

                let csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
                expect(csntext.trim()).toEqual("some1 has entered the groupchat");

                let presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(mock.createRequest(presence));
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                    "some1 and newguy have entered the groupchat");

                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/nomorenicks'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'nomorenicks@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(mock.createRequest(presence));
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                    "some1, newguy and nomorenicks have entered the groupchat", 1000);

                // Manually clear so that we can more easily test
                view.model.notifications.set('entered', []);
                await u.waitUntil(() => !view.querySelector('.chat-content__notifications').textContent, 1000);

                // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions

                const remove_notifications_timeouts = [];
                const setTimeout = window.setTimeout;
                spyOn(window, 'setTimeout').and.callFake((f, w) => {
                    if (f.toString() === "() => this.removeNotification(actor, state)") {
                        remove_notifications_timeouts.push(f)
                    }
                    setTimeout(f, w);
                });

                // <composing> state
                let msg = $msg({
                        from: muc_jid+'/newguy',
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                _converse.connection._dataRecv(mock.createRequest(msg));

                csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent, 1000);
                expect(csntext.trim()).toEqual('newguy is typing');
                expect(remove_notifications_timeouts.length).toBe(1);
                expect(view.querySelector('.chat-content__notifications').textContent.trim()).toEqual('newguy is typing');

                // <composing> state for a different occupant
                msg = $msg({
                        from: muc_jid+'/nomorenicks',
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                await view.model.handleMessageStanza(msg);
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === 'newguy and nomorenicks are typing', 1000);

                // <composing> state for a different occupant
                msg = $msg({
                        from: muc_jid+'/majortom',
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                await view.model.handleMessageStanza(msg);
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === 'newguy, nomorenicks and majortom are typing', 1000);

                // <composing> state for a different occupant
                msg = $msg({
                        from: muc_jid+'/groundcontrol',
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                await view.model.handleMessageStanza(msg);
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === 'newguy, nomorenicks and others are typing', 1000);

                msg = $msg({
                    from: `${muc_jid}/some1`,
                    id: u.getUniqueId(),
                    to: 'romeo@montague.lit',
                    type: 'groupchat'
                }).c('body').t('hello world').tree();
                await view.model.handleMessageStanza(msg);

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
                await mock.openAndEnterChatRoom(_converse, muc_jid, 'some1');
                const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');

                /* <presence to="romeo@montague.lit/_converse.js-29092160"
                 *           from="coven@chat.shakespeare.lit/some1">
                 *      <x xmlns="http://jabber.org/protocol/muc#user">
                 *          <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
                 *          <status code="110"/>
                 *      </x>
                 *  </presence></body>
                 */
                let presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/some1'
                    }).c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'owner',
                        'jid': 'romeo@montague.lit/_converse.js-29092160',
                        'role': 'moderator'
                    }).up()
                    .c('status', {code: '110'});
                _converse.connection._dataRecv(mock.createRequest(presence));
                const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
                expect(csntext.trim()).toEqual("some1 has entered the groupchat");

                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/newguy'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'newguy@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(mock.createRequest(presence));
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                    "some1 and newguy have entered the groupchat");

                presence = $pres({
                        to: 'romeo@montague.lit/_converse.js-29092160',
                        from: 'coven@chat.shakespeare.lit/nomorenicks'
                    })
                    .c('x', {xmlns: Strophe.NS.MUC_USER})
                    .c('item', {
                        'affiliation': 'none',
                        'jid': 'nomorenicks@montague.lit/_converse.js-290929789',
                        'role': 'participant'
                    });
                _converse.connection._dataRecv(mock.createRequest(presence));
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                    "some1, newguy and nomorenicks have entered the groupchat");

                // Manually clear so that we can more easily test
                view.model.notifications.set('entered', []);
                await u.waitUntil(() => !view.querySelector('.chat-content__notifications').textContent);

                // See XEP-0085 https://xmpp.org/extensions/xep-0085.html#definitions

                // <composing> state
                let msg = $msg({
                        from: muc_jid+'/newguy',
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                await view.model.handleMessageStanza(msg);
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
                expect(view.querySelector('.chat-content__notifications').textContent.trim()).toBe('newguy is typing');

                // <composing> state for a different occupant
                msg = $msg({
                        from: muc_jid+'/nomorenicks',
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').c('composing', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                await view.model.handleMessageStanza(msg);

                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim()  == 'newguy and nomorenicks are typing');

                // <paused> state from occupant who typed first
                msg = $msg({
                        from: muc_jid+'/newguy',
                        id: u.getUniqueId(),
                        to: 'romeo@montague.lit',
                        type: 'groupchat'
                    }).c('body').c('paused', {'xmlns': Strophe.NS.CHATSTATES}).tree();
                await view.model.handleMessageStanza(msg);
                await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim()  == 'nomorenicks is typing\nnewguy has stopped typing');
            }));
        });
    });

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

            let stanza = u.toStanza(`
                <message id="${view.model.messages.at(0).get('msgid')}"
                         xmlns="jabber:client"
                         type="error"
                         to="troll@montague.lit/resource"
                         from="trollbox@montague.lit">
                    <error type="auth"><forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.querySelector('.chat-msg__error')?.textContent.trim(), 1000);
            expect(view.querySelector('.chat-msg__error').textContent.trim()).toBe(
                "Your message was not delivered because you weren't allowed to send it.");

            textarea.value = 'Hello again';
            message_form.onFormSubmitted(new Event('submit'));
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length === 2);

            stanza = u.toStanza(`
                <message id="${view.model.messages.at(1).get('msgid')}"
                         xmlns="jabber:client"
                         type="error"
                         to="troll@montague.lit/resource"
                         from="trollbox@montague.lit">
                    <error type="auth">
                        <forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        <text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">Thou shalt not!</text>
                    </error>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));

            await u.waitUntil(() => view.querySelectorAll('.chat-msg__error').length === 2);
            const sel = 'converse-message-history converse-chat-message:last-child .chat-msg__error';
            await u.waitUntil(() => view.querySelector(sel)?.textContent.trim());
            expect(view.querySelector(sel).textContent.trim()).toBe('Thou shalt not!')
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

            let stanza = u.toStanza(`
                <presence
                    from='trollbox@montague.lit/troll'
                    to='romeo@montague.lit/orchard'>
                <x xmlns='http://jabber.org/protocol/muc#user'>
                    <item affiliation='none'
                        nick='troll'
                        role='visitor'/>
                    <status code='110'/>
                </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));

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

            stanza = u.toStanza(`
                <presence
                    from='trollbox@montague.lit/troll'
                    to='romeo@montague.lit/orchard'>
                <x xmlns='http://jabber.org/protocol/muc#user'>
                    <item affiliation='none'
                        nick='troll'
                        role='participant'/>
                    <status code='110'/>
                </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.querySelector('.muc-bottom-panel') === null);
            expect(textarea === null).toBe(false);
            // Check now that things get restored when the user is given a voice
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "troll has been given a voice");
        }));
    });

    describe("when muc_send_probes is true", function () {

        it("sends presence probes when muc_send_probes is true",
                mock.initConverse([], {'muc_send_probes': true}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

            let stanza = u.toStanza(`
                <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="${muc_jid}/ralphm">
                    <body>This message will trigger a presence probe</body>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));
            const view = _converse.chatboxviews.get(muc_jid);

            await u.waitUntil(() => view.model.messages.length);
            let occupant = view.model.messages.at(0)?.occupant;
            expect(occupant).toBeDefined();
            expect(occupant.get('nick')).toBe('ralphm');
            expect(occupant.get('affiliation')).toBeUndefined();
            expect(occupant.get('role')).toBeUndefined();

            const sent_stanzas = _converse.connection.sent_stanzas;
            let probe = await u.waitUntil(() => sent_stanzas.filter(s => s.matches('presence[type="probe"]')).pop());
            expect(Strophe.serialize(probe)).toBe(
                `<presence to="${muc_jid}/ralphm" type="probe" xmlns="jabber:client">`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);

            let presence = u.toStanza(
                `<presence xmlns="jabber:client" to="${converse.jid}" from="${muc_jid}/ralphm">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="member" jid="ralph@example.org/Conversations.ZvLu" role="participant"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));

            expect(occupant.get('affiliation')).toBe('member');
            expect(occupant.get('role')).toBe('participant');

            // Check that unavailable but affiliated occupants don't get destroyed
            stanza = u.toStanza(`
                <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="${muc_jid}/gonePhising">
                    <body>This message from an unavailable user will trigger a presence probe</body>
                </message>`);
            _converse.connection._dataRecv(mock.createRequest(stanza));

            await u.waitUntil(() => view.model.messages.length === 2);
            occupant = view.model.messages.at(1)?.occupant;
            expect(occupant).toBeDefined();
            expect(occupant.get('nick')).toBe('gonePhising');
            expect(occupant.get('affiliation')).toBeUndefined();
            expect(occupant.get('role')).toBeUndefined();

            probe = await u.waitUntil(() => sent_stanzas.filter(s => s.matches(`presence[to="${muc_jid}/gonePhising"]`)).pop());
            expect(Strophe.serialize(probe)).toBe(
                `<presence to="${muc_jid}/gonePhising" type="probe" xmlns="jabber:client">`+
                    `<priority>0</priority>`+
                    `<c hash="sha-1" node="https://conversejs.org" ver="TfHz9vOOfqIG0Z9lW5CuPaWGnrQ=" xmlns="http://jabber.org/protocol/caps"/>`+
                `</presence>`);

            presence = u.toStanza(
                `<presence xmlns="jabber:client" type="unavailable" to="${converse.jid}" from="${muc_jid}/gonePhising">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="member" jid="gonePhishing@example.org/d34dBEEF" role="participant"/>
                    </x>
                </presence>`);
            _converse.connection._dataRecv(mock.createRequest(presence));

            expect(view.model.occupants.length).toBe(3);
            expect(occupant.get('affiliation')).toBe('member');
            expect(occupant.get('role')).toBe('participant');
        }));
    });
});
