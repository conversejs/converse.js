import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx } = converse.env;

describe('Fetching the details of a groupchat', function () {
    it(
        'parses its description, number of occupants and features from its disco#info',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            const jid = 'balcony@conference.montague.lit';
            const reply = stx`
                <iq xmlns="jabber:client" type="result" from="${jid}">
                    <query xmlns="http://jabber.org/protocol/disco#info">
                        <identity category="conference" type="text" name="Balcony"/>
                        <feature var="http://jabber.org/protocol/muc"/>
                        <feature var="muc_membersonly"/>
                        <feature var="muc_persistent"/>
                        <feature var="muc_semianonymous"/>
                        <x xmlns="jabber:x:data" type="result">
                            <field var="FORM_TYPE" type="hidden">
                                <value>http://jabber.org/protocol/muc#roominfo</value>
                            </field>
                            <field var="muc#roominfo_description" label="Description">
                                <value>Where Romeo calls</value>
                            </field>
                            <field var="muc#roominfo_occupants" label="Number of occupants">
                                <value>3</value>
                            </field>
                        </x>
                    </query>
                </iq>`.tree();
            vi.spyOn(api.disco, 'info').mockResolvedValue(reply);

            expect(await api.rooms.info(jid)).toEqual({
                jid,
                desc: 'Where Romeo calls',
                occ: '3',
                hidden: false,
                membersonly: true,
                moderated: false,
                nonanonymous: false,
                open: false,
                passwordprotected: false,
                persistent: true,
                publicroom: false,
                semianonymous: true,
                temporary: false,
                unmoderated: false,
            });
            expect(api.disco.info).toHaveBeenCalledWith(jid, null);
        }),
    );
});
