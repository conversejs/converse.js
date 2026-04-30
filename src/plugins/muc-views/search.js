import { _converse, api, converse, log } from "@converse/headless";

const { Strophe, stx, sizzle } = converse.env;

Strophe.addNamespace('MUCSEARCH', 'https://xmlns.zombofant.net/muclumbus/search/1.0');

const rooms_cache = {};

/**
 * @param {string} query
 */
async function searchRooms (query) {
    const muc_search_service = api.settings.get('muc_search_service');
    const bare_jid = _converse.session.get('bare_jid');
    const iq = stx`
        <iq type="get"
            from="${bare_jid}"
            to="${muc_search_service}"
            xmlns="jabber:client">
            <search xmlns="${Strophe.NS.MUCSEARCH}">
                <set xmlns="${Strophe.NS.RSM}">
                    <max>10</max>
                </set>
                <x xmlns="${Strophe.NS.XFORM}" type="submit">
                    <field var="FORM_TYPE" type="hidden">
                        <value>https://xmlns.zombofant.net/muclumbus/search/1.0#params</value>
                    </field>
                    <field var="q" type="text-single">
                        <value>${query}</value>
                    </field>
                    <field var="sinname" type="boolean">
                        <value>true</value>
                    </field>
                    <field var="sindescription" type="boolean">
                        <value>false</value>
                    </field>
                    <field var="sinaddr" type="boolean">
                        <value>true</value>
                    </field>
                    <field var="min_users" type="text-single">
                        <value>1</value>
                    </field>
                    <field var="key" type="list-single">
                        <value>address</value>
                        <option><value>nusers</value></option>
                        <option><value>address</value></option>
                    </field>
                </x>
            </search>
        </iq>`;

    let iq_result;
    try {
        iq_result = await api.sendIQ(iq);
    } catch (e) {
        log.error(e);
        return [];
    }
    const s = `result[xmlns="${Strophe.NS.MUCSEARCH}"] item`;
    return sizzle(s, iq_result).map(i => {
        const jid = i.getAttribute('address');
        return {
            'label': `${i.querySelector('name')?.textContent} (${jid})`,
            'value': jid
        }
    });
}

/**
 * @param {string} query
 */
export function getAutoCompleteList (query) {
    if (!rooms_cache[query]) {
        rooms_cache[query] = searchRooms(query);
    }
    return rooms_cache[query];
}
