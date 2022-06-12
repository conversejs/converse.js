import log from "@converse/headless/log";
import { _converse, api, converse } from "@converse/headless/core";

const { Strophe, $iq, sizzle } = converse.env;

Strophe.addNamespace('MUCSEARCH', 'https://xmlns.zombofant.net/muclumbus/search/1.0');

const rooms_cache = {};

async function searchRooms (query) {
    const iq = $iq({
        'type': 'get',
        'from': _converse.bare_jid,
        'to': 'api@search.jabber.network'
    }).c('search', { 'xmlns': Strophe.NS.MUCSEARCH })
        .c('set', { 'xmlns': Strophe.NS.RSM })
            .c('max').t(10).up().up()
        .c('x', { 'xmlns': Strophe.NS.XFORM, 'type': 'submit' })
            .c('field', { 'var': 'FORM_TYPE', 'type': 'hidden' })
                .c('value').t('https://xmlns.zombofant.net/muclumbus/search/1.0#params').up().up()
            .c('field', { 'var': 'q', 'type': 'text-single' })
                .c('value').t(query).up().up()
            .c('field', { 'var': 'sinname', 'type': 'boolean' })
                .c('value').t('true').up().up()
            .c('field', { 'var': 'sindescription', 'type': 'boolean' })
                .c('value').t('false').up().up()
            .c('field', { 'var': 'sinaddr', 'type': 'boolean' })
                .c('value').t('true').up().up()
            .c('field', { 'var': 'min_users', 'type': 'text-single' })
                .c('value').t('1').up().up()
            .c('field', { 'var': 'key', 'type': 'list-single' })
                .c('value').t('address').up()
                .c('option').c('value').t('nusers').up().up()
                .c('option').c('value').t('address')

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

export function getAutoCompleteList (query) {
    if (!rooms_cache[query]) {
        rooms_cache[query] = searchRooms(query);
    }
    return rooms_cache[query];
}
