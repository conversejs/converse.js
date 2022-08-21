/* global mock, converse */

const { Strophe, sizzle } = converse.env;


describe("A chat room", function () {

    it("can be bookmarked", mock.initConverse(['chatBoxesFetched'], {}, async (_converse) => {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );

        const { u, $iq } = converse.env;
        const nick = 'JC';
        const muc_jid = 'theplay@conference.shakespeare.lit';
        await mock.openChatRoom(_converse, 'theplay', 'conference.shakespeare.lit', 'JC');
        await mock.getRoomFeatures(_converse, muc_jid, []);
        await mock.waitForReservedNick(_converse, muc_jid, nick);
        await mock.receiveOwnMUCPresence(_converse, muc_jid, nick);
        const view = _converse.chatboxviews.get(muc_jid);
        await u.waitUntil(() => (view.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED));
        await mock.returnMemberLists(_converse, muc_jid, [], ['member', 'admin', 'owner']);

        await u.waitUntil(() => view.querySelector('.toggle-bookmark') !== null);

        const toggle = view.querySelector('.toggle-bookmark');
        expect(toggle.title).toBe('Bookmark this groupchat');
        toggle.click();

        const modal = _converse.api.modal.get('converse-bookmark-form-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);

        /* Client uploads data:
         * --------------------
         *  <iq from='juliet@capulet.lit/balcony' type='set' id='pip1'>
         *      <pubsub xmlns='http://jabber.org/protocol/pubsub'>
         *          <publish node='storage:bookmarks'>
         *              <item id='current'>
         *                  <storage xmlns='storage:bookmarks'>
         *                      <conference name='The Play&apos;s the Thing'
         *                                  autojoin='true'
         *                                  jid='theplay@conference.shakespeare.lit'>
         *                          <nick>JC</nick>
         *                      </conference>
         *                  </storage>
         *              </item>
         *          </publish>
         *          <publish-options>
         *              <x xmlns='jabber:x:data' type='submit'>
         *                  <field var='FORM_TYPE' type='hidden'>
         *                      <value>http://jabber.org/protocol/pubsub#publish-options</value>
         *                  </field>
         *                  <field var='pubsub#persist_items'>
         *                      <value>true</value>
         *                  </field>
         *                  <field var='pubsub#access_model'>
         *                      <value>whitelist</value>
         *                  </field>
         *              </x>
         *          </publish-options>
         *      </pubsub>
         *  </iq>
         */
        expect(view.model.get('bookmarked')).toBeFalsy();
        const form = await u.waitUntil(() => modal.querySelector('.chatroom-form'));
        form.querySelector('input[name="name"]').value = 'Play&apos;s the Thing';
        form.querySelector('input[name="autojoin"]').checked = 'checked';
        form.querySelector('input[name="nick"]').value = 'JC';

        const IQ_stanzas = _converse.connection.IQ_stanzas;
        modal.querySelector('converse-muc-bookmark-form .btn-primary').click();

        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('iq publish[node="storage:bookmarks"]', s).length).pop());
        expect(Strophe.serialize(sent_stanza)).toBe(
            `<iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                    `<publish node="storage:bookmarks">`+
                        `<item id="current">`+
                            `<storage xmlns="storage:bookmarks">`+
                                `<conference autojoin="true" jid="theplay@conference.shakespeare.lit" name="Play&amp;apos;s the Thing">`+
                                    `<nick>JC</nick>`+
                                `</conference>`+
                            `</storage>`+
                        `</item>`+
                    `</publish>`+
                    `<publish-options>`+
                        `<x type="submit" xmlns="jabber:x:data">`+
                            `<field type="hidden" var="FORM_TYPE">`+
                                `<value>http://jabber.org/protocol/pubsub#publish-options</value>`+
                            `</field>`+
                            `<field var="pubsub#persist_items">`+
                                `<value>true</value>`+
                            `</field>`+
                            `<field var="pubsub#access_model">`+
                                `<value>whitelist</value>`+
                            `</field>`+
                        `</x>`+
                    `</publish-options>`+
                `</pubsub>`+
            `</iq>`
        );
        /* Server acknowledges successful storage
         *
         * <iq to='juliet@capulet.lit/balcony' type='result' id='pip1'/>
         */
        const stanza = $iq({
            'to':_converse.connection.jid,
            'type':'result',
            'id': sent_stanza.getAttribute('id')
        });
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => view.model.get('bookmarked'));
        expect(view.model.get('bookmarked')).toBeTruthy();
        await u.waitUntil(() => view.querySelector('.toggle-bookmark')?.title === 'Unbookmark this groupchat');
        expect(u.hasClass('on-button', view.querySelector('.toggle-bookmark')), true);
        // We ignore this IQ stanza... (unless it's an error stanza), so
        // nothing to test for here.
    }));


    it("will be automatically opened if 'autojoin' is set on the bookmark", mock.initConverse(
            ['chatBoxesFetched'], {}, async function (_converse) {

        const { u } = converse.env;
        const { api } = _converse;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );
        await u.waitUntil(() => _converse.bookmarks);
        let jid = 'lounge@montague.lit';
        _converse.bookmarks.create({
            'jid': jid,
            'autojoin': false,
            'name':  'The Lounge',
            'nick': ' Othello'
        });
        expect(_converse.chatboxviews.get(jid) === undefined).toBeTruthy();

        jid = 'theplay@conference.shakespeare.lit';
        _converse.bookmarks.create({
            'jid': jid,
            'autojoin': true,
            'name':  'The Play',
            'nick': ' Othello'
        });
        await new Promise(resolve => _converse.api.listen.once('chatRoomViewInitialized', resolve));
        expect(!!_converse.chatboxviews.get(jid)).toBe(true);

        // Check that we don't auto-join if muc_respect_autojoin is false
        api.settings.set('muc_respect_autojoin', false);
        jid = 'balcony@conference.shakespeare.lit';
        _converse.bookmarks.create({
            'jid': jid,
            'autojoin': true,
            'name':  'Balcony',
            'nick': ' Othello'
        });
        expect(_converse.chatboxviews.get(jid) === undefined).toBe(true);
    }));


    describe("when bookmarked", function () {

        it("will use the nickname from the bookmark", mock.initConverse([], {}, async function (_converse) {
            const { u } = converse.env;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            const muc_jid = 'coven@chat.shakespeare.lit';
            _converse.bookmarks.create({
                'jid': muc_jid,
                'autojoin': false,
                'name':  'The Play',
                'nick': 'Othello'
            });
            spyOn(_converse.ChatRoom.prototype, 'getAndPersistNickname').and.callThrough();
            const room_creation_promise = _converse.api.rooms.open(muc_jid);
            await mock.getRoomFeatures(_converse, muc_jid);
            const room = await room_creation_promise;
            await u.waitUntil(() => room.getAndPersistNickname.calls.count());
            expect(room.get('nick')).toBe('Othello');
        }));

        it("displays that it's bookmarked through its bookmark icon", mock.initConverse([], {}, async function (_converse) {

            const { u } = converse.env;
            await mock.waitForRoster(_converse, 'current', 0);
            mock.waitUntilDiscoConfirmed(
                _converse, _converse.bare_jid,
                [{'category': 'pubsub', 'type': 'pep'}],
                ['http://jabber.org/protocol/pubsub#publish-options']
            );

            const nick = 'romeo';
            const muc_jid = 'lounge@montague.lit';
            await _converse.api.rooms.open(muc_jid);
            await mock.getRoomFeatures(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, nick);

            const view = _converse.chatboxviews.get('lounge@montague.lit');
            expect(view.querySelector('.chatbox-title__text .fa-bookmark')).toBe(null);
            _converse.bookmarks.create({
                'jid': view.model.get('jid'),
                'autojoin': false,
                'name':  'The lounge',
                'nick': ' some1'
            });
            view.model.set('bookmarked', true);
            await u.waitUntil(() => view.querySelector('.chatbox-title__text .fa-bookmark') !== null);
            view.model.set('bookmarked', false);
            await u.waitUntil(() => view.querySelector('.chatbox-title__text .fa-bookmark') === null);
        }));

        it("can be unbookmarked", mock.initConverse([], {}, async function (_converse) {
            const { u, Strophe } = converse.env;
            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            const nick = 'romeo';
            const muc_jid = 'theplay@conference.shakespeare.lit';
            await _converse.api.rooms.open(muc_jid);
            await mock.getRoomFeatures(_converse, muc_jid);
            await mock.waitForReservedNick(_converse, muc_jid, nick);

            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('.toggle-bookmark'));

            spyOn(view, 'showBookmarkModal').and.callThrough();
            spyOn(_converse.bookmarks, 'sendBookmarkStanza').and.callThrough();

            _converse.bookmarks.create({
                'jid': view.model.get('jid'),
                'autojoin': false,
                'name':  'The Play',
                'nick': 'Othello'
            });

            expect(_converse.bookmarks.length).toBe(1);
            await u.waitUntil(() => _converse.chatboxes.length >= 1);
            expect(view.model.get('bookmarked')).toBeTruthy();
            await u.waitUntil(() => view.querySelector('.chatbox-title__text .fa-bookmark') !== null);
            spyOn(_converse.connection, 'getUniqueId').and.callThrough();
            const bookmark_icon = view.querySelector('.toggle-bookmark');
            bookmark_icon.click();
            expect(view.showBookmarkModal).toHaveBeenCalled();

            const modal = _converse.api.modal.get('converse-bookmark-form-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);
            const form = await u.waitUntil(() => modal.querySelector('.chatroom-form'));

            expect(form.querySelector('input[name="name"]').value).toBe('The Play');
            expect(form.querySelector('input[name="autojoin"]').checked).toBeFalsy();
            expect(form.querySelector('input[name="nick"]').value).toBe('Othello');

            // Remove the bookmark
            modal.querySelector('.button-remove').click();

            await u.waitUntil(() => view.querySelector('.chatbox-title__text .fa-bookmark') === null);
            expect(_converse.bookmarks.length).toBe(0);

            // Check that an IQ stanza is sent out, containing no
            // conferences to bookmark (since we removed the one and
            // only bookmark).
            const sent_stanza = _converse.connection.IQ_stanzas.pop();
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}" type="set" xmlns="jabber:client">`+
                    `<pubsub xmlns="http://jabber.org/protocol/pubsub">`+
                        `<publish node="storage:bookmarks">`+
                            `<item id="current">`+
                                `<storage xmlns="storage:bookmarks"/>`+
                            `</item>`+
                        `</publish>`+
                        `<publish-options>`+
                            `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>http://jabber.org/protocol/pubsub#publish-options</value>`+
                                `</field>`+
                                `<field var="pubsub#persist_items">`+
                                    `<value>true</value>`+
                                `</field>`+
                                `<field var="pubsub#access_model">`+
                                    `<value>whitelist</value>`+
                                `</field>`+
                            `</x>`+
                        `</publish-options>`+
                    `</pubsub>`+
                `</iq>`
            );
        }));
    });

    describe("and when autojoin is set", function () {

        it("will be be opened and joined automatically upon login", mock.initConverse(
                [], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current', 0);
            await mock.waitUntilBookmarksReturned(_converse);
            spyOn(_converse.api.rooms, 'create').and.callThrough();
            const jid = 'theplay@conference.shakespeare.lit';
            const model = _converse.bookmarks.create({
                'jid': jid,
                'autojoin': false,
                'name':  'The Play',
                'nick': ''
            });
            expect(_converse.api.rooms.create).not.toHaveBeenCalled();
            _converse.bookmarks.remove(model);
            _converse.bookmarks.create({
                'jid': jid,
                'autojoin': true,
                'name':  'Hamlet',
                'nick': ''
            });
            expect(_converse.api.rooms.create).toHaveBeenCalled();
        }));
    });
});

describe("Bookmarks", function () {

    it("can be pushed from the XMPP server", mock.initConverse(
            ['connected', 'chatBoxesFetched'], {}, async function (_converse) {

        const { $msg, u } = converse.env;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilBookmarksReturned(_converse);

        /* The stored data is automatically pushed to all of the user's
         * connected resources.
         *
         * Publisher receives event notification
         * -------------------------------------
         * <message from='juliet@capulet.lit'
         *         to='juliet@capulet.lit/balcony'
         *         type='headline'
         *         id='rnfoo1'>
         * <event xmlns='http://jabber.org/protocol/pubsub#event'>
         *     <items node='storage:bookmarks'>
         *     <item id='current'>
         *         <storage xmlns='storage:bookmarks'>
         *         <conference name='The Play&apos;s the Thing'
         *                     autojoin='true'
         *                     jid='theplay@conference.shakespeare.lit'>
         *             <nick>JC</nick>
         *         </conference>
         *         </storage>
         *     </item>
         *     </items>
         * </event>
         * </message>
         */
        let stanza = $msg({
            'from': 'romeo@montague.lit',
            'to': _converse.jid,
            'type': 'headline',
            'id': u.getUniqueId()
        }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
            .c('items', {'node': 'storage:bookmarks'})
                .c('item', {'id': 'current'})
                    .c('storage', {'xmlns': 'storage:bookmarks'})
                        .c('conference', {
                            'name': 'The Play&apos;s the Thing',
                            'autojoin': 'true',
                            'jid':'theplay@conference.shakespeare.lit'
                        }).c('nick').t('JC').up().up()
                        .c('conference', {
                            'name': 'Another bookmark',
                            'autojoin': 'false',
                            'jid':'another@conference.shakespeare.lit'
                        }).c('nick').t('JC');
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.bookmarks.length);
        expect(_converse.bookmarks.length).toBe(2);
        expect(_converse.bookmarks.map(b => b.get('name'))).toEqual(['Another bookmark', 'The Play&apos;s the Thing']);
        expect(_converse.chatboxviews.get('theplay@conference.shakespeare.lit')).not.toBeUndefined();

        stanza = $msg({
            'from': 'romeo@montague.lit',
            'to': _converse.jid,
            'type': 'headline',
            'id': u.getUniqueId()
        }).c('event', {'xmlns': 'http://jabber.org/protocol/pubsub#event'})
            .c('items', {'node': 'storage:bookmarks'})
                .c('item', {'id': 'current'})
                    .c('storage', {'xmlns': 'storage:bookmarks'})
                        .c('conference', {
                            'name': 'The Play&apos;s the Thing',
                            'autojoin': 'true',
                            'jid':'theplay@conference.shakespeare.lit'
                        }).c('nick').t('JC').up().up()
                        .c('conference', {
                            'name': 'Second bookmark',
                            'autojoin': 'false',
                            'jid':'another@conference.shakespeare.lit'
                        }).c('nick').t('JC').up().up()
                        .c('conference', {
                            'name': 'Yet another bookmark',
                            'autojoin': 'false',
                            'jid':'yab@conference.shakespeare.lit'
                        }).c('nick').t('JC');
        _converse.connection._dataRecv(mock.createRequest(stanza));

        await u.waitUntil(() => _converse.bookmarks.length === 3);
        expect(_converse.bookmarks.map(b => b.get('name'))).toEqual(['Second bookmark', 'The Play&apos;s the Thing', 'Yet another bookmark']);
        expect(_converse.chatboxviews.get('theplay@conference.shakespeare.lit')).not.toBeUndefined();
        expect(Object.keys(_converse.chatboxviews.getAll()).length).toBe(2);
    }));


    it("can be retrieved from the XMPP server", mock.initConverse(
            ['chatBoxesFetched'], {},
            async function (_converse) {

        const { Strophe, sizzle, u, $iq } = converse.env;
        await mock.waitForRoster(_converse, 'current', 0);
        await mock.waitUntilDiscoConfirmed(
            _converse, _converse.bare_jid,
            [{'category': 'pubsub', 'type': 'pep'}],
            ['http://jabber.org/protocol/pubsub#publish-options']
        );
        /* Client requests all items
         * -------------------------
         *
         *  <iq from='juliet@capulet.lit/randomID' type='get' id='retrieve1'>
         *  <pubsub xmlns='http://jabber.org/protocol/pubsub'>
         *      <items node='storage:bookmarks'/>
         *  </pubsub>
         *  </iq>
         */
        const IQ_stanzas = _converse.connection.IQ_stanzas;
        const sent_stanza = await u.waitUntil(
            () => IQ_stanzas.filter(s => sizzle('items[node="storage:bookmarks"]', s).length).pop());

        expect(Strophe.serialize(sent_stanza)).toBe(
            `<iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}" type="get" xmlns="jabber:client">`+
            '<pubsub xmlns="http://jabber.org/protocol/pubsub">'+
                '<items node="storage:bookmarks"/>'+
            '</pubsub>'+
            '</iq>');

        /*
         * Server returns all items
         * ------------------------
         * <iq type='result'
         *     to='juliet@capulet.lit/randomID'
         *     id='retrieve1'>
         * <pubsub xmlns='http://jabber.org/protocol/pubsub'>
         *     <items node='storage:bookmarks'>
         *     <item id='current'>
         *         <storage xmlns='storage:bookmarks'>
         *         <conference name='The Play&apos;s the Thing'
         *                     autojoin='true'
         *                     jid='theplay@conference.shakespeare.lit'>
         *             <nick>JC</nick>
         *         </conference>
         *         </storage>
         *     </item>
         *     </items>
         * </pubsub>
         * </iq>
         */
        expect(_converse.bookmarks.models.length).toBe(0);

        spyOn(_converse.bookmarks, 'onBookmarksReceived').and.callThrough();
        var stanza = $iq({'to': _converse.connection.jid, 'type':'result', 'id':sent_stanza.getAttribute('id')})
            .c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                .c('items', {'node': 'storage:bookmarks'})
                    .c('item', {'id': 'current'})
                        .c('storage', {'xmlns': 'storage:bookmarks'})
                            .c('conference', {
                                'name': 'The Play&apos;s the Thing',
                                'autojoin': 'true',
                                'jid': 'theplay@conference.shakespeare.lit'
                            }).c('nick').t('JC').up().up()
                            .c('conference', {
                                'name': 'Another room',
                                'autojoin': 'false',
                                'jid': 'another@conference.shakespeare.lit'
                            }); // Purposefully exclude the <nick> element to test #1043
        _converse.connection._dataRecv(mock.createRequest(stanza));
        await u.waitUntil(() => _converse.bookmarks.onBookmarksReceived.calls.count());
        await _converse.api.waitUntil('bookmarksInitialized');
        expect(_converse.bookmarks.models.length).toBe(2);
        expect(_converse.bookmarks.get('theplay@conference.shakespeare.lit').get('autojoin')).toBe(true);
        expect(_converse.bookmarks.get('another@conference.shakespeare.lit').get('autojoin')).toBe(false);
    }));
});

describe("When hide_open_bookmarks is true and a bookmarked room is opened", function () {

    it("can be closed", mock.initConverse(
            [], { hide_open_bookmarks: true }, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 0);
        await mock.openControlBox(_converse);
        await mock.waitUntilBookmarksReturned(_converse);

        // Check that it's there
        const jid = 'room@conference.example.org';
        _converse.bookmarks.create({
            'jid': jid,
            'autojoin': false,
            'name':  'The Play',
            'nick': ' Othello'
        });
        expect(_converse.bookmarks.length).toBe(1);

        const u = converse.env.utils;
        const bookmarks_el = document.querySelector('converse-bookmarks');
        await u.waitUntil(() => bookmarks_el.querySelectorAll(".open-room").length, 500);
        const room_els = bookmarks_el.querySelectorAll(".open-room");
        expect(room_els.length).toBe(1);

        const bookmark = bookmarks_el.querySelector(".open-room");
        bookmark.click();
        await u.waitUntil(() => _converse.chatboxviews.get(jid));

        expect(u.hasClass('hidden', bookmarks_el.querySelector(".available-chatroom"))).toBeTruthy();
        // Check that it reappears once the room is closed
        const view = _converse.chatboxviews.get(jid);
        view.close();
        await u.waitUntil(() => !u.hasClass('hidden', bookmarks_el.querySelector(".available-chatroom")));
    }));
});
