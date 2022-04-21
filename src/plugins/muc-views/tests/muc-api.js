/*global mock, converse */

const Model = converse.env.Model;
const { $pres, $iq, Strophe, sizzle, u } = converse.env;

describe("Groupchats", function () {

    describe("The \"rooms\" API", function () {

        it("has a method 'close' which closes rooms by JID or all rooms when called with no arguments",
                mock.initConverse([], {}, async function (_converse) {

            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');

            _converse.connection.IQ_stanzas = [];
            await mock.openAndEnterChatRoom(_converse, 'leisure@montague.lit', 'romeo');

            _converse.connection.IQ_stanzas = [];
            await mock.openAndEnterChatRoom(_converse, 'news@montague.lit', 'romeo');

            expect(u.isVisible(_converse.chatboxviews.get('lounge@montague.lit'))).toBeTruthy();
            expect(u.isVisible(_converse.chatboxviews.get('leisure@montague.lit'))).toBeTruthy();
            expect(u.isVisible(_converse.chatboxviews.get('news@montague.lit'))).toBeTruthy();

            _converse.chatboxviews.get('lounge@montague.lit').close();
            await u.waitUntil(() => !_converse.chatboxviews.get('lounge@montague.lit'));
            expect(u.isVisible(_converse.chatboxviews.get('leisure@montague.lit'))).toBeTruthy();
            expect(u.isVisible(_converse.chatboxviews.get('news@montague.lit'))).toBeTruthy();

            _converse.chatboxviews.get('leisure@montague.lit').close();
            await u.waitUntil(() => !_converse.chatboxviews.get('leisure@montague.lit'));

            _converse.chatboxviews.get('news@montague.lit').close();
            await u.waitUntil(() => !_converse.chatboxviews.get('news@montague.lit'));

            expect(_converse.chatboxviews.get('lounge@montague.lit')).toBeUndefined();
            expect(_converse.chatboxviews.get('leisure@montague.lit')).toBeUndefined();
            expect(_converse.chatboxviews.get('news@montague.lit')).toBeUndefined();

            await mock.openAndEnterChatRoom(_converse, 'lounge@montague.lit', 'romeo');
            await mock.openAndEnterChatRoom(_converse, 'leisure@montague.lit', 'romeo');
            expect(u.isVisible(_converse.chatboxviews.get('lounge@montague.lit'))).toBeTruthy();
            expect(u.isVisible(_converse.chatboxviews.get('leisure@montague.lit'))).toBeTruthy();

            _converse.chatboxviews.get('leisure@montague.lit').close();
            await u.waitUntil(() => !_converse.chatboxviews.get('leisure@montague.lit'));

            _converse.chatboxviews.get('lounge@montague.lit').close();
            await u.waitUntil(() => !_converse.chatboxviews.get('lounge@montague.lit'));

            expect(_converse.chatboxviews.get('lounge@montague.lit')).toBeUndefined();
            expect(_converse.chatboxviews.get('leisure@montague.lit')).toBeUndefined();
        }));

        it("has a method 'get' which returns a wrapped groupchat (if it exists)",
                mock.initConverse([], {}, async function (_converse) {

            await mock.waitForRoster(_converse, 'current');
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group .group-toggle').length, 300);
            let muc_jid = 'chillout@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            let room = await _converse.api.rooms.get(muc_jid);
            expect(room instanceof Object).toBeTruthy();

            let chatroomview = _converse.chatboxviews.get(muc_jid);
            expect(chatroomview.is_chatroom).toBeTruthy();

            expect(u.isVisible(chatroomview)).toBeTruthy();
            await chatroomview.close();

            // Test with mixed case
            muc_jid = 'Leisure@montague.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');
            room = await _converse.api.rooms.get(muc_jid);
            expect(room instanceof Object).toBeTruthy();
            chatroomview = _converse.chatboxviews.get(muc_jid.toLowerCase());
            expect(u.isVisible(chatroomview)).toBeTruthy();

            muc_jid = 'leisure@montague.lit';
            room = await _converse.api.rooms.get(muc_jid);
            expect(room instanceof Object).toBeTruthy();
            chatroomview = _converse.chatboxviews.get(muc_jid.toLowerCase());
            expect(u.isVisible(chatroomview)).toBeTruthy();

            muc_jid = 'leiSure@montague.lit';
            room = await _converse.api.rooms.get(muc_jid);
            expect(room instanceof Object).toBeTruthy();
            chatroomview = _converse.chatboxviews.get(muc_jid.toLowerCase());
            expect(u.isVisible(chatroomview)).toBeTruthy();
            chatroomview.close();

            // Non-existing room
            muc_jid = 'chillout2@montague.lit';
            room = await _converse.api.rooms.get(muc_jid);
            expect(room).toBe(null);
        }));

        it("has a method 'open' which opens (optionally configures) and returns a wrapped chat box",
                mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

            const { api } = _converse;
            // Mock 'getDiscoInfo', otherwise the room won't be
            // displayed as it waits first for the features to be returned
            // (when it's a new room being created).
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

            let jid = 'lounge@montague.lit';
            await mock.openControlBox(_converse);
            await mock.waitForRoster(_converse, 'current');
            const rosterview = document.querySelector('converse-roster');
            await u.waitUntil(() => rosterview.querySelectorAll('.roster-group .group-toggle').length);

            let room = await _converse.api.rooms.open(jid);
            // Test on groupchat that's not yet open
            expect(room instanceof Model).toBeTruthy();
            let mucview = await u.waitUntil(() => _converse.chatboxviews.get(jid));
            expect(mucview.is_chatroom).toBeTruthy();
            await u.waitUntil(() => u.isVisible(mucview));

            // Test again, now that the room exists.
            room = await _converse.api.rooms.open(jid);
            expect(room instanceof Model).toBeTruthy();
            mucview = await u.waitUntil(() => _converse.chatboxviews.get(jid));
            expect(mucview.is_chatroom).toBeTruthy();
            expect(u.isVisible(mucview)).toBeTruthy();
            await mucview.close();

            // Test with mixed case in JID
            jid = 'Leisure@montague.lit';
            room = await _converse.api.rooms.open(jid);
            expect(room instanceof Model).toBeTruthy();
            mucview = await u.waitUntil(() => _converse.chatboxviews.get(jid.toLowerCase()));
            await u.waitUntil(() => u.isVisible(mucview));

            jid = 'leisure@montague.lit';
            room = await _converse.api.rooms.open(jid);
            expect(room instanceof Model).toBeTruthy();
            mucview = await u.waitUntil(() => _converse.chatboxviews.get(jid.toLowerCase()));
            await u.waitUntil(() => u.isVisible(mucview));

            jid = 'leiSure@montague.lit';
            room = await _converse.api.rooms.open(jid);
            expect(room instanceof Model).toBeTruthy();
            mucview = await u.waitUntil(() => _converse.chatboxviews.get(jid.toLowerCase()));
            await u.waitUntil(() => u.isVisible(mucview));
            mucview.close();

            api.settings.set('muc_instant_rooms', false);
            // Test with configuration
            room = await _converse.api.rooms.open('room@conference.example.org', {
                'nick': 'some1',
                'auto_configure': true,
                'roomconfig': {
                    'getmemberlist': ['moderator', 'participant'],
                    'changesubject': false,
                    'membersonly': true,
                    'persistentroom': true,
                    'publicroom': true,
                    'roomdesc': 'Welcome to this groupchat',
                    'whois': 'anyone'
                }
            });
            expect(room instanceof Model).toBeTruthy();

            const IQ_stanzas = _converse.connection.IQ_stanzas;
            const selector = `iq[to="room@conference.example.org"] query[xmlns="http://jabber.org/protocol/disco#info"]`;
            const features_query = await u.waitUntil(() => IQ_stanzas.filter(iq => iq.querySelector(selector)).pop());

            // We pretend this is a new room, so no disco info is returned.
            const features_stanza = $iq({
                    from: 'room@conference.example.org',
                    'id': features_query.getAttribute('id'),
                    'to': 'romeo@montague.lit/desktop',
                    'type': 'error'
                }).c('error', {'type': 'cancel'})
                    .c('item-not-found', {'xmlns': "urn:ietf:params:xml:ns:xmpp-stanzas"});
            _converse.connection._dataRecv(mock.createRequest(features_stanza));

            /* <presence xmlns="jabber:client" to="romeo@montague.lit/pda" from="room@conference.example.org/yo">
             *  <x xmlns="http://jabber.org/protocol/muc#user">
             *      <item affiliation="owner" jid="romeo@montague.lit/pda" role="moderator"/>
             *      <status code="110"/>
             *      <status code="201"/>
             *  </x>
             * </presence>
             */
            const presence = $pres({
                    from:'room@conference.example.org/some1',
                    to:'romeo@montague.lit/pda'
                })
                .c('x', {xmlns:'http://jabber.org/protocol/muc#user'})
                .c('item', {
                    affiliation: 'owner',
                    jid: 'romeo@montague.lit/pda',
                    role: 'moderator'
                }).up()
                .c('status', {code:'110'}).up()
                .c('status', {code:'201'});
            _converse.connection._dataRecv(mock.createRequest(presence));

            const iq = await u.waitUntil(() => IQ_stanzas.filter(s => s.querySelector(`query[xmlns="${Strophe.NS.MUC_OWNER}"]`)).pop());
            expect(Strophe.serialize(iq)).toBe(
                `<iq id="${iq.getAttribute('id')}" to="room@conference.example.org" type="get" xmlns="jabber:client">`+
                `<query xmlns="http://jabber.org/protocol/muc#owner"/></iq>`);

            const node = u.toStanza(`
               <iq xmlns="jabber:client"
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
                    <field type="text-single" var="muc#roomconfig_roomname" label="Name">
                        <value>Room</value>
                    </field>
                    <field type="text-single" var="muc#roomconfig_roomdesc" label="Description"><value/></field>
                    <field type="boolean" var="muc#roomconfig_persistentroom" label="Make Room Persistent?"/>
                    <field type="boolean" var="muc#roomconfig_publicroom" label="Make Room Publicly Searchable?"><value>1</value></field>
                    <field type="boolean" var="muc#roomconfig_changesubject" label="Allow Occupants to Change Subject?"/>
                    <field type="list-single" var="muc#roomconfig_whois" label="Who May Discover Real JIDs?"><option label="Moderators Only">
                       <value>moderators</value></option><option label="Anyone"><value>anyone</value></option>
                    </field>
                    <field label="Roles and Affiliations that May Retrieve Member List"
                           type="list-multi"
                           var="muc#roomconfig_getmemberlist">
                        <value>moderator</value>
                        <value>participant</value>
                        <value>visitor</value>
                    </field>
                    <field type="text-private" var="muc#roomconfig_roomsecret" label="Password"><value/></field>
                    <field type="boolean" var="muc#roomconfig_moderatedroom" label="Make Room Moderated?"/>
                    <field type="boolean" var="muc#roomconfig_membersonly" label="Make Room Members-Only?"/>
                    <field type="text-single" var="muc#roomconfig_historylength" label="Maximum Number of History Messages Returned by Room">
                       <value>20</value></field>
                    </x>
                </query>
                </iq>`);

            mucview = _converse.chatboxviews.get('room@conference.example.org');
            spyOn(mucview.model, 'sendConfiguration').and.callThrough();
            _converse.connection._dataRecv(mock.createRequest(node));
            await u.waitUntil(() => mucview.model.sendConfiguration.calls.count() === 1);

            const sent_stanza = IQ_stanzas.filter(s => s.getAttribute('type') === 'set').pop();
            expect(sizzle('field[var="muc#roomconfig_roomname"] value', sent_stanza).pop().textContent.trim()).toBe('Room');
            expect(sizzle('field[var="muc#roomconfig_roomdesc"] value', sent_stanza).pop().textContent.trim()).toBe('Welcome to this groupchat');
            expect(sizzle('field[var="muc#roomconfig_persistentroom"] value', sent_stanza).pop().textContent.trim()).toBe('1');
            expect(sizzle('field[var="muc#roomconfig_getmemberlist"] value', sent_stanza).map(e => e.textContent.trim()).join(' ')).toBe('moderator participant');
            expect(sizzle('field[var="muc#roomconfig_publicroom"] value ', sent_stanza).pop().textContent.trim()).toBe('1');
            expect(sizzle('field[var="muc#roomconfig_changesubject"] value', sent_stanza).pop().textContent.trim()).toBe('0');
            expect(sizzle('field[var="muc#roomconfig_whois"] value ', sent_stanza).pop().textContent.trim()).toBe('anyone');
            expect(sizzle('field[var="muc#roomconfig_membersonly"] value', sent_stanza).pop().textContent.trim()).toBe('1');
            expect(sizzle('field[var="muc#roomconfig_historylength"] value', sent_stanza).pop().textContent.trim()).toBe('20');
        }));
    });
});
