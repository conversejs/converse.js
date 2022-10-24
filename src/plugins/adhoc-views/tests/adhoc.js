/*global mock, converse */

const { Strophe, sizzle, u, stx } = converse.env;

describe("Ad-hoc commands", function () {

    it("can be queried for via a modal", mock.initConverse([], {}, async (_converse) => {
        const { api } = _converse;
        const entity_jid = 'muc.montague.lit';
        const { IQ_stanzas } = _converse.connection;

        const modal = await api.modal.show('converse-user-settings-modal');
        await u.waitUntil(() => u.isVisible(modal));
        modal.querySelector('#commands-tab').click();

        const adhoc_form = modal.querySelector('converse-adhoc-commands');
        await u.waitUntil(() => u.isVisible(adhoc_form));

        const input = adhoc_form.querySelector('input[name="jid"]');
        input.value = entity_jid;

        const submit = adhoc_form.querySelector('input[type="submit"]');
        submit.click();

        await mock.waitUntilDiscoConfirmed(_converse, entity_jid, [], ['http://jabber.org/protocol/commands'], [], 'info');

        let sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#items"]`;
        let iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        _converse.connection._dataRecv(mock.createRequest(stx`
            <iq type="result"
                id="${iq.getAttribute("id")}"
                to="${_converse.jid}"
                from="${entity_jid}">
            <query xmlns="http://jabber.org/protocol/disco#items"
                    node="http://jabber.org/protocol/commands">
                <item jid="${entity_jid}"
                    node="list"
                    name="List Service Configurations"/>
                <item jid="${entity_jid}"
                    node="config"
                    name="Configure Service"/>
                <item jid="${entity_jid}"
                    node="reset"
                    name="Reset Service Configuration"/>
                <item jid="${entity_jid}"
                    node="start"
                    name="Start Service"/>
                <item jid="${entity_jid}"
                    node="stop"
                    name="Stop Service"/>
                <item jid="${entity_jid}"
                    node="restart"
                    name="Restart Service"/>
                <item jid="${entity_jid}"
                    node="adduser"
                    name="Add User"/>
            </query>
        </iq>`));

        const heading = await u.waitUntil(() => adhoc_form.querySelector('.list-group-item.active'));
        expect(heading.textContent).toBe('Commands found:');

        const items = adhoc_form.querySelectorAll('.list-group-item:not(.active)');
        expect(items.length).toBe(7);
        expect(items[0].textContent.trim()).toBe('List Service Configurations');
        expect(items[1].textContent.trim()).toBe('Configure Service');
        expect(items[2].textContent.trim()).toBe('Reset Service Configuration');
        expect(items[3].textContent.trim()).toBe('Start Service');
        expect(items[4].textContent.trim()).toBe('Stop Service');
        expect(items[5].textContent.trim()).toBe('Restart Service');
        expect(items[6].textContent.trim()).toBe('Add User');

        items[6].querySelector('a').click();

        sel = `iq[to="${entity_jid}"][type="set"] command`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(Strophe.serialize(iq)).toBe(
            `<iq id="${iq.getAttribute("id")}" to="${entity_jid}" type="set" xmlns="jabber:client">`+
                `<command action="execute" node="adduser" xmlns="http://jabber.org/protocol/commands"/>`+
            `</iq>`
        );

        _converse.connection._dataRecv(mock.createRequest(stx`
            <iq to="${_converse.jid}" xmlns="jabber:client" type="result" xml:lang="en" id="${iq.getAttribute('id')}" from="${entity_jid}">
            <command status="executing" node="adduser" sessionid="1653988890.6236324-886f3dc54ce443c6b4a1805877bf7faa" xmlns="http://jabber.org/protocol/commands">
                <actions>
                    <complete />
                </actions>
                <x type="form" xmlns="jabber:x:data">
                    <title>Title</title>
                    <instructions>Instructions</instructions>
                    <field type="boolean" label="Remove my registration" var="remove">
                        <value>0</value>
                        <required />
                    </field>
                    <field type="text-single" label="User name" var="username">
                        <value>romeo</value>
                        <required />
                    </field>
                    <field type="text-single" label="Password" var="password">
                        <value>secret</value>
                        <required />
                    </field>
                </x>
            </command>
        </iq>`));

        const form = await u.waitUntil(() => adhoc_form.querySelector('form form'));
        expect(u.isVisible(form)).toBe(true);
        const inputs = form.querySelectorAll('input');
        expect(inputs.length).toBe(7);
        expect(inputs[0].getAttribute('name')).toBe('command_node');
        expect(inputs[0].getAttribute('type')).toBe('hidden');
        expect(inputs[0].getAttribute('value')).toBe('adduser');
        expect(inputs[1].getAttribute('name')).toBe('command_jid');
        expect(inputs[0].getAttribute('type')).toBe('hidden');
        expect(inputs[1].getAttribute('value')).toBe('muc.montague.lit');
        expect(inputs[2].getAttribute('name')).toBe('remove');
        expect(inputs[2].getAttribute('type')).toBe('checkbox');
        expect(inputs[3].getAttribute('name')).toBe('username');
        expect(inputs[3].getAttribute('type')).toBe('text');
        expect(inputs[3].getAttribute('value')).toBe('romeo');
        expect(inputs[4].getAttribute('name')).toBe('password');
        expect(inputs[4].getAttribute('type')).toBe('password');
        expect(inputs[4].getAttribute('value')).toBe('secret');
        expect(inputs[5].getAttribute('type')).toBe('submit');
        expect(inputs[5].getAttribute('value')).toBe('Execute');
        expect(inputs[6].getAttribute('type')).toBe('button');
        expect(inputs[6].getAttribute('value')).toBe('Hide');

        inputs[6].click();
        await u.waitUntil(() => !u.isVisible(form));
    }));
});
