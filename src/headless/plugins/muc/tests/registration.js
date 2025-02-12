/*global mock, converse */

const { $iq, Strophe, sizzle, u } = converse.env;

describe("Groupchats", function () {
    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    describe("The auto_register_muc_nickname option", function () {

        it("allows you to automatically register your nickname when joining a room",
                mock.initConverse(['chatBoxesFetched'], {'auto_register_muc_nickname': true},
                async function (_converse) {

            const nick = 'romeo';
            const muc_jid = 'coven@chat.shakespeare.lit';
            await mock.openAndEnterChatRoom(_converse, muc_jid, nick);

            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            let stanza = await u.waitUntil(() => IQ_stanzas.find(
                iq => sizzle(`iq[type="get"] query[xmlns="${Strophe.NS.MUC_REGISTER}"]`, iq).length));

            expect(stanza).toEqualStanza(
                stx`<iq to="${muc_jid}"
                        type="get"
                        xmlns="jabber:client"
                        id="${stanza.getAttribute('id')}"><query xmlns="jabber:iq:register"/></iq>`);

            _converse.api.connection.get()._dataRecv(mock.createRequest(
                stx`<iq from="${muc_jid}"
                        id="${stanza.getAttribute('id')}"
                        to="${_converse.session.get('jid')}"
                        xmlns="jabber:client"
                        type="result">
                    <query xmlns='jabber:iq:register'>
                        <x xmlns='jabber:x:data' type='form'>
                            <field
                                type='hidden'
                                var='FORM_TYPE'>
                                <value>http://jabber.org/protocol/muc#register</value>
                            </field>
                            <field
                                label='Desired Nickname'
                                type='text-single'
                                var='muc#register_roomnick'>
                                <required/>
                            </field>
                        </x>
                    </query>
                </iq>`));

            stanza = await u.waitUntil(() => IQ_stanzas.find(
                iq => sizzle(`iq[type="set"] query[xmlns="${Strophe.NS.MUC_REGISTER}"]`, iq).length));

            expect(stanza).toEqualStanza(
                stx`<iq xmlns="jabber:client" to="${muc_jid}" type="set" id="${stanza.getAttribute('id')}">
                    <query xmlns="jabber:iq:register">
                        <x xmlns="jabber:x:data" type="submit">
                            <field var="FORM_TYPE"><value>http://jabber.org/protocol/muc#register</value></field>
                            <field var="muc#register_roomnick"><value>romeo</value></field>
                        </x>
                    </query>
                </iq>`);
        }));

        it("allows you to automatically deregister your nickname when closing a room",
                mock.initConverse(['chatBoxesFetched'], {'auto_register_muc_nickname': 'unregister'},
                async function (_converse) {

            const muc_jid = 'coven@chat.shakespeare.lit';
            const room = await mock.openAndEnterChatRoom(_converse, muc_jid, 'romeo');

            let stanza = await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.filter(
                iq => sizzle(`iq[to="${muc_jid}"][type="get"] query[xmlns="jabber:iq:register"]`, iq).length
            ).pop());
            let result = stx`<iq from="${room.get('jid')}"
                        id="${stanza.getAttribute('id')}"
                        to="${_converse.bare_jid}"
                        type="result"
                        xmlns="jabber:client">
                    <query xmlns="jabber:iq:register">
                        <x xmlns="jabber:x:data" type="form">
                            <field label="Desired Nickname"
                                   type="text-single"
                                   var="muc#register_roomnick">
                                <required/>
                            </field>
                        </x>
                    </query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));
            await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.filter(
                iq => sizzle(`iq[to="${muc_jid}"][type="set"] query[xmlns="jabber:iq:register"]`, iq).length
            ).pop());

            _converse.api.connection.get().IQ_stanzas = [];
            room.close();

            stanza = await u.waitUntil(() => _converse.api.connection.get().IQ_stanzas.filter(
                iq => sizzle(`iq[to="${muc_jid}"][type="set"] query[xmlns="jabber:iq:register"]`, iq).length
            ).pop());
            expect(stanza).toEqualStanza(
                stx`<iq id="${stanza.getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">
                    <query xmlns="jabber:iq:register"><remove/></query>
                </iq>`);

            result = stx`<iq from="${room.get('jid')}"
                        id="${stanza.getAttribute('id')}"
                        to="${_converse.bare_jid}"
                        type="result"
                        xmlns="jabber:client">
                    <query xmlns="jabber:iq:register"></query>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(result));

        }));
    });
});
