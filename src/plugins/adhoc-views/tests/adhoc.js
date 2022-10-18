/*global mock, converse */

const { sizzle, u, stx } = converse.env;

describe("Ad-hoc commands", function () {

    fit("can be queried for via a modal", mock.initConverse([], {}, async (_converse) => {
        const { api } = _converse;
        const entity_jid = 'muc.montague.lit';

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

        const sel = `iq[to="${entity_jid}"] query[xmlns="http://jabber.org/protocol/disco#items"]`;
        const iq = await u.waitUntil(() => _converse.connection.IQ_stanzas.filter(iq => sizzle(sel, iq).length).pop());

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
            </query>
        </iq>`));

        const heading = await u.waitUntil(() => adhoc_form.querySelector('.list-group-item.active'));
        expect(heading.textContent).toBe('Commands found:');

        const items = adhoc_form.querySelectorAll('.list-group-item:not(.active)');
        expect(items.length).toBe(6);
        expect(items[0].textContent.trim()).toBe('List Service Configurations');
        expect(items[1].textContent.trim()).toBe('Configure Service');
        expect(items[2].textContent.trim()).toBe('Reset Service Configuration');
        expect(items[3].textContent.trim()).toBe('Start Service');
        expect(items[4].textContent.trim()).toBe('Stop Service');
        expect(items[5].textContent.trim()).toBe('Restart Service');
    }));
});
