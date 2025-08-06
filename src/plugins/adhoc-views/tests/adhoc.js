/*global mock, converse */

const { Strophe, sizzle, u, stx } = converse.env;

describe("Ad-hoc commands", function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("can be queried for via a modal", mock.initConverse([], {}, async (_converse) => {
        const { api } = _converse;
        const entity_jid = 'muc.montague.lit';
        const { IQ_stanzas } = _converse.api.connection.get();

        const modal = await api.modal.show('converse-user-settings-modal');
        await u.waitUntil(() => u.isVisible(modal));
        modal.querySelector('#commands-tab').click();

        const adhoc_form = modal.querySelector('converse-adhoc-commands');
        await u.waitUntil(() => u.isVisible(adhoc_form));

        adhoc_form.querySelector('input[name="jid"]').value = entity_jid;
        adhoc_form.querySelector('input[type="submit"]').click();

        await mock.waitUntilDiscoConfirmed(
            _converse,
            entity_jid,
            [],
            ['http://jabber.org/protocol/commands'],
            [],
            'info'
        );

        let sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#items"]`;
        let iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq type="result"
                id="${iq.getAttribute("id")}"
                to="${_converse.jid}"
                from="${entity_jid}"
                xmlns="jabber:client">
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
        expect(heading.textContent.trim()).toBe('Commands found:');

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

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
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
        expect(inputs[5].getAttribute('type')).toBe('button');
        expect(inputs[5].getAttribute('value')).toBe('Complete');
        expect(inputs[6].getAttribute('type')).toBe('button');
        expect(inputs[6].getAttribute('value')).toBe('Cancel');

        inputs[6].click();
        await u.waitUntil(() => !u.isVisible(form));
    }));

    it("can immediately return with a result, instead of a form", mock.initConverse([], {}, async (_converse) => {
        const { api } = _converse;
        const entity_jid = 'muc.montague.lit';
        const { IQ_stanzas } = _converse.api.connection.get();

        const modal = await api.modal.show('converse-user-settings-modal');
        await u.waitUntil(() => u.isVisible(modal));
        modal.querySelector('#commands-tab').click();

        const adhoc_form = modal.querySelector('converse-adhoc-commands');
        await u.waitUntil(() => u.isVisible(adhoc_form));

        adhoc_form.querySelector('input[name="jid"]').value = entity_jid;
        adhoc_form.querySelector('input[type="submit"]').click();

        await mock.waitUntilDiscoConfirmed(
            _converse,
            entity_jid,
            [],
            ['http://jabber.org/protocol/commands'],
            [],
            'info'
        );

        let sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#items"]`;
        let iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq type="result"
                id="${iq.getAttribute("id")}"
                to="${_converse.jid}"
                from="${entity_jid}"
                xmlns="jabber:client">
            <query xmlns="http://jabber.org/protocol/disco#items"
                    node="http://jabber.org/protocol/commands">
                <item node="uptime" name="Get uptime" jid="${entity_jid}"/>
            </query>
        </iq>`));

        const heading = await u.waitUntil(() => adhoc_form.querySelector('.list-group-item.active'));
        expect(heading.textContent.trim()).toBe('Commands found:');

        const items = adhoc_form.querySelectorAll('.list-group-item:not(.active)');
        expect(items.length).toBe(1);
        expect(items[0].textContent.trim()).toBe('Get uptime');

        items[0].querySelector('a').click();

        sel = `iq[to="${entity_jid}"][type="set"] command`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(Strophe.serialize(iq)).toBe(
            `<iq id="${iq.getAttribute("id")}" to="${entity_jid}" type="set" xmlns="jabber:client">`+
                `<command action="execute" node="uptime" xmlns="http://jabber.org/protocol/commands"/>`+
            `</iq>`
        );

        const uptime_text = 'This service has been running for 143 days, '+
                            '11 hours and 15 minutes (since Sun Nov 12 21:22:22: 2023)';

        _converse.api.connection.get()._dataRecv(
            mock.createRequest(stx`
                <iq to="${_converse.jid}"
                    xmlns="jabber:client"
                    type="result"
                    xml:lang="en"
                    id="${iq.getAttribute('id')}"
                    from="${entity_jid}">

                    <command status="completed"
                             node="uptime"
                             sessionid="1653988890a"
                             xmlns="http://jabber.org/protocol/commands">
                        <note type="info">${uptime_text}</note>
                    </command>
                </iq>`)
        );

        const form = await u.waitUntil(() => adhoc_form.querySelector('form form'));
        const alert = form.querySelector('div.alert');
        expect(u.isVisible(alert)).toBe(true);
        expect(alert.textContent.trim()).toBe(uptime_text);

        const inputs = form.querySelectorAll('input[type="button"]');
        expect(inputs.length).toBe(0);
    }));

    it("may return reported fields, which are readonly and are presented in a table",
            mock.initConverse([], {}, async (_converse) => {
        const { api } = _converse;
        const entity_jid = 'muc.montague.lit';
        const { IQ_stanzas } = _converse.api.connection.get();

        const jid = _converse.session.get('jid');

        const modal = await api.modal.show('converse-user-settings-modal');
        await u.waitUntil(() => u.isVisible(modal));
        modal.querySelector('#commands-tab').click();

        const adhoc_form = modal.querySelector('converse-adhoc-commands');
        await u.waitUntil(() => u.isVisible(adhoc_form));

        adhoc_form.querySelector('input[name="jid"]').value = entity_jid;
        adhoc_form.querySelector('input[type="submit"]').click();

        await mock.waitUntilDiscoConfirmed(
            _converse,
            entity_jid,
            [],
            ['http://jabber.org/protocol/commands'],
            [],
            'info'
        );

        let sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#items"]`;
        let iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq type="result"
                id="${iq.getAttribute("id")}"
                to="${_converse.jid}"
                from="${entity_jid}"
                xmlns="jabber:client">
            <query xmlns="http://jabber.org/protocol/disco#items"
                    node="http://jabber.org/protocol/commands">
                <item node="list" name="List services" jid="${entity_jid}"/>
            </query>
        </iq>`));

        const heading = await u.waitUntil(() => adhoc_form.querySelector('.list-group-item.active'));
        expect(heading.textContent.trim()).toBe('Commands found:');

        const items = adhoc_form.querySelectorAll('.list-group-item:not(.active)');
        expect(items.length).toBe(1);
        expect(items[0].textContent.trim()).toBe('List services');
        items[0].querySelector('a').click();

        sel = `iq[to="${entity_jid}"][type="set"] command`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(Strophe.serialize(iq)).toBe(
            `<iq id="${iq.getAttribute("id")}" to="${entity_jid}" type="set" xmlns="jabber:client">`+
                `<command action="execute" node="list" xmlns="http://jabber.org/protocol/commands"/>`+
            `</iq>`
        );

        _converse.api.connection.get()._dataRecv(
            mock.createRequest(stx`
            <iq type="result" from="${entity_jid}" to="${jid}" id="${iq.getAttribute("id")}" xmlns="jabber:client">
                <command xmlns="http://jabber.org/protocol/commands"
                        sessionid="list:20020923T213616Z-700"
                        node="list"
                        status="completed">
                    <x xmlns="jabber:x:data" type="result">
                    <title>Available Services</title>
                    <reported>
                        <field var="service" label="Service"/>
                        <field var="runlevel-1" label="Single-User mode"/>
                        <field var="runlevel-2" label="Non-Networked Multi-User mode"/>
                        <field var="runlevel-3" label="Full Multi-User mode"/>
                        <field var="runlevel-5" label="X-Window mode"/>
                    </reported>
                    <item>
                        <field var="service"><value>httpd</value></field>
                        <field var="runlevel-1"><value>off</value></field>
                        <field var="runlevel-2"><value>off</value></field>
                        <field var="runlevel-3"><value>on</value></field>
                        <field var="runlevel-5"><value>on</value></field>
                    </item>
                    <item>
                        <field var="service"><value>postgresql</value></field>
                        <field var="runlevel-1"><value>off</value></field>
                        <field var="runlevel-2"><value>off</value></field>
                        <field var="runlevel-3"><value>on</value></field>
                        <field var="runlevel-5"><value>off</value></field>
                    </item>
                    <item>
                        <field var="service"><value>jabberd</value></field>
                        <field var="runlevel-1"><value>off</value></field>
                        <field var="runlevel-2"><value>on</value></field>
                        <field var="runlevel-3"><value>on</value></field>
                        <field var="runlevel-5"><value>on</value></field>
                    </item>
                    </x>
                </command>
            </iq>`
        ));

        const table = await u.waitUntil(() => adhoc_form.querySelector('form form table'));
        expect(table).toBeDefined();

        const headings = table.querySelectorAll('thead th');
        expect(headings.length).toBe(5);

        expect(Array.from(headings).map(h => h.textContent)).toEqual([
            'Service',
            'Single-User mode',
            'Non-Networked Multi-User mode',
            'Full Multi-User mode',
            'X-Window mode'
        ]);

        const rows = table.querySelectorAll('tr');
        expect(rows.length).toBe(3);
        expect(Array.from(rows[0].querySelectorAll('td')).map(h => h.textContent))
            .toEqual(['httpd', 'off', 'off', 'on', 'on']);
        expect(Array.from(rows[1].querySelectorAll('td')).map(h => h.textContent))
            .toEqual(['postgresql', 'off', 'off', 'on', 'off']);
        expect(Array.from(rows[2].querySelectorAll('td')).map(h => h.textContent))
            .toEqual(['jabberd', 'off', 'on', 'on', 'on']);
    }));

    it("May return a result form with readonly fields",
            mock.initConverse([], {}, async (_converse) => {
        const { api } = _converse;
        const entity_jid = 'muc.montague.lit';
        const { IQ_stanzas } = _converse.api.connection.get();

        const jid = _converse.session.get('jid');

        const modal = await api.modal.show('converse-user-settings-modal');
        await u.waitUntil(() => u.isVisible(modal));
        modal.querySelector('#commands-tab').click();

        const adhoc_form = modal.querySelector('converse-adhoc-commands');
        await u.waitUntil(() => u.isVisible(adhoc_form));

        adhoc_form.querySelector('input[name="jid"]').value = entity_jid;
        adhoc_form.querySelector('input[type="submit"]').click();

        await mock.waitUntilDiscoConfirmed(
            _converse,
            entity_jid,
            [],
            ['http://jabber.org/protocol/commands'],
            [],
            'info'
        );

        let sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#items"]`;
        let iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq type="result"
                id="${iq.getAttribute("id")}"
                to="${_converse.jid}"
                from="${entity_jid}"
                xmlns="jabber:client">
            <query xmlns="http://jabber.org/protocol/disco#items"
                    node="http://jabber.org/protocol/commands">
                <item node="list" name="Generate Invite" jid="${entity_jid}"/>
            </query>
        </iq>`));

        const heading = await u.waitUntil(() => adhoc_form.querySelector('.list-group-item.active'));
        expect(heading.textContent.trim()).toBe('Commands found:');

        const items = adhoc_form.querySelectorAll('.list-group-item:not(.active)');
        expect(items.length).toBe(1);
        expect(items[0].textContent.trim()).toBe('Generate Invite');
        items[0].querySelector('a').click();

        sel = `iq[to="${entity_jid}"][type="set"] command`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(Strophe.serialize(iq)).toBe(
            `<iq id="${iq.getAttribute("id")}" to="${entity_jid}" type="set" xmlns="jabber:client">`+
                `<command action="execute" node="list" xmlns="http://jabber.org/protocol/commands"/>`+
            `</iq>`
        );

        _converse.api.connection.get()._dataRecv(
            mock.createRequest(stx`
            <iq type="result" from="${entity_jid}" to="${jid}" id="${iq.getAttribute("id")}" xmlns="jabber:client">
                <command node="urn:xmpp:invite#create-account"
                        status="completed"
                        xmlns="http://jabber.org/protocol/commands"
                        sessionid="414d39f0-bb39-4114-805b-70cb28c4de9a">
                    <x xmlns="jabber:x:data" type="result">
                        <title>Your invite has been created</title>
                        <field type="text-single" var="username" label="username">
                            <desc>Your username</desc>
                            <value>spongebob</value>
                        </field>
                        <field type="text-single" label="Invite web page" var="landing-url">
                            <desc>Share this link</desc>
                            <value>https://www.conversejs.org</value>
                        </field>
                        <field type="text-single" label="Invite URI" var="uri">
                            <desc>This alternative link can be opened with some XMPP clients</desc>
                            <value>xmpp:localhost?register;preauth=VpwwVTD7ep3SIZvv6kyj725v</value>
                        </field>
                        <field type="text-single" label="Invite valid until" var="expire">
                            <value>2024-05-14T19:40:32Z</value>
                        </field>
                    </x>
                </command>
            </iq>`
        ));

        const form = await u.waitUntil(() => adhoc_form.querySelector('form form'));
        expect(form).toBeDefined();

        expect(form.querySelector('.alert').textContent).toBe('Your invite has been created');

        const labels = Array.from(form.querySelectorAll('label'));
        expect(labels.length).toBe(4);

        const descs = Array.from(form.querySelectorAll('small'));
        expect(descs.length).toBe(3);
        expect(descs.map((d) => d.textContent)).toEqual([
            'Your username',
            'Share this link',
            'This alternative link can be opened with some XMPP clients',
        ]);

        const inputs = Array.from(form.querySelectorAll('input:not([type=hidden])'));
        expect(inputs.length).toBe(2);
        expect(inputs.map((i) => i.hasAttribute('readonly'))).toEqual([true, true]);
        expect(inputs.map((i) => i.getAttribute('name'))).toEqual(['username', 'expire']);

        const urls = Array.from(form.querySelectorAll('.form-url'));
        expect(urls.length).toBe(2);
        expect(urls.map((u) => u.textContent)).toEqual([
            'https://www.conversejs.org',
            'xmpp:localhost?register;preauth=VpwwVTD7ep3SIZvv6kyj725v',
        ]);
    }));
});

describe("Ad-hoc commands consisting of multiple steps", function () {

    beforeAll(() => jasmine.addMatchers({ toEqualStanza: jasmine.toEqualStanza }));

    it("can be queried and executed via a modal", mock.initConverse([], {}, async (_converse) => {
        const { api } = _converse;
        const entity_jid = 'montague.lit';
        const { IQ_stanzas } = _converse.api.connection.get();

        const modal = await api.modal.show('converse-user-settings-modal');
        await u.waitUntil(() => u.isVisible(modal));
        modal.querySelector('#commands-tab').click();

        const adhoc_form = modal.querySelector('converse-adhoc-commands');
        await u.waitUntil(() => u.isVisible(adhoc_form));

        adhoc_form.querySelector('input[name="jid"]').value = entity_jid;
        adhoc_form.querySelector('input[type="submit"]').click();

        await mock.waitUntilDiscoConfirmed(_converse, entity_jid, [], ['http://jabber.org/protocol/commands'], [], 'info');

        let sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#items"]`;
        let iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(iq).toEqualStanza(stx`
            <iq from="${_converse.jid}" id="${iq.getAttribute('id')}" to="${entity_jid}" type="get" xmlns="jabber:client">
                <query node="http://jabber.org/protocol/commands" xmlns="http://jabber.org/protocol/disco#items"/>
            </iq>`
        );

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq xmlns="jabber:client" id="${iq.getAttribute('id')}" type="result" from="${entity_jid}" to="${_converse.jid}">
                <query xmlns="http://jabber.org/protocol/disco#items" node="http://jabber.org/protocol/commands">
                    <item node="uptime" name="Get uptime" jid="${entity_jid}"/>
                    <item node="urn:xmpp:mam#configure" name="Archive settings" jid="${entity_jid}"/>
                    <item node="xmpp:zash.se/mod_adhoc_dataforms_demo#form" name="Dataforms Demo" jid="${entity_jid}"/>
                    <item node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi" name="Multi-step command demo" jid="${entity_jid}"/>
                </query>
            </iq>
        `));

        const item = await u.waitUntil(() => adhoc_form.querySelector('form a[data-command-node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi"]'));
        item.click();

        sel = `iq[to="${entity_jid}"] command`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(iq).toEqualStanza(stx`
            <iq id="${iq.getAttribute('id')}" to="${entity_jid}" type="set" xmlns="jabber:client">
                <command action="execute" node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi" xmlns="http://jabber.org/protocol/commands"/>
            </iq>`
        );

        const sessionid = "f4d477d3-d8b1-452d-95c9-fece53ef99ad";

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
        <iq xmlns="jabber:client" id="${iq.getAttribute('id')}" type="result" from="${entity_jid}" to="${_converse.jid}">
            <command xmlns="http://jabber.org/protocol/commands" sessionid="${sessionid}" status="executing" node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi">
                <actions>
                    <next/>
                    <complete/>
                </actions>

                <x xmlns="jabber:x:data" type="form">
                    <title>Step 1</title>
                    <instructions>Here's a form.</instructions>
                    <field label="text-private-label" type="text-private" var="text-private-field">
                        <value>text-private-value</value>
                    </field>
                    <field label="jid-multi-label" type="jid-multi" var="jid-multi-field">
                        <value>jid@multi/value#1</value>
                        <value>jid@multi/value#2</value>
                    </field>
                    <field label="text-multi-label" type="text-multi" var="text-multi-field">
                        <value>text</value>
                        <value>multi</value>
                        <value>value</value>
                    </field>
                    <field label="jid-single-label" type="jid-single" var="jid-single-field">
                        <value>jid@single/value</value>
                    </field>
                    <field label="list-single-label" type="list-single" var="list-single-field">
                        <option label="list-single-value"><value>list-single-value</value></option>
                        <option label="list-single-value#2"><value>list-single-value#2</value></option>
                        <option label="list-single-value#3"><value>list-single-value#3</value></option>
                        <value>list-single-value</value>
                    </field>
                </x>
            </command>
        </iq>
        `));

        let button = await u.waitUntil(() => modal.querySelector('input[data-action="next"]'));
        button.click();

        sel = `iq[to="${entity_jid}"] command[sessionid="${sessionid}"]`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(iq).toEqualStanza(stx`
            <iq type="set" to="${entity_jid}" xmlns="jabber:client" id="${iq.getAttribute('id')}">
                <command sessionid="${sessionid}" node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi" action="next" xmlns="http://jabber.org/protocol/commands">
                    <x type="submit" xmlns="jabber:x:data">
                        <field var="text-private-field">
                            <value>text-private-value</value>
                        </field>
                        <field var="jid-multi-field">
                            <value>jid@multi/value#1</value>
                        </field>
                        <field var="text-multi-field">
                            <value>text</value>
                        </field>
                        <field var="jid-single-field">
                            <value>jid@single/value</value>
                        </field>
                        <field var="list-single-field">
                            <value>list-single-value</value>
                        </field>
                    </x>
                </command>
            </iq>`
        );

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq xmlns="jabber:client" id="${iq.getAttribute('id')}" type="result" from="${entity_jid}" to="${_converse.jid}">
                <command xmlns="http://jabber.org/protocol/commands" sessionid="${sessionid}" status="executing" node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi">
                <actions>
                    <prev/>
                    <next/>
                    <complete/>
                </actions>
                <x xmlns="jabber:x:data" type="form">
                    <title>Step 2</title>
                    <instructions>Here's another form.</instructions>
                    <field label="jid-multi-label" type="jid-multi" var="jid-multi-field">
                        <value>jid@multi/value#1</value>
                        <value>jid@multi/value#2</value>
                    </field>
                    <field label="boolean-label" type="boolean" var="boolean-field">
                        <value>1</value>
                    </field>
                    <field label="fixed-label" type="fixed" var="fixed-field#1">
                        <value>fixed-value</value>
                    </field>
                    <field label="list-single-label" type="list-single" var="list-single-field">
                        <option label="list-single-value">
                            <value>list-single-value</value>
                        </option>
                        <option label="list-single-value#2">
                            <value>list-single-value#2</value>
                        </option>
                        <option label="list-single-value#3">
                            <value>list-single-value#3</value>
                        </option>
                        <value>list-single-value</value>
                    </field>
                    <field label="text-single-label" type="text-single" var="text-single-field">
                        <value>text-single-value</value>
                    </field>
                </x>
                </command>
            </iq>
        `));

        button = await u.waitUntil(() => modal.querySelector('input[data-action="complete"]'));
        button.click();

        sel = `iq[to="${entity_jid}"] command[sessionid="${sessionid}"][action="complete"]`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(iq).toEqualStanza(stx`
            <iq xmlns="jabber:client"
                type="set"
                to="${entity_jid}"
                id="${iq.getAttribute('id')}">

                <command xmlns="http://jabber.org/protocol/commands"
                        sessionid="${sessionid}"
                        node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi"
                        action="complete">
                    <x xmlns="jabber:x:data"
                    type="submit">
                    <field var="text-private-field">
                    <value>text-private-value</value></field>
                    <field var="jid-multi-field"><value>jid@multi/value#1</value></field>
                    <field var="text-multi-field"><value>text</value></field>
                    <field var="jid-single-field"><value>jid@single/value</value></field>
                    <field var="list-single-field"><value>list-single-value</value></field>
                    </x>
                </command>
            </iq>`
        );


        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq xmlns="jabber:server" type="result" from="${entity_jid}" to="${_converse.jid}" id="${iq.getAttribute("id")}">
                <command xmlns="http://jabber.org/protocol/commands"
                        sessionid="${sessionid}"
                        node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi"
                        status="completed">
                    <note type="info">Service has been configured.</note>
                </command>
            </iq>`)
        );
    }));

    it("can be canceled", mock.initConverse([], {}, async (_converse) => {
        const { api } = _converse;
        const entity_jid = 'montague.lit';
        const { IQ_stanzas } = _converse.api.connection.get();

        const modal = await api.modal.show('converse-user-settings-modal');
        await u.waitUntil(() => u.isVisible(modal));
        modal.querySelector('#commands-tab').click();

        const adhoc_form = modal.querySelector('converse-adhoc-commands');
        await u.waitUntil(() => u.isVisible(adhoc_form));

        adhoc_form.querySelector('input[name="jid"]').value = entity_jid;
        adhoc_form.querySelector('input[type="submit"]').click();

        await mock.waitUntilDiscoConfirmed(_converse, entity_jid, [], ['http://jabber.org/protocol/commands'], [], 'info');

        let sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#items"]`;
        let iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq xmlns="jabber:client" id="${iq.getAttribute('id')}" type="result" from="${entity_jid}" to="${_converse.jid}">
                <query xmlns="http://jabber.org/protocol/disco#items" node="http://jabber.org/protocol/commands">
                    <item node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi" name="Multi-step command" jid="${entity_jid}"/>
                </query>
            </iq>
        `));

        const item = await u.waitUntil(() => adhoc_form.querySelector('form a[data-command-node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi"]'));
        item.click();

        sel = `iq[to="${entity_jid}"] command`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        const sessionid = "f4d477d3-d8b1-452d-95c9-fece53ef99cc";

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
        <iq xmlns="jabber:client" id="${iq.getAttribute('id')}" type="result" from="${entity_jid}" to="${_converse.jid}">
            <command xmlns="http://jabber.org/protocol/commands" sessionid="${sessionid}" status="executing" node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi">
                <actions>
                    <next/>
                    <complete/>
                </actions>

                <x xmlns="jabber:x:data" type="form">
                    <title>Step 1</title>
                    <instructions>Here's a form.</instructions>
                    <field label="text-private-label" type="text-private" var="text-private-field">
                        <value>text-private-value</value>
                    </field>
                </x>
            </command>
        </iq>
        `));

        const button = await u.waitUntil(() => modal.querySelector('input.button-cancel'));
        button.click();

        sel = `iq[to="${entity_jid}"] command[sessionid="${sessionid}"]`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(iq).toEqualStanza(stx`
            <iq type="set" to="${entity_jid}" xmlns="jabber:client" id="${iq.getAttribute('id')}">
                <command sessionid="${sessionid}"
                        node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi"
                        action="cancel"
                        xmlns="http://jabber.org/protocol/commands">
                </command>
            </iq>`
        );

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq xmlns="jabber:client" id="${iq.getAttribute('id')}" type="result" from="${entity_jid}" to="${_converse.jid}">
                <command xmlns="http://jabber.org/protocol/commands"
                        sessionid="${sessionid}"
                        status="canceled"
                        node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi">
                </command>
            </iq>
        `));
    }));

    it("can be navigated backwards", mock.initConverse([], {}, async (_converse) => {
        const { api } = _converse;
        const entity_jid = 'montague.lit';
        const { IQ_stanzas } = _converse.api.connection.get();

        const modal = await api.modal.show('converse-user-settings-modal');
        await u.waitUntil(() => u.isVisible(modal));
        modal.querySelector('#commands-tab').click();

        const adhoc_form = modal.querySelector('converse-adhoc-commands');
        await u.waitUntil(() => u.isVisible(adhoc_form));

        adhoc_form.querySelector('input[name="jid"]').value = entity_jid;
        adhoc_form.querySelector('input[type="submit"]').click();

        await mock.waitUntilDiscoConfirmed(_converse, entity_jid, [], ['http://jabber.org/protocol/commands'], [], 'info');

        let sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#items"]`;
        let iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(iq).toEqualStanza(stx`
            <iq from="${_converse.jid}" to="${entity_jid}" type="get" xmlns="jabber:client" id="${iq.getAttribute('id')}">
                <query xmlns="http://jabber.org/protocol/disco#items" node="http://jabber.org/protocol/commands"/>
            </iq>`
        );

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq xmlns="jabber:client" id="${iq.getAttribute('id')}" type="result" from="${entity_jid}" to="${_converse.jid}">
                <query xmlns="http://jabber.org/protocol/disco#items" node="http://jabber.org/protocol/commands">
                    <item node="uptime" name="Get uptime" jid="${entity_jid}"/>
                    <item node="urn:xmpp:mam#configure" name="Archive settings" jid="${entity_jid}"/>
                    <item node="xmpp:zash.se/mod_adhoc_dataforms_demo#form" name="Dataforms Demo" jid="${entity_jid}"/>
                    <item node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi" name="Multi-step command demo" jid="${entity_jid}"/>
                </query>
            </iq>
        `));

        const item = await u.waitUntil(() => adhoc_form.querySelector('form a[data-command-node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi"]'));
        item.click();

        sel = `iq[to="${entity_jid}"] command`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(iq).toEqualStanza(stx`
            <iq id="${iq.getAttribute('id')}" to="${entity_jid}" type="set" xmlns="jabber:client">
                <command action="execute" node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi" xmlns="http://jabber.org/protocol/commands"/>
            </iq>`);

        const sessionid = "f4d477d3-d8b1-452d-95c9-fece53ef99ad";

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq xmlns="jabber:client" id="${iq.getAttribute('id')}" type="result" from="${entity_jid}" to="${_converse.jid}">
                <command xmlns="http://jabber.org/protocol/commands" sessionid="${sessionid}" status="executing" node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi">
                    <actions>
                        <next/>
                        <complete/>
                    </actions>

                    <x xmlns="jabber:x:data" type="form">
                        <title>Step 1</title>
                        <instructions>Here's a form.</instructions>
                        <field label="text-private-label" type="text-private" var="text-private-field">
                            <value>text-private-value</value>
                        </field>
                    </x>
                </command>
            </iq>
        `));

        let button = await u.waitUntil(() => modal.querySelector('input[data-action="next"]'));
        button.click();

        sel = `iq[to="${entity_jid}"] command[sessionid="${sessionid}"]`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(iq).toEqualStanza(stx`
            <iq type="set" to="${entity_jid}" xmlns="jabber:client" id="${iq.getAttribute('id')}">
                <command sessionid="${sessionid}" node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi" action="next" xmlns="http://jabber.org/protocol/commands">
                    <x type="submit" xmlns="jabber:x:data">
                        <field var="text-private-field">
                            <value>text-private-value</value>
                        </field>
                    </x>
                </command>
            </iq>`
        );

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq xmlns="jabber:client" id="${iq.getAttribute('id')}" type="result" from="${entity_jid}" to="${_converse.jid}">
                <command xmlns="http://jabber.org/protocol/commands" sessionid="${sessionid}" status="executing" node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi">
                <actions>
                    <prev/>
                    <next/>
                    <complete/>
                </actions>
                <x xmlns="jabber:x:data" type="form">
                    <title>Step 2</title>
                    <instructions>Here's another form.</instructions>
                    <field label="jid-multi-label" type="jid-multi" var="jid-multi-field">
                        <value>jid@multi/value#1</value>
                        <value>jid@multi/value#2</value>
                    </field>
                </x>
                </command>
            </iq>
        `));

        button = await u.waitUntil(() => modal.querySelector('input[data-action="prev"]'));
        button.click();

        sel = `iq[to="${entity_jid}"] command[sessionid="${sessionid}"][action="prev"]`;
        iq = await u.waitUntil(() => IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

        expect(iq).toEqualStanza(stx`
            <iq type="set" to="${entity_jid}" xmlns="jabber:client" id="${iq.getAttribute('id')}">
                <command sessionid="${sessionid}"
                        node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi"
                        action="prev"
                        xmlns="http://jabber.org/protocol/commands">
                </command>
            </iq>`
        );

        _converse.api.connection.get()._dataRecv(mock.createRequest(stx`
            <iq xmlns="jabber:client" id="${iq.getAttribute('id')}" type="result" from="${entity_jid}" to="${_converse.jid}">
                <command xmlns="http://jabber.org/protocol/commands" sessionid="${sessionid}" status="executing" node="xmpp:zash.se/mod_adhoc_dataforms_demo#multi">
                    <actions>
                        <next/>
                        <complete/>
                    </actions>

                    <x xmlns="jabber:x:data" type="form">
                        <title>Step 1</title>
                        <instructions>Here's a form.</instructions>
                        <field label="text-private-label" type="text-private" var="text-private-field">
                            <value>text-private-value</value>
                        </field>
                    </x>
                </command>
            </iq>
        `));
    }));
});
