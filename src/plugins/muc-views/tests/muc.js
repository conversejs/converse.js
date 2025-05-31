/*global mock, converse */
const { $pres, Strophe, sizzle, stx, u }  = converse.env;

describe("Groupchats", function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe("An instant groupchat", function () {

        it("will be created when muc_instant_rooms is set to true",
                mock.initConverse(['chatBoxesFetched'], { vcard: { nickname: '' } }, async function (_converse) {

            let IQ_stanzas = _converse.api.connection.get().IQ_stanzas;

            const { api } = _converse;
            const muc_jid = 'lounge@montague.lit';
            const nick = 'nicky';
            const promise = api.rooms.open(muc_jid);
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, '');
            const muc = await promise;
            await muc.initialized;
            spyOn(muc, 'join').and.callThrough();

            const view = _converse.chatboxviews.get(muc_jid);
            const input = await u.waitUntil(() => view.querySelector('input[name="nick"]'), 1000);
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.NICKNAME_REQUIRED);

            input.value = nick;
            view.querySelector('input[type=submit]').click();
            expect(view.model.join).toHaveBeenCalled();

            await mock.waitForNewMUCDiscoInfo(_converse, muc_jid);

            _converse.api.connection.get().IQ_stanzas = [];
            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);

            // The user has just entered the room (because join was called)
            // and receives their own presence from the server.
            // See example 24:
            // https://xmpp.org/extensions/xep-0045.html#enter-pres
            const presence =
                stx`<presence
                        id="5025e055-036c-4bc5-a227-706e7e352053"
                        to="romeo@montague.lit/orchard"
                        from="lounge@montague.lit/nicky"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="owner" jid="romeo@montague.lit/orchard" role="moderator"/>
                        <status code="110"/>
                        <status code="201"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED);
            await mock.returnMemberLists(_converse, muc_jid);
            const num_info_msgs = await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-info').length);
            expect(num_info_msgs).toBe(1);

            const info_texts = Array.from(view.querySelectorAll('.chat-content .chat-info')).map(e => e.textContent.trim());
            expect(info_texts[0]).toBe('A new groupchat has been created');

            const csntext = await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent);
            expect(csntext.trim()).toEqual("nicky has entered the groupchat");

            // An instant room is created by saving the default configuratoin.
            const selector = `query[xmlns="${Strophe.NS.MUC_OWNER}"]`;
            IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const iq = await u.waitUntil(() => IQ_stanzas.filter((s) => sizzle(selector, s).length).pop());
            expect(iq).toEqualStanza(stx`
                <iq id="${iq.getAttribute('id')}" to="lounge@montague.lit" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#owner">
                        <x type="submit" xmlns="jabber:x:data"/>
                    </query>
                </iq>`);
        }));
    });

    describe("A Groupchat", function () {

        it("will be visible when opened as the first chat in fullscreen-view",
                mock.initConverse(['discoInitialized'],
                    { 'view_mode': 'fullscreen', 'auto_join_rooms': ['orchard@chat.shakespeare.lit']},
                    async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'orchard@chat.shakespeare.lit';
            api.rooms.get(muc_jid);
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, 'romeo');
            await mock.receiveOwnMUCPresence(_converse, muc_jid, 'romeo');

            await api.waitUntil('roomsAutoJoined');

            const room = await u.waitUntil(() => _converse.chatboxes.get(muc_jid));
            expect(room.get('hidden')).toBe(false);
        }));

        it("Can be configured to show cached messages before being joined",
            mock.initConverse(['discoInitialized'],
                {
                    muc_show_logs_before_join: true,
                    archived_messages_page_size: 2,
                    muc_nickname_from_jid: false,
                    muc_clear_messages_on_leave: false,
                    vcard: { nickname: '' },
                }, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'orchard@chat.shakespeare.lit';
            const nick = 'romeo';
            api.rooms.open(muc_jid);
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid);

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
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
            _converse.api.connection.get().IQ_stanzas = [];
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);
            await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
        }));

        it("maintains its state across reloads",
            mock.initConverse([], {
                clear_messages_on_reconnection: true,
                enable_smacks: false
            }, async function (_converse) {

            const { api } = _converse;
            const nick = 'romeo';
            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const muc_jid = 'lounge@montague.lit'
            await mock.openAndEnterMUC(_converse, muc_jid, nick, [], []);
            const view = _converse.chatboxviews.get(muc_jid);
            let iq_get = await u.waitUntil(() => sent_IQs.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop());
            expect(iq_get).toEqualStanza(stx`
                <iq id="${iq_get.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">
                    <query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="${Strophe.NS.MAM}">
                        <set xmlns="http://jabber.org/protocol/rsm"><before></before><max>50</max></set>
                    </query>
                </iq>`);

            const first_msg_id = _converse.api.connection.get().getUniqueId();
            const last_msg_id = _converse.api.connection.get().getUniqueId();
            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<message xmlns="jabber:client"
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
                    </message>`));

            let message = stx`<message xmlns="jabber:client"
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
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            const result = stx`<iq type='result' id='${iq_get.getAttribute('id')}' xmlns="jabber:client">
                    <fin xmlns='urn:xmpp:mam:2' complete="true">
                        <set xmlns='http://jabber.org/protocol/rsm'>
                            <first index='0'>${first_msg_id}</first>
                            <last>${last_msg_id}</last>
                            <count>2</count>
                        </set>
                    </fin>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));
            await u.waitUntil(()  => view.querySelectorAll('.chat-msg__text').length === 2);

            while (sent_IQs.length) { sent_IQs.pop(); } // Clear so that we don't match the older query
            await _converse.api.connection.reconnect();
            await mock.waitForMUCDiscoInfo(_converse, muc_jid, []);
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

            // The user has just entered the room (because join was called)
            // and receives their own presence from the server.
            // See example 24: https://xmpp.org/extensions/xep-0045.html#enter-pres
            await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);

            message = stx`
                <message xmlns="jabber:client" type="groupchat" id="918172de-d5c5-4da4-b388-446ef4a05bec" to="${_converse.jid}" xml:lang="en" from="${muc_jid}/juliet">
                    <body>Wherefore art though?</body>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="918172de-d5c5-4da4-b388-446ef4a05bec"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="88cc9c93-a8f4-4dd5-b02a-d19855eb6303" by="${muc_jid}"/>
                    <delay xmlns="urn:xmpp:delay" stamp="2020-07-14T17:46:47Z" from="juliet@shakespeare.lit"/>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            message = stx`
                <message xmlns="jabber:client" type="groupchat" id="awQo6a-mi-Wa6NYh" to="${_converse.jid}" from="${muc_jid}/ews000" xml:lang="en">
                    <composing xmlns="http://jabber.org/protocol/chatstates"/>
                    <no-store xmlns="urn:xmpp:hints"/>
                    <no-permanent-store xmlns="urn:xmpp:hints"/>
                    <delay xmlns="urn:xmpp:delay" stamp="2020-07-14T17:46:54Z" from="juliet@shakespeare.lit"/>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            const affs = api.settings.get('muc_fetch_members');
            const all_affiliations = Array.isArray(affs) ? affs :  (affs ? ['member', 'admin', 'owner'] : []);
            await mock.returnMemberLists(_converse, muc_jid, [], all_affiliations);

            iq_get = await u.waitUntil(() => sent_IQs.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop());
            expect(iq_get).toEqualStanza(stx`
                <iq id="${iq_get.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">
                    <query queryid="${iq_get.querySelector('query').getAttribute('queryid')}" xmlns="${Strophe.NS.MAM}">
                        <x xmlns="jabber:x:data" type="submit">
                            <field type="hidden" var="FORM_TYPE"><value>urn:xmpp:mam:2</value></field>
                            <field var="start"><value>2020-07-14T17:46:47.000Z</value></field>
                        </x>
                        <set xmlns="http://jabber.org/protocol/rsm"><before></before><max>50</max></set>
                    </query>
                </iq>`);
        }));

        it("shows a new messages indicator when you're scrolled up",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            const message = stx`
                <message xmlns="jabber:client" type="groupchat" id="918172de-d5c5-4da4-b388-446ef4a05bec" to="${_converse.jid}" xml:lang="en" from="${muc_jid}/juliet">
                    <body>Wherefore art though?</body>
                    <active xmlns="http://jabber.org/protocol/chatstates"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="918172de-d5c5-4da4-b388-446ef4a05bec"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="88cc9c93-a8f4-4dd5-b02a-d19855eb6303" by="${muc_jid}"/>
                    <delay xmlns="urn:xmpp:delay" stamp="2020-07-14T17:46:47Z" from="juliet@shakespeare.lit"/>
                </message>`;

            view.model.ui.set('scrolled', true); // hack
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            await u.waitUntil(() => view.model.messages.length);
            const chat_new_msgs_indicator = await u.waitUntil(() => view.querySelector('.new-msgs-indicator'));
            chat_new_msgs_indicator.click();
            expect(view.model.ui.get('scrolled')).toBeFalsy();
            await u.waitUntil(() => !u.isVisible(chat_new_msgs_indicator));
        }));


        describe("topic", function () {

            it("is shown the header", mock.initConverse([], {}, async function (_converse) {
                await mock.openAndEnterMUC(_converse, 'jdev@conference.jabber.org', 'jc');
                const text = 'Jabber/XMPP Development | RFCs and Extensions: https://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                let stanza = stx`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>${text}</subject>
                        <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>
                        <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>
                    </message>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                await new Promise(resolve => view.model.once('change:subject', resolve));
                const head_desc = await u.waitUntil(() => view.querySelector('.chat-head__desc'), 1000);
                expect(head_desc?.textContent.trim()).toBe(text);

                stanza = stx`<message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>This is a message subject</subject>
                        <body>This is a message</body>
                    </message>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                expect(sizzle('.chat-msg__subject', view).length).toBe(1);
                expect(sizzle('.chat-msg__subject', view).pop().textContent.trim()).toBe('This is a message subject');
                expect(sizzle('.chat-msg__text').length).toBe(1);
                expect(sizzle('.chat-msg__text').pop().textContent.trim()).toBe('This is a message');
                expect(view.querySelector('.chat-head__desc').textContent.trim()).toBe(text);
            }));

            it("can be toggled by the user", mock.initConverse([], {}, async function (_converse) {
                await mock.openAndEnterMUC(_converse, 'jdev@conference.jabber.org', 'jc');
                const text = 'Jabber/XMPP Development | RFCs and Extensions: https://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                let stanza = stx`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>${text}</subject>
                        <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>
                        <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>
                    </message>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');
                await new Promise(resolve => view.model.once('change:subject', resolve));

                const head_desc = await u.waitUntil(() => view.querySelector('.chat-head__desc'));
                expect(head_desc?.textContent.trim()).toBe(text);

                stanza = stx`<message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>This is a message subject</subject>
                        <body>This is a message</body>
                    </message>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);
                expect(sizzle('.chat-msg__subject', view).length).toBe(1);
                expect(sizzle('.chat-msg__subject', view).pop().textContent.trim()).toBe('This is a message subject');
                expect(sizzle('.chat-msg__text').length).toBe(1);
                expect(sizzle('.chat-msg__text').pop().textContent.trim()).toBe('This is a message');
                const topic_el = view.querySelector('.chat-head__desc');
                expect(topic_el.textContent.trim()).toBe(text);
                expect(u.isVisible(topic_el)).toBe(true);

                await u.waitUntil(() => view.querySelector('.hide-topic').textContent.trim() === 'Hide topic');
                const toggle = view.querySelector('.hide-topic');
                expect(toggle.textContent.trim()).toBe('Hide topic');
                toggle.click();
                await u.waitUntil(() => view.querySelector('.hide-topic').textContent.trim() === 'Show topic');
            }));

            it("will always be shown when it's new", mock.initConverse([], {}, async function (_converse) {
                await mock.openAndEnterMUC(_converse, 'jdev@conference.jabber.org', 'jc');
                const text = 'Jabber/XMPP Development | RFCs and Extensions: https://xmpp.org/ | Protocol and XSF discussions: xsf@muc.xmpp.org';
                let stanza = stx`<message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>${text}</subject>
                    </message>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
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

                stanza = stx`<message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>Another topic</subject>
                    </message>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
                await u.waitUntil(() => u.isVisible(view.querySelector('.chat-head__desc')));
                topic_el = view.querySelector('.chat-head__desc');
                expect(topic_el.textContent.trim()).toBe('Another topic');
            }));


            it("causes an info message to be shown when received in real-time", mock.initConverse([], {}, async function (_converse) {
                spyOn(_converse.ChatRoom.prototype, 'handleSubjectChange').and.callThrough();
                await mock.openAndEnterMUC(_converse, 'jdev@conference.jabber.org', 'romeo');
                const view = _converse.chatboxviews.get('jdev@conference.jabber.org');

                _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>This is an older topic</subject>
                        <delay xmlns="urn:xmpp:delay" stamp="2014-02-04T09:35:39Z" from="jdev@conference.jabber.org"/>
                        <x xmlns="jabber:x:delay" stamp="20140204T09:35:39" from="jdev@conference.jabber.org"/>
                    </message>`));
                await u.waitUntil(() => view.model.handleSubjectChange.calls.count());
                expect(sizzle('.chat-info__message', view).length).toBe(0);

                const desc = await u.waitUntil(() => view.querySelector('.chat-head__desc'));
                expect(desc.textContent.trim()).toBe('This is an older topic');

                _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>This is a new topic</subject>
                    </message>`));
                await u.waitUntil(() => view.model.handleSubjectChange.calls.count() === 2);

                await u.waitUntil(() => sizzle('.chat-info__message', view).pop()?.textContent.trim() === 'Topic set by ralphm');
                await u.waitUntil(() => desc.textContent.trim()  === 'This is a new topic');

                // Doesn't show multiple subsequent topic change notifications
                _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/ralphm">
                        <subject>Yet another topic</subject>
                    </message>`));
                await u.waitUntil(() => view.model.handleSubjectChange.calls.count() === 3);
                await u.waitUntil(() => desc.textContent.trim()  === 'Yet another topic');
                expect(sizzle('.chat-info__message', view).length).toBe(1);

                // Sow multiple subsequent topic change notification from someone else
                _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
                    <message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/some1">
                        <subject>Some1's topic</subject>
                    </message>`));
                await u.waitUntil(() => view.model.handleSubjectChange.calls.count() === 4);
                await u.waitUntil(() => desc.textContent.trim()  === "Some1's topic");
                expect(sizzle('.chat-info__message', view).length).toBe(2);
                const el = sizzle('.chat-info__message', view).pop();
                expect(el.textContent.trim()).toBe('Topic set by some1');

                // Removes current topic
                const stanza = stx`<message xmlns="jabber:client" to="${_converse.jid}" type="groupchat" from="jdev@conference.jabber.org/some1">
                        <subject/>
                    </message>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
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
            await mock.openAndEnterMUC(_converse, muc_jid , 'romeo');
            const model = _converse.chatboxes.get(muc_jid);
            const message = 'Hello world';
            const nick = mock.chatroom_names[0];
            const msg =
                stx`<message from="lounge@montague.lit/${nick}"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit"
                        type="groupchat"
                        xmlns="jabber:client">
                    <body>${message}</body>
                </message>`;

            await model.handleMessageStanza(msg);
            await u.waitUntil(() => document.querySelector('converse-chat-message'));
            await model.close();
            await u.waitUntil(() => !document.querySelector('converse-chat-message'));

            _converse.api.connection.get().IQ_stanzas = [];
            await mock.openAndEnterMUC(_converse, muc_jid , 'romeo');
            await u.waitUntil(() => document.querySelector('converse-chat-message'));
            expect(model.messages.length).toBe(1);
            expect(document.querySelectorAll('converse-chat-message').length).toBe(1);
        }));

        it("clears cached messages when it reconnects and clear_messages_on_reconnection is true",
                mock.initConverse([], {'clear_messages_on_reconnection': true}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid , 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            const message = 'Hello world';
            const nick = mock.chatroom_names[0];
            const msg =
                stx`<message from="lounge@montague.lit/${nick}"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit"
                        type="groupchat"
                        xmlns="jabber:client">
                    <body>${message}</body>
                </message>`;

            await view.model.handleMessageStanza(msg);
            await view.model.close();

            _converse.api.connection.get().IQ_stanzas = [];
            await mock.openAndEnterMUC(_converse, muc_jid , 'romeo');
            expect(view.model.messages.length).toBe(0);
            expect(view.querySelector('converse-chat-history')).toBe(null);
        }));

        it("is opened when an xmpp: URI is clicked inside another groupchat",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current');
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            if (!view.querySelectorAll('.chat-area').length) {
                view.renderChatArea();
            }
            expect(_converse.chatboxes.length).toEqual(2);
            const message = 'Please go to xmpp:coven@chat.shakespeare.lit?join';
            const nick = mock.chatroom_names[0];
            const msg =
                stx`<message from="lounge@montague.lit/${nick}"
                        id="${u.getUniqueId()}"
                        type="groupchat"
                        to="romeo@montague.lit"
                        xmlns="jabber:client">
                    <body>${message}</body>
                </message>`;

            await view.model.handleMessageStanza(msg);
            await u.waitUntil(()  => view.querySelector('.chat-msg__text a'));
            view.querySelector('.chat-msg__text a').click();

            await mock.waitForMUCDiscoInfo(_converse, 'coven@chat.shakespeare.lit');
            await mock.waitForReservedNick(_converse, 'coven@chat.shakespeare.lit', 'romeo');
            await u.waitUntil(() => _converse.chatboxes.length === 3)
            expect(_converse.chatboxes.pluck('id').includes('coven@chat.shakespeare.lit')).toBe(true);
        }));

        it("shows a notification if it's not anonymous",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const muc_jid = 'coven@chat.shakespeare.lit';
            const nick = 'romeo';
            _converse.api.rooms.open(muc_jid);
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, nick);

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            const presence =
                stx`<presence to="romeo@montague.lit/orchard"
                        from="coven@chat.shakespeare.lit/some1"
                        xmlns="jabber:client">
                    <x xmlns="${Strophe.NS.MUC_USER}">
                        <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
                        <status code="110"/>
                        <status code="100"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

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
            const room_creation_promise = _converse.api.rooms.open(muc_jid, {nick});
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
            await u.waitUntil(() => sent_stanzas.filter(iq => sizzle('presence history', iq).length));

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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            const view = await u.waitUntil(() => _converse.chatboxviews.get('coven@chat.shakespeare.lit'));
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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1 and newguy have entered the groupchat");

            const msg =
                    stx`<message from="coven@chat.shakespeare.lit/some1"
                            to="romeo@montague.lit"
                            id="${u.getUniqueId()}"
                            type="groupchat"
                            xmlns="jabber:client">
                        <body>hello world</body>
                    </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(msg));
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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1, newgirl and nomorenicks have entered the groupchat\nnewguy and insider have left the groupchat");

            expect(view.model.occupants.length).toBe(5);
            expect(view.model.occupants.findWhere({'jid': 'insider@montague.lit'}).get('presence')).toBe('offline');

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

            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "some1 and nomorenicks have entered the groupchat\nnewguy, insider and newgirl have left the groupchat");
            expect(view.model.occupants.length).toBe(4);
        }));

        it("combines subsequent join/leave messages when users enter or exit a groupchat",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            await mock.openAndEnterMUC(_converse, 'coven@chat.shakespeare.lit', 'romeo')
            const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "romeo has entered the groupchat");

            let presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fabio">
                    <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "romeo and fabio have entered the groupchat");

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/Dele Olajide">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-39320524" role="participant"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "romeo, fabio and Dele Olajide have entered the groupchat");
            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/jcbrand">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="owner" jid="jc@opkode.com/converse.js-30645022" role="moderator"/>
                        <status code="110"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() === "romeo, fabio and others have entered the groupchat");

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/Dele Olajide">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-39320524" role="none"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, fabio and jcbrand have entered the groupchat\nDele Olajide has left the groupchat");

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/Dele Olajide">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-74567907" role="participant"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, fabio and others have entered the groupchat");

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fuvuv" xml:lang="en">
                    <c xmlns="http://jabber.org/protocol/caps" node="http://jabber.pix-art.de" ver="5tOurnuFnp2h50hKafeUyeN4Yl8=" hash="sha-1"/>
                    <x xmlns="vcard-temp:x:update"/>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fuvuv@blabber.im/Pix-Art Messenger.8zoB" role="participant"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, fabio and others have entered the groupchat");

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/fuvuv">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fuvuv@blabber.im/Pix-Art Messenger.8zoB" role="none"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, fabio and others have entered the groupchat\nfuvuv has left the groupchat");

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/fabio">
                    <status>Disconnected: Replaced by new connection</status>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="none"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, jcbrand and Dele Olajide have entered the groupchat\nfuvuv and fabio have left the groupchat");

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fabio">
                    <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                    <status>Ready for a new day</status>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, jcbrand and others have entered the groupchat\nfuvuv has left the groupchat");

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/fabio">
                    <status>Disconnected: closed</status>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="none"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, jcbrand and Dele Olajide have entered the groupchat\nfuvuv and fabio have left the groupchat");

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/Dele Olajide">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="deleo@traderlynk.4ng.net/converse.js-74567907" role="none"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo and jcbrand have entered the groupchat\nfuvuv, fabio and Dele Olajide have left the groupchat");

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" from="coven@chat.shakespeare.lit/fabio">
                    <c xmlns="http://jabber.org/protocol/caps" node="http://conversations.im" ver="INI3xjRUioclBTP/aACfWi5m9UY=" hash="sha-1"/>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="fabio@montefuscolo.com.br/Conversations.ZvLu" role="participant"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo, jcbrand and fabio have entered the groupchat\nfuvuv and Dele Olajide have left the groupchat");

            expect(1).toBe(1);
        }));

        it("doesn't show the disconnection messages when join_leave_events is not in muc_show_info_messages setting",
                mock.initConverse(['chatBoxesFetched'], {'muc_show_info_messages': []}, async function (_converse) {

            spyOn(_converse.ChatRoom.prototype, 'onOccupantAdded').and.callThrough();
            spyOn(_converse.ChatRoom.prototype, 'onOccupantRemoved').and.callThrough();
            await mock.openAndEnterMUC(_converse, 'coven@chat.shakespeare.lit', 'some1');
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
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() =>  view.model.onOccupantAdded.calls.count() === 2);
            expect(view.model.notifications.get('entered')).toBeFalsy();
            expect(view.querySelector('.chat-content__notifications').textContent.trim()).toBe('');
            await mock.sendMessage(view, 'hello world');

            presence = stx`<presence xmlns="jabber:client" to="romeo@montague.lit/orchard" type="unavailable" from="coven@chat.shakespeare.lit/newguy">
                    <status>Gotta go!</status>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" jid="newguy@montague.lit/_converse.js-290929789" role="none"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() =>  view.model.onOccupantRemoved.calls.count());
            expect(view.model.onOccupantRemoved.calls.count()).toBe(1);
            expect(view.model.notifications.get('entered')).toBeFalsy();
            await mock.sendMessage(view, 'hello world');
            expect(view.querySelector('.chat-content__notifications').textContent.trim()).toBe('');
        }));

        it("role-change messages that follow a MUC leave are left out",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            // See https://github.com/conversejs/converse.js/issues/1259

            await mock.openAndEnterMUC(_converse, 'conversations@conference.siacs.eu', 'romeo');

            const presence =
                stx`<presence to='romeo@montague.lit/orchard'
                        from='conversations@conference.siacs.eu/Guus'
                        xmlns="jabber:client">
                    <x xmlns='${Strophe.NS.MUC_USER}'>
                        <item affiliation='none' jid='Guus@montague.lit/xxx' role='visitor'/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            const view = _converse.chatboxviews.get('conversations@conference.siacs.eu');
            const msg =
                stx`<message from='conversations@conference.siacs.eu/romeo'
                        to='romeo@montague.lit'
                        id='${u.getUniqueId()}'
                        type='groupchat'
                        xmlns="jabber:client">
                    <body>Some message</body>
                </message>`;

            await view.model.handleMessageStanza(msg);
            await u.waitUntil(() => sizzle('.chat-msg:last .chat-msg__text', view).pop());

            let stanza =
                stx`<presence
                        to="romeo@montague.lit/orchard"
                        type="unavailable"
                        from="conversations@conference.siacs.eu/Guus"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" role="none"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));

            stanza =
                stx`<presence
                        to="romeo@montague.lit/orchard"
                        from="conversations@conference.siacs.eu/Guus"
                        xmlns="jabber:client">
                    <c xmlns="http://jabber.org/protocol/caps"
                        node="http://conversations.im"
                        ver="ISg6+9AoK1/cwhbNEDviSvjdPzI="
                        hash="sha-1"/>
                    <x xmlns="vcard-temp:x:update">
                        <photo>bf987c486c51fbc05a6a4a9f20dd19b5efba3758</photo>
                    </x>
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="none" role="visitor"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim()
                === "romeo and Guus have entered the groupchat");
            expect(1).toBe(1);
        }));

        it("must first be configured if it's a new",
                mock.initConverse(['chatBoxesFetched'],
                { muc_instant_rooms: false },
                async function (_converse) {

            let sent_IQ, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.call(this, iq, callback, errback);
            });

            const { api } = _converse;
            const own_jid = api.connection.get().jid;
            const muc_jid = 'coven@chat.shakespeare.lit';
            _converse.api.rooms.open(muc_jid, {'nick': 'some1'});

            await mock.waitForNewMUCDiscoInfo(_converse, muc_jid);

            const presence =
                stx`<presence to='${own_jid}'
                        from='coven@chat.shakespeare.lit/some1'
                        xmlns="jabber:client">
                    <x xmlns='${Strophe.NS.MUC_USER}'>
                        <item affiliation='owner' jid='romeo@montague.lit/_converse.js-29092160' role='moderator'/>
                        <status code='110'/>
                        <status code='201'/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            while (sent_IQs.length) sent_IQs.pop();

            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            await u.waitUntil(() => u.isVisible(view));
            await u.waitUntil(() => view.model.getOwnOccupant()?.get('affiliation') === 'owner');

            const sel = 'iq query[xmlns="http://jabber.org/protocol/muc#owner"]';
            const iq = await u.waitUntil(() => sent_IQs.filter(iq => sizzle(sel, iq).length).pop());

            /* Check that an IQ is sent out, asking for the
             * configuration form.
             * See: // https://xmpp.org/extensions/xep-0045.html#example-163
             */
            expect(iq).toEqualStanza(stx`
                <iq id="${iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#owner"/>
                </iq>`);

            /* Server responds with the configuration form.
             * See: // https://xmpp.org/extensions/xep-0045.html#example-165
             */
            const config_stanza =
                stx`<iq from="${muc_jid}" id="${iq.getAttribute('id')}"
                        to="romeo@montague.lit/desktop"
                        type="result"
                        xmlns="jabber:client">
                <query xmlns="http://jabber.org/protocol/muc#owner">
                    <x xmlns="jabber:x:data" type="form">
                        <title>Configuration for "coven" Room</title>
                        <instructions>Complete this form to modify the configuration of your room.</instructions>
                        <field type="hidden" var="FORM_TYPE">
                            <value>http://jabber.org/protocol/muc#roomconfig</value>
                        </field>
                        <field label="Natural-Language Room Name" type="text-single" var="muc#roomconfig_roomname">
                            <value>A Dark Cave</value>
                        </field>
                        <field label="Short Description of Room" type="text-single" var="muc#roomconfig_roomdesc">
                            <value>The place for all good witches!</value>
                        </field>
                        <field label="Enable Public Logging?" type="boolean" var="muc#roomconfig_enablelogging">
                            <value>0</value>
                        </field>
                        <field label="Allow Occupants to Change Subject?" type="boolean" var="muc#roomconfig_changesubject">
                            <value>0</value>
                        </field>
                        <field label="Allow Occupants to Invite Others?" type="boolean" var="muc#roomconfig_allowinvites">
                            <value>0</value>
                        </field>
                        <field label="Who Can Send Private Messages?" type="list-single" var="muc#roomconfig_allowpm">
                            <value>anyone</value>
                            <option label="Anyone">
                                <value>anyone</value>
                            </option>
                            <option label="Anyone with Voice">
                                <value>participants</value>
                            </option>
                            <option label="Moderators Only">
                                <value>moderators</value>
                            </option>
                            <option label="Nobody">
                                <value>none</value>
                            </option>
                        </field>
                        <field label="Roles for which Presence is Broadcasted" type="list-multi" var="muc#roomconfig_presencebroadcast">
                            <value>moderator</value>
                            <value>participant</value>
                            <value>visitor</value>
                            <option label="Moderator">
                                <value>moderator</value>
                            </option>
                            <option label="Participant">
                                <value>participant</value>
                            </option>
                            <option label="Visitor">
                                <value>visitor</value>
                            </option>
                        </field>
                        <field label="Roles and Affiliations that May Retrieve Member List" type="list-multi" var="muc#roomconfig_getmemberlist">
                            <value>moderator</value>
                            <value>participant</value>
                            <value>visitor</value>
                            <option label="Moderator">
                                <value>moderator</value>
                            </option>
                            <option label="Participant">
                                <value>participant</value>
                            </option>
                            <option label="Visitor">
                                <value>visitor</value>
                            </option>
                        </field>
                        <field label="Make Room Publicly Searchable?" type="boolean" var="muc#roomconfig_publicroom">
                            <value>0</value>
                        </field>
                        <field label="Make Room Persistent?" type="boolean" var="muc#roomconfig_persistentroom">
                            <value>0</value>
                        </field>
                        <field label="Make Room Moderated?" type="boolean" var="muc#roomconfig_moderatedroom">
                            <value>0</value>
                        </field>
                        <field label="Make Room Members Only?" type="boolean" var="muc#roomconfig_membersonly">
                            <value>0</value>
                        </field>
                        <field label="Password Required for Entry?" type="boolean" var="muc#roomconfig_passwordprotectedroom">
                            <value>1</value>
                        </field>
                        <field type="fixed">
                            <value>If a password is required to enter this groupchat, you must specify the password below.</value>
                        </field>
                        <field label="Password" type="text-private" var="muc#roomconfig_roomsecret">
                            <value>cauldronburn</value>
                        </field>
                    </x>
                </query>
            </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(config_stanza));

            const modal = _converse.api.modal.get('converse-muc-config-modal');

            const membersonly = await u.waitUntil(() => modal.querySelector('input[name="muc#roomconfig_membersonly"]'));
            expect(membersonly.getAttribute('type')).toBe('checkbox');
            membersonly.checked = true;

            const moderated = modal.querySelectorAll('input[name="muc#roomconfig_moderatedroom"]');
            expect(moderated.length).toBe(1);
            expect(moderated[0].getAttribute('type')).toBe('checkbox');
            moderated[0].checked = true;

            const password = modal.querySelectorAll('input[name="muc#roomconfig_roomsecret"]');
            expect(password.length).toBe(1);
            expect(password[0].getAttribute('type')).toBe('password');

            const allowpm = modal.querySelectorAll('select[name="muc#roomconfig_allowpm"]');
            expect(allowpm.length).toBe(1);
            allowpm[0].value = 'moderators';

            const presencebroadcast = modal.querySelectorAll('select[name="muc#roomconfig_presencebroadcast"]');
            expect(presencebroadcast.length).toBe(1);
            presencebroadcast[0].value = ['moderator'];

            modal.querySelector('.chatroom-form input[type="submit"]').click();

            expect(sent_IQ).toEqualStanza(stx`
                <iq id="${IQ_id}" to="${muc_jid}" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#owner">
                    <x type="submit" xmlns="jabber:x:data">
                        <field var="FORM_TYPE"><value>http://jabber.org/protocol/muc#roomconfig</value></field>
                        <field var="muc#roomconfig_roomname"><value>A Dark Cave</value></field>
                        <field var="muc#roomconfig_roomdesc"><value>The place for all good witches!</value></field>
                        <field var="muc#roomconfig_enablelogging"><value>0</value></field>
                        <field var="muc#roomconfig_changesubject"><value>0</value></field>
                        <field var="muc#roomconfig_allowinvites"><value>0</value></field>
                        <field var="muc#roomconfig_allowpm"><value>moderators</value></field>
                        <field var="muc#roomconfig_presencebroadcast"><value>moderator</value></field>
                        <field var="muc#roomconfig_getmemberlist"><value>moderator</value>,<value>participant</value>,<value>visitor</value></field>
                        <field var="muc#roomconfig_publicroom"><value>0</value></field>
                        <field var="muc#roomconfig_persistentroom"><value>0</value></field>
                        <field var="muc#roomconfig_moderatedroom"><value>1</value></field>
                        <field var="muc#roomconfig_membersonly"><value>1</value></field>
                        <field var="muc#roomconfig_passwordprotectedroom"><value>1</value></field>
                        <field var="muc#roomconfig_roomsecret"><value>cauldronburn</value></field>
                    </x>
                    </query>
                </iq>`);
        }));

        it("can be configured if your its owner",
            mock.initConverse(['chatBoxesFetched'],
            { muc_instant_rooms: false },
            async function (_converse) {

            let sent_IQ, IQ_id;
            const sendIQ = _converse.api.connection.get().sendIQ;
            spyOn(_converse.api.connection.get(), 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_IQ = iq;
                IQ_id = sendIQ.call(this, iq, callback, errback);
            });

            const muc_jid = 'coven@chat.shakespeare.lit';
            const features = [
                'http://jabber.org/protocol/muc',
                'jabber:iq:register',
                'muc_passwordprotected',
                'muc_hidden',
                'muc_temporary',
                'muc_membersonly',
                'muc_unmoderated',
                'muc_anonymous',
                'vcard-temp',
            ]
            await mock.openAndEnterMUC(_converse, muc_jid, 'some1', features);
            await mock.waitForNewMUCDiscoInfo(_converse, muc_jid);

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            await u.waitUntil(() => u.isVisible(view));

            const presence =
                stx`<presence to="romeo@montague.lit/_converse.js-29092160"
                        from="coven@chat.shakespeare.lit/some1"
                        xmlns="jabber:client">
                    <x xmlns="${Strophe.NS.MUC_USER}">
                        <item affiliation="owner" jid="romeo@montague.lit/_converse.js-29092160" role="moderator"/>
                        <status code="110"/>
                        <status code="201"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            await u.waitUntil(() => view.model.getOwnOccupant()?.get('affiliation') === 'owner');

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            const sel = 'iq query[xmlns="http://jabber.org/protocol/muc#owner"]';
            const iq = await u.waitUntil(() => sent_IQs.filter(iq => sizzle(sel, iq).length).pop());

            /* Check that an IQ is sent out, asking for the
             * configuration form.
             */
            expect(iq).toEqualStanza(stx`
                <iq id="${iq.getAttribute('id')}" to="${muc_jid}" type="get" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#owner"/>
                </iq>`);

            /* Server responds with the configuration form.
             * See: // https://xmpp.org/extensions/xep-0045.html#example-165
             */
            const config_stanza =
                stx`<iq from="${muc_jid}"
                        id="${iq.getAttribute('id')}"
                        to="romeo@montague.lit/desktop"
                        type="result"
                        xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#owner">
                        <x xmlns="jabber:x:data" type="form">
                            <title>Configuration for "coven" Room</title>
                            <instructions>Complete this form to modify the configuration of your room.</instructions>
                            <field type="hidden" var="FORM_TYPE">
                                <value>http://jabber.org/protocol/muc#roomconfig</value>
                            </field>
                            <field label="Natural-Language Room Name" type="text-single" var="muc#roomconfig_roomname">
                                <value>A Dark Cave</value>
                            </field>
                            <field label="Short Description of Room" type="text-single" var="muc#roomconfig_roomdesc">
                                <value>The place for all good witches!</value>
                            </field>
                            <field label="Enable Public Logging?" type="boolean" var="muc#roomconfig_enablelogging">
                                <value>0</value>
                            </field>
                            <field label="Allow Occupants to Change Subject?" type="boolean" var="muc#roomconfig_changesubject">
                                <value>0</value>
                            </field>
                            <field label="Allow Occupants to Invite Others?" type="boolean" var="muc#roomconfig_allowinvites">
                                <value>0</value>
                            </field>
                            <field label="Who Can Send Private Messages?" type="list-single" var="muc#roomconfig_allowpm">
                                <value>anyone</value>
                                <option label="Anyone">
                                    <value>anyone</value>
                                </option>
                                <option label="Anyone with Voice">
                                    <value>participants</value>
                                </option>
                                <option label="Moderators Only">
                                    <value>moderators</value>
                                </option>
                                <option label="Nobody">
                                    <value>none</value>
                                </option>
                            </field>
                            <field label="Roles for which Presence is Broadcasted"
                                    type="list-multi"
                                    var="muc#roomconfig_presencebroadcast">
                                <value>moderator</value>
                                <value>participant</value>
                                <value>visitor</value>
                                <option label="Moderator">
                                    <value>moderator</value>
                                </option>
                                <option label="Participant">
                                    <value>participant</value>
                                </option>
                                <option label="Visitor">
                                    <value>visitor</value>
                                </option>
                            </field>
                            <field label="Roles and Affiliations that May Retrieve Member List"
                                    type="list-multi"
                                    var="muc#roomconfig_getmemberlist">
                                <value>moderator</value>
                                <value>participant</value>
                                <value>visitor</value>
                                <option label="Moderator">
                                    <value>moderator</value>
                                </option>
                                <option label="Participant">
                                    <value>participant</value>
                                </option>
                                <option label="Visitor">
                                    <value>visitor</value>
                                </option>
                            </field>
                            <field label="Make Room Publicly Searchable?" type="boolean" var="muc#roomconfig_publicroom">
                                <value>0</value>
                            </field>
                            <field label="Make Room Persistent?" type="boolean" var="muc#roomconfig_persistentroom">
                                <value>0</value>
                            </field>
                            <field label="Make Room Moderated?" type="boolean" var="muc#roomconfig_moderatedroom">
                                <value>0</value>
                            </field>
                            <field label="Make Room Members Only?" type="boolean" var="muc#roomconfig_membersonly">
                                <value>0</value>
                            </field>
                            <field label="Password Required for Entry?" type="boolean" var="muc#roomconfig_passwordprotectedroom">
                                <value>1</value>
                            </field>
                            <field type="fixed">
                                <value>If a password is required to enter this groupchat, you must specify the password below.</value>
                            </field>
                            <field label="Password" type="text-private" var="muc#roomconfig_roomsecret">
                                <value>cauldronburn</value>
                            </field>
                        </x>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(config_stanza));

            const modal = _converse.api.modal.get('converse-muc-config-modal');

            const membersonly = await u.waitUntil(() => modal.querySelector('input[name="muc#roomconfig_membersonly"]'));
            expect(membersonly.getAttribute('type')).toBe('checkbox');
            membersonly.checked = true;

            const moderated = modal.querySelectorAll('input[name="muc#roomconfig_moderatedroom"]');
            expect(moderated.length).toBe(1);
            expect(moderated[0].getAttribute('type')).toBe('checkbox');
            moderated[0].checked = true;

            const password = modal.querySelectorAll('input[name="muc#roomconfig_roomsecret"]');
            expect(password.length).toBe(1);
            expect(password[0].getAttribute('type')).toBe('password');

            const allowpm = modal.querySelectorAll('select[name="muc#roomconfig_allowpm"]');
            expect(allowpm.length).toBe(1);
            allowpm[0].value = 'moderators';

            const presencebroadcast = modal.querySelectorAll('select[name="muc#roomconfig_presencebroadcast"]');
            expect(presencebroadcast.length).toBe(1);
            presencebroadcast[0].value = ['moderator'];

            // Set image file for avatar upload
            const avatar_picker = modal.querySelector('converse-image-picker input[type="file"]');
            const image_file = new File([_converse.default_avatar_image], 'avatar.svg', {
                type: _converse.default_avatar_image_type,
                lastModified: new Date(),
            });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(image_file);
            avatar_picker.files = dataTransfer.files;

            modal.querySelector('.chatroom-form input[type="submit"]').click();

            expect(sent_IQ).toEqualStanza(stx`
                <iq id="${IQ_id}" to="${muc_jid}" type="set" xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/muc#owner">
                        <x type="submit" xmlns="jabber:x:data">
                            <field var="FORM_TYPE"><value>http://jabber.org/protocol/muc#roomconfig</value></field>
                            <field var="muc#roomconfig_roomname"><value>A Dark Cave</value></field>
                            <field var="muc#roomconfig_roomdesc"><value>The place for all good witches!</value></field>
                            <field var="muc#roomconfig_enablelogging"><value>0</value></field>
                            <field var="muc#roomconfig_changesubject"><value>0</value></field>
                            <field var="muc#roomconfig_allowinvites"><value>0</value></field>
                            <field var="muc#roomconfig_allowpm"><value>moderators</value></field>
                            <field var="muc#roomconfig_presencebroadcast"><value>moderator</value></field>
                            <field var="muc#roomconfig_getmemberlist"><value>moderator</value>,<value>participant</value>,<value>visitor</value></field>
                            <field var="muc#roomconfig_publicroom"><value>0</value></field>
                            <field var="muc#roomconfig_persistentroom"><value>0</value></field>
                            <field var="muc#roomconfig_moderatedroom"><value>1</value></field>
                            <field var="muc#roomconfig_membersonly"><value>1</value></field>
                            <field var="muc#roomconfig_passwordprotectedroom"><value>1</value></field>
                            <field var="muc#roomconfig_roomsecret"><value>cauldronburn</value></field>
                        </x>
                    </query>
                </iq>`);
        }));

        it("properly handles notification that a room has been destroyed",
                mock.initConverse([], {}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'problematic@muc.montague.lit';
            api.rooms.open(muc_jid, { nick: 'romeo' });
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            const presence =
                stx`<presence from="problematic@muc.montague.lit"
                        id="n13mt3l"
                        type="error"
                        to="romeo@montague.lit/pda"
                        xmlns="jabber:client">
                    <error type="cancel">
                        <gone xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">xmpp:other-room@chat.jabberfr.org?join</gone>
                        <text xmlns="urn:ietf:params:xml:ns:xmpp-stanzas">We didn't like the name</text>
                    </error>
                </presence>`;

            const view = await u.waitUntil(() => _converse.chatboxviews.get('problematic@muc.montague.lit'));
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            const msg = await u.waitUntil(() => view.querySelector('.chatroom-body .disconnect-msg'));
            expect(msg.textContent.trim()).toBe('This groupchat no longer exists');
            expect(view.querySelector('.chatroom-body .destroyed-reason').textContent.trim())
                .toBe(`The following reason was given: "We didn't like the name"`);
            expect(view.querySelector('.chatroom-body .moved-label').textContent.trim())
                .toBe('The conversation has moved to a new address. Click the link below to enter.');
            expect(view.querySelector('.chatroom-body .moved-link').textContent.trim())
                .toBe(`other-room@chat.jabberfr.org`);
        }));

        it("allows the user to invite their roster contacts to enter the groupchat",
                mock.initConverse(['chatBoxesFetched'], {'view_mode': 'overlayed'}, async function (_converse) {

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
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo', features);
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
            const modal = _converse.api.modal.get('converse-muc-invite-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000)

            expect(modal.querySelectorAll('#invitee_jids').length).toBe(1);
            expect(modal.querySelectorAll('textarea').length).toBe(1);

            spyOn(view.model, 'directInvite').and.callThrough();

            const input = modal.querySelector('#invitee_jids input');
            input.value = "Balt";
            modal.querySelector('input[type="submit"]').click();

            await u.waitUntil(() => modal.querySelector('.error'));

            const error = modal.querySelector('.error');
            expect(error.textContent).toBe('Please enter a valid XMPP address');

            let evt = new Event('input');
            input.dispatchEvent(evt);

            let sent_stanza;
            spyOn(_converse.api.connection.get(), 'send').and.callFake(stanza => (sent_stanza = stanza));
            const hint = await u.waitUntil(() => modal.querySelector('.suggestion-box__results li'));
            expect(input.value).toBe('Balt');
            expect(hint.textContent.trim()).toBe('Balthasar');

            evt = new Event('mousedown', {'bubbles': true});
            evt.button = 0;
            hint.dispatchEvent(evt);

            const textarea = modal.querySelector('textarea');
            textarea.value = "Please join!";
            modal.querySelector('input[type="submit"]').click();

            expect(view.model.directInvite).toHaveBeenCalled();
            expect(sent_stanza).toEqualStanza(stx`
                <message id="${sent_stanza.getAttribute("id")}"
                        to="balthasar@montague.lit"
                        xmlns="jabber:client">
                    <x jid="lounge@montague.lit" reason="Please join!" xmlns="jabber:x:conference"/>
                </message>`
            );
        }));

        it("can be joined automatically, based on a received invite",
                mock.initConverse([], { lazy_load_vcards: false }, async function (_converse) {

            await mock.waitForRoster(_converse, 'current'); // We need roster contacts, who can invite us
            const muc_jid = 'lounge@montague.lit';
            const name = mock.cur_names[0];
            const from_jid = name.replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await u.waitUntil(() => _converse.roster.get(from_jid).vcard.get('fullname'));

            spyOn(_converse.api, 'confirm').and.callFake(() => Promise.resolve(true));
            expect(_converse.chatboxes.models.length).toBe(1);
            expect(_converse.chatboxes.models[0].id).toBe("controlbox");

            const reason = "Please join this groupchat";
            const stanza = stx`
                <message xmlns="jabber:client"
                        to="${_converse.bare_jid}"
                        from="${from_jid}"
                        id="9bceb415-f34b-4fa4-80d5-c0d076a24231">
                   <x xmlns="jabber:x:conference" jid="${muc_jid}" reason="${reason}"/>
                </message>`.tree();
            const promise = _converse.onDirectMUCInvitation(stanza);
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, 'romeo');
            await mock.receiveOwnMUCPresence(_converse, muc_jid, 'romeo');
            await promise;
            expect(_converse.api.confirm).toHaveBeenCalledWith(
                'Invitation to a groupchat',
                `Mercutio has invited you to join the groupchat "${muc_jid}", and left the following reason: "${reason}"`
            );
            expect(_converse.chatboxes.models.length).toBe(2);
            expect(_converse.chatboxes.models[0].id).toBe('controlbox');
            expect(_converse.chatboxes.models[1].id).toBe(muc_jid);
        }));

        it("shows received groupchat messages",
                mock.initConverse([], {}, async function (_converse) {

            const text = 'This is a received message';
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            spyOn(_converse.api, "trigger").and.callThrough();
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            const nick = mock.chatroom_names[0];
            view.model.occupants.create({
                'nick': nick,
                'muc_jid': `${view.model.get('jid')}/${nick}`
            });

            const message =
                stx`<message
                        from="lounge@montague.lit/${nick}"
                        id="1"
                        to="romeo@montague.lit"
                        type="groupchat"
                        xmlns="jabber:client">
                    <body>${text}</body>
                </message>`;
            await view.model.handleMessageStanza(message.tree());
            await u.waitUntil(() => view.querySelectorAll('.chat-msg').length);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            expect(view.querySelector('.chat-msg__text').textContent.trim()).toBe(text);
            expect(_converse.api.trigger).toHaveBeenCalledWith('message', jasmine.any(Object));
        }));

        it("shows sent groupchat messages", mock.initConverse([], {}, async function (_converse) {
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            spyOn(_converse.api, "trigger").and.callThrough();
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            const text = 'This is a sent message';
            const textarea = await u.waitUntil(() => view.querySelector('.chat-textarea'));
            textarea.value = text;
            const message_form = view.querySelector('converse-muc-message-form');
            message_form.onKeyDown({
                target: textarea,
                preventDefault: function preventDefault () {},
                key: "Enter",
            });
            await u.waitUntil(() => view.querySelectorAll('.chat-msg__text').length);

            expect(_converse.api.trigger).toHaveBeenCalledWith('sendMessage', jasmine.any(Object));
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);

            // Let's check that if we receive the same message again, it's
            // not shown.
            const stanza = stx`
                <message xmlns="jabber:client"
                        from="lounge@montague.lit/romeo"
                        to="${_converse.api.connection.get().jid}"
                        type="groupchat">
                    <body>${text}</body>
                    <stanza-id xmlns="urn:xmpp:sid:0"
                            id="5f3dbc5e-e1d3-4077-a492-693f3769c7ad"
                            by="lounge@montague.lit"/>
                    <origin-id xmlns="urn:xmpp:sid:0" id="${view.model.messages.at(0).get('origin_id')}"/>
                </message>`;
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
            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            // Create enough messages so that there's a scrollbar.
            const promises = [];
            for (let i=0; i<20; i++) {
                promises.push(
                    view.model.handleMessageStanza(
                        stx`<message from="lounge@montague.lit/someone"
                                to="romeo@montague.lit.com"
                                type="groupchat"
                                id="${u.getUniqueId()}"
                                xmlns="jabber:client">
                            <body>Message: ${i}</body>
                        </message>`
                    ));
            }
            await Promise.all(promises);
            const promise = u.getOpenPromise();

            // Give enough time for `markScrolled` to have been called
            setTimeout(async () => {
                const content = view.querySelector('.chat-content');
                content.scrollTop = 0;
                await view.model.handleMessageStanza(
                    stx`<message from="lounge@montague.lit/someone"
                                to="romeo@montague.lit.com"
                                type="groupchat"
                                id="${u.getUniqueId()}"
                                xmlns="jabber:client">
                            <body>${message}</body>
                    </message>`
                );
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
            await mock.openAndEnterMUC(_converse, 'coven@chat.shakespeare.lit', 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);

            const stanza = stx`
                <message from="${muc_jid}"
                        id="80349046-F26A-44F3-A7A6-54825064DD9E"
                        to="${_converse.jid}"
                        type="groupchat"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <status code="170"/>
                    </x>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(stanza));
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-info').length);
            const info_messages = view.querySelectorAll('.chat-content .chat-info');
            expect(info_messages[0].textContent.trim()).toBe('Groupchat logging is now enabled');
        }));

        it("queries for the groupchat information before attempting to join the user",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const nick = "some1";
            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const muc_jid = 'coven@chat.shakespeare.lit';

            _converse.api.rooms.open(muc_jid, { nick });
            const stanza = await u.waitUntil(() => IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            // Check that the groupchat queried for the feautures.
            expect(stanza).toEqualStanza(stx`
                <iq from="romeo@montague.lit/orchard"
                        id="${stanza.getAttribute("id")}"
                        to="${muc_jid}"
                        type="get"
                        xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/disco#info"/>
                </iq>`);

            const features_stanza =
                stx`<iq from="${muc_jid}"
                        id="${stanza.getAttribute('id')}"
                        to="romeo@montague.lit/desktop"
                        type="result"
                        xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/disco#info">
                        <identity category="conference" name="A Dark Cave" type="text"/>
                        <feature var="http://jabber.org/protocol/muc"/>
                        <feature var="muc_passwordprotected"/>
                        <feature var="muc_hidden"/>
                        <feature var="muc_temporary"/>
                        <feature var="muc_open"/>
                        <feature var="muc_unmoderated"/>
                        <feature var="muc_nonanonymous"/>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(features_stanza));

            let view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
            const sent_stanzas = _converse.api.connection.get().sent_stanzas;
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
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);

            const info_el = view.querySelector(".show-muc-details-modal");
            info_el.click();
            let modal = _converse.api.modal.get('converse-muc-details-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            let features_list = modal.querySelector('.features-list');
            let features_shown = Array.from(features_list.children).map((e) => e.textContent);
            expect(features_shown.length).toBe(5);

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

            modal.querySelector('.btn[aria-label="Close"]').click();
            view.querySelector('.configure-chatroom-button').click();

            const IQs = _converse.api.connection.get().IQ_stanzas;
            const s = `iq[to="${muc_jid}"] query[xmlns="${Strophe.NS.MUC_OWNER}"]`;
            let iq = await u.waitUntil(() => IQs.filter((iq) => sizzle(s, iq).length).pop());

            const response_el = stx`<iq xmlns="jabber:client"
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
                 </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(response_el));

            modal = _converse.api.modal.get('converse-muc-config-modal');
            await u.waitUntil(() => modal.querySelector('.chatroom-form input'));
            expect(modal.querySelector('.chatroom-form legend').textContent.trim()).toBe("Configuration for room@conference.example.org");
            sizzle('[name="muc#roomconfig_membersonly"]', modal).pop().click();
            sizzle('[name="muc#roomconfig_roomname"]', modal).pop().value = "New room name"
            modal.querySelector('.chatroom-form input[type="submit"]').click();

            iq = await u.waitUntil(() => IQs.filter(iq => iq.matches(`iq[to="${muc_jid}"][type="set"]`)).pop());

            const result =
                stx`<iq xmlns="jabber:client"
                        type="result"
                        to="romeo@montague.lit/orchard"
                        from="lounge@muc.montague.lit"
                        id="${iq.getAttribute('id')}"/>`;

            IQs.length = 0; // Empty the array
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));

            iq = await u.waitUntil(() => IQs.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

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

            const features_stanza =
                stx`<iq from="${muc_jid}"
                        id="${iq.getAttribute('id')}"
                        to="romeo@montague.lit/desktop"
                        type="result"
                        xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/disco#info">
                        <identity category="conference" name="New room name" type="text"/>
                        ${features.map(f => stx`<feature var="${f}"/>`)}
                        <x xmlns="jabber:x:data" type="result">
                            <field var="FORM_TYPE" type="hidden">
                                <value>http://jabber.org/protocol/muc#roominfo</value>
                            </field>
                            <field type="text-single" var="muc#roominfo_description" label="Description">
                                <value>This is the description</value>
                            </field>
                            <field type="text-single" var="muc#roominfo_occupants" label="Number of occupants">
                                <value>0</value>
                            </field>
                        </x>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(features_stanza));

            await u.waitUntil(() => new Promise(success => view.model.features.on('change', success)));

            info_el.click();
            modal = _converse.api.modal.get('converse-muc-details-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);

            features_list = modal.querySelector('.features-list');
            features_shown = Array.from(features_list.children).map((e) => e.textContent);
            expect(features_shown.length).toBe(6);

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

            await mock.openAndEnterMUC(_converse, 'coven@chat.shakespeare.lit', 'some1');
            const message =
                stx`<message xmlns="jabber:client"
                        type="groupchat"
                        to="romeo@montague.lit/_converse.js-27854181"
                        from="coven@chat.shakespeare.lit">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <status code="104"/>
                        <status code="172"/>
                    </x>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));

            const view = _converse.chatboxviews.get('coven@chat.shakespeare.lit');
            await u.waitUntil(() => view.querySelectorAll('.chat-content .chat-info').length);
            const chat_body = view.querySelector('.chatroom-body');
            expect(sizzle('.message:last', chat_body).pop().textContent.trim())
                .toBe('This groupchat is now no longer anonymous');
        }));

        it("informs users if they have been kicked out of the groupchat",
                mock.initConverse([], {}, async function (_converse) {

            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');
            const view = _converse.chatboxviews.get('lounge@montague.lit');
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.ENTERED);

            const presence =
                stx`<presence from='lounge@montague.lit/romeo'
                        to='romeo@montague.lit/pda'
                        type='unavailable'
                        xmlns="jabber:client">
                    <x xmlns='http://jabber.org/protocol/muc#user'>
                        <item affiliation='none' jid='romeo@montague.lit/pda' role='none'>
                            <actor nick='Fluellen'/>
                            <reason>Avaunt, you cullion!</reason>
                        </item>
                        <status code='110'/>
                        <status code='307'/>
                    </x>
                </presence>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

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

            await mock.openAndEnterMUC(_converse, 'lounge@montague.lit', 'romeo');

            const presence =
                    stx`<presence from='lounge@montague.lit/romeo'
                            to='romeo@montague.lit/pda'
                            type='unavailable'
                            xmlns="jabber:client">
                    <x xmlns='http://jabber.org/protocol/muc#user'>
                        <item affiliation='none' jid='romeo@montague.lit/pda' role='none'>
                            <reason>Flux capacitor overload!</reason>
                        </item>
                        <status code='110'/>
                        <status code='333'/>
                        <status code='307'/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

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

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');

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

            const muc_jid = 'lounge@montague.lit';
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
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
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            let presence =
                stx`<presence from='lounge@montague.lit/annoyingGuy'
                            id='27C55F89-1C6A-459A-9EB5-77690145D624'
                            to='romeo@montague.lit/desktop'
                            xmlns="jabber:client">
                    <x xmlns='http://jabber.org/protocol/muc#user'>
                        <item jid='annoyingguy@montague.lit' affiliation='member' role='participant'/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo and annoyingGuy have entered the groupchat");

            presence =
                stx`<presence from='lounge@montague.lit/annoyingGuy'
                            to='romeo@montague.lit/desktop'
                            xmlns="jabber:client">
                        <x xmlns='http://jabber.org/protocol/muc#user'>
                            <item jid='annoyingguy@montague.lit' affiliation='member' role='visitor'/>
                        </x>
                    </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo has entered the groupchat\nannoyingGuy has been muted");

            presence =
                stx`<presence from='lounge@montague.lit/annoyingGuy'
                            to='romeo@montague.lit/desktop'
                            xmlns="jabber:client">
                        <x xmlns='http://jabber.org/protocol/muc#user'>
                            <item jid='annoyingguy@montague.lit' affiliation='member' role='participant'/>
                        </x>
                    </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chat-content__notifications').textContent.trim() ===
                "romeo has entered the groupchat\nannoyingGuy has been given a voice");

            // Check that we don't see an info message concerning the role,
            // if the affiliation has changed.
            presence =
                    stx`<presence from='lounge@montague.lit/annoyingGuy'
                            to='romeo@montague.lit/desktop'
                            xmlns="jabber:client">
                        <x xmlns='http://jabber.org/protocol/muc#user'>
                            <item jid='annoyingguy@montague.lit' affiliation='none' role='visitor'/>
                        </x>
                    </presence>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() =>
                Array.from(view.querySelectorAll('.chat-info__message')).pop()?.textContent.trim() ===
                "annoyingGuy is no longer a member of this groupchat"
            );
            expect(1).toBe(1);
        }));

        it("notifies users of role and affiliation changes for members not currently in the groupchat",
                mock.initConverse([], {}, async function (_converse) {

            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);

            let message =
                stx`<message from="lounge@montague.lit"
                        id="2CF9013B-E8A8-42A1-9633-85AD7CA12F40"
                        to="romeo@montague.lit"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item jid="absentguy@montague.lit" affiliation="member" role="none"/>
                    </x>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));
            await u.waitUntil(() => view.model.occupants.length > 1);
            expect(view.model.occupants.length).toBe(2);
            expect(view.model.occupants.findWhere({'jid': 'absentguy@montague.lit'}).get('affiliation')).toBe('member');

            message =
                stx`<message from="lounge@montague.lit"
                    id="2CF9013B-E8A8-42A1-9633-85AD7CA12F41"
                    to="romeo@montague.lit"
                    xmlns="jabber:client">
                <x xmlns="http://jabber.org/protocol/muc#user">
                    <item jid="absentguy@montague.lit" affiliation="none" role="none"/>
                </x>
            </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(message));
            expect(view.model.occupants.length).toBe(2);
            expect(view.model.occupants.findWhere({'jid': 'absentguy@montague.lit'}).get('affiliation')).toBe('none');
        }));
    });

    describe("When attempting to enter a groupchat", function () {

        it("will show an error message if the groupchat requires a password",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'protected@montague.lit';
            api.rooms.open(muc_jid, { nick: 'romeo' });
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            const presence =
                    stx`<presence from="${muc_jid}/romeo"
                            id="${u.getUniqueId()}"
                            to="romeo@montague.lit/pda"
                            type="error"
                            xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc"/>
                        <error by="lounge@montague.lit" type="auth">
                            <not-authorized xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        </error>
                    </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
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

            const { api } = _converse;
            const muc_jid = 'members-only@muc.montague.lit'
            api.rooms.open(muc_jid, { nick: 'romeo' });

            const iq = await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            expect(iq).toEqualStanza(stx`
                <iq from="romeo@montague.lit/orchard" to="${muc_jid}" type="get" xmlns="jabber:client" id="${iq.getAttribute('id')}">
                    <query xmlns="http://jabber.org/protocol/disco#info"/>
                </iq>`);

            // State that the chat is members-only via the features IQ
            const features_stanza =
                stx`<iq from="${muc_jid}"
                        id="${iq.getAttribute('id')}"
                        to="romeo@montague.lit/desktop"
                        type="result"
                        xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/disco#info">
                        <identity category="conference" name="A Dark Cave" type="text"/>
                        <feature var="http://jabber.org/protocol/muc"/>
                        <feature var="muc_hidden"/>
                        <feature var="muc_temporary"/>
                        <feature var="muc_membersonly"/>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(features_stanza));

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);

            const presence =
                stx`<presence from="${muc_jid}/romeo"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit/pda"
                        type="error"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc"/>
                    <error by="lounge@montague.lit" type="auth">
                        <registration-required xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </presence>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child')?.textContent?.trim() ===
                'You are not on the member list of this groupchat.');
        }));

        it("will show an error message if the user has been banned",
                mock.initConverse([], {}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'off-limits@muc.montague.lit'
            api.rooms.open(muc_jid, { nick: 'romeo' });

            const iq = await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            const features_stanza =
                stx`<iq from="${muc_jid}"
                            id="${iq.getAttribute('id')}"
                            to="romeo@montague.lit/desktop"
                            type="result"
                            xmlns="jabber:client">
                        <query xmlns="http://jabber.org/protocol/disco#info">
                            <identity category="conference" name="A Dark Cave" type="text"/>
                            <feature var="http://jabber.org/protocol/muc"/>
                            <feature var="muc_hidden"/>
                            <feature var="muc_temporary"/>
                        </query>
                    </iq>`
            _converse.api.connection.get()._dataRecv(mock.createRequest(features_stanza));

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            await u.waitUntil(() => view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING);

            const presence =
                    stx`<presence
                            from="${muc_jid}/romeo"
                            id="${u.getUniqueId()}"
                            to="romeo@montague.lit/pda"
                            type="error"
                            xmlns="jabber:client">
                        <x xmlns="http://jabber.org/protocol/muc"/>
                        <error by="lounge@montague.lit" type="auth">
                            <forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        </error>
                    </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe('You have been banned from this groupchat');
            expect(view.model.session.get('connection_status')).toBe(converse.ROOMSTATUS.BANNED);
        }));

        it("will show an error message if the user is not allowed to have created the groupchat",
                mock.initConverse([], {}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'impermissable@muc.montague.lit'
            api.rooms.open(muc_jid, { nick: 'romeo' });
            await mock.waitForNewMUCDiscoInfo(_converse, muc_jid);

            const presence =
                stx`<presence xmlns="jabber:client"
                        from="${muc_jid}/romeo"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit/pda"
                        type="error">
                    <x xmlns="http://jabber.org/protocol/muc"/>
                    <error by="lounge@montague.lit" type="cancel">
                        <not-allowed xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));

            const sent_IQs = _converse.api.connection.get().IQ_stanzas;
            while (sent_IQs.length) sent_IQs.pop();
            await mock.waitForMUCDiscoInfo(_converse, muc_jid);

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe('You are not allowed to create new groupchats.');
        }));

        it("will show an error message if the groupchat doesn't yet exist",
                mock.initConverse([], {}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'nonexistent@muc.montague.lit'
            api.rooms.open(muc_jid, { nick: 'romeo' });

            const iq = await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            const features_stanza =
                stx`<iq xmlns="jabber:client"
                        from="${muc_jid}"
                        id="${iq.getAttribute('id')}"
                        to="romeo@montague.lit/desktop"
                        type="result">
                    <query xmlns="http://jabber.org/protocol/disco#info">
                        <identity category="conference" name="A Dark Cave" type="text"/>
                        <feature var="http://jabber.org/protocol/muc"/>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(features_stanza));

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

            const presence =
                stx`<presence xmlns="jabber:client"
                        from="${muc_jid}/romeo"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit/pda"
                        type="error">
                    <x xmlns="http://jabber.org/protocol/muc"/>
                    <error by="lounge@montague.lit" type="cancel">
                        <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </presence>`;

            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe("This groupchat does not (yet) exist.");
        }));

        it("will show an error message if the groupchat has reached its maximum number of participants",
                mock.initConverse([], {}, async function (_converse) {

            const { api } = _converse;
            const muc_jid = 'maxed-out@muc.montague.lit'
            api.rooms.open(muc_jid, { nick: 'romeo' });

            const iq = await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.filter(
                iq => iq.querySelector(
                    `iq[to="${muc_jid}"] query[xmlns="http://jabber.org/protocol/disco#info"]`
                )).pop());

            const features_stanza =
                stx`<iq from="${muc_jid}"
                        id="${iq.getAttribute('id')}"
                        to="romeo@montague.lit/desktop"
                        type="result"
                        xmlns="jabber:client">
                    <query xmlns="http://jabber.org/protocol/disco#info">
                        <identity category="conference" name="A Dark Cave" type="text"/>
                        <feature var="http://jabber.org/protocol/muc"/>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(features_stanza));

            const view = await u.waitUntil(() => _converse.chatboxviews.get(muc_jid));
            await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.CONNECTING));

            const presence =
                stx`<presence xmlns="jabber:client"
                        from="${muc_jid}/romeo"
                        id="${u.getUniqueId()}"
                        to="romeo@montague.lit/pda"
                        type="error">
                    <x xmlns="http://jabber.org/protocol/muc"/>
                    <error by="lounge@montague.lit" type="cancel">
                        <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
            const el = await u.waitUntil(() => view.querySelector('.chatroom-body converse-muc-disconnected .disconnect-msg:last-child'));
            expect(el.textContent.trim()).toBe("This groupchat has reached its maximum number of participants.");
        }));
    });


    describe("The affiliations delta", function () {

        it("can be computed in various ways", mock.initConverse([], {}, async function (_converse) {
            const { api } = _converse;
            const muc_jid = 'coven@chat.shakespeare.lit';
            api.rooms.open(muc_jid, { nick: 'romeo' });

            let exclude_existing = false;
            let remove_absentees = false;
            let new_list = [];
            let old_list = [];
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
});
