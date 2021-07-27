import log from "@converse/headless/log";
import { _converse, api, converse } from "@converse/headless/core";

const { Strophe, $iq } = converse.env;

async function disablePushAppServer (domain, push_app_server) {
    if (!push_app_server.jid) {
        return;
    }
    if (!(await api.disco.supports(Strophe.NS.PUSH, domain || _converse.bare_jid))) {
        log.warn(`Not disabling push app server "${push_app_server.jid}", no disco support from your server.`);
        return;
    }
    const stanza = $iq({'type': 'set'});
    if (domain !== _converse.bare_jid) {
        stanza.attrs({'to': domain});
    }
    stanza.c('disable', {
        'xmlns': Strophe.NS.PUSH,
        'jid': push_app_server.jid,
    });
    if (push_app_server.node) {
        stanza.attrs({'node': push_app_server.node});
    }
    api.sendIQ(stanza)
    .catch(e => {
        log.error(`Could not disable push app server for ${push_app_server.jid}`);
        log.error(e);
    });
}

async function enablePushAppServer (domain, push_app_server) {
    if (!push_app_server.jid || !push_app_server.node) {
        return;
    }
    const identity = await api.disco.getIdentity('pubsub', 'push', push_app_server.jid);
    if (!identity) {
        return log.warn(
            `Not enabling push the service "${push_app_server.jid}", it doesn't have the right disco identtiy.`
        );
    }
    const result = await Promise.all([
        api.disco.supports(Strophe.NS.PUSH, push_app_server.jid),
        api.disco.supports(Strophe.NS.PUSH, domain)
    ]);
    if (!result[0] && !result[1]) {
        log.warn(`Not enabling push app server "${push_app_server.jid}", no disco support from your server.`);
        return;
    }
    const stanza = $iq({'type': 'set'});
    if (domain !== _converse.bare_jid) {
        stanza.attrs({'to': domain});
    }
    stanza.c('enable', {
        'xmlns': Strophe.NS.PUSH,
        'jid': push_app_server.jid,
        'node': push_app_server.node
    });
    if (push_app_server.secret) {
        stanza.c('x', {'xmlns': Strophe.NS.XFORM, 'type': 'submit'})
            .c('field', {'var': 'FORM_TYPE'})
                .c('value').t(`${Strophe.NS.PUBSUB}#publish-options`).up().up()
            .c('field', {'var': 'secret'})
                .c('value').t(push_app_server.secret);
    }
    return api.sendIQ(stanza);
}

export async function enablePush (domain) {
    domain = domain || _converse.bare_jid;
    const push_enabled = _converse.session.get('push_enabled') || [];
    if (push_enabled.includes(domain)) {
        return;
    }
    const enabled_services = api.settings.get('push_app_servers').filter(s => !s.disable);
    const disabled_services = api.settings.get('push_app_servers').filter(s => s.disable);
    const enabled = enabled_services.map(s => enablePushAppServer(domain, s));
    const disabled = disabled_services.map(s => disablePushAppServer(domain, s));
    try {
        await Promise.all(enabled.concat(disabled));
    } catch (e) {
        log.error('Could not enable or disable push App Server');
        if (e) log.error(e);
    } finally {
        push_enabled.push(domain);
    }
    _converse.session.save('push_enabled', push_enabled);
}

export function onChatBoxAdded (model) {
    if (model.get('type') == _converse.CHATROOMS_TYPE) {
        enablePush(Strophe.getDomainFromJid(model.get('jid')));
    }
}
