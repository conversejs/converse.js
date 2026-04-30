import { _converse, api, converse, log, constants } from "@converse/headless";

const { Stanza, Strophe, stx } = converse.env;
const { CHATROOMS_TYPE } = constants;

async function disablePushAppServer (domain, push_app_server) {
    if (!push_app_server.jid) {
        return;
    }
    const bare_jid = _converse.session.get('bare_jid');
    if (!(await api.disco.supports(Strophe.NS.PUSH, domain || bare_jid))) {
        log.warn(`Not disabling push app server "${push_app_server.jid}", no disco support from your server.`);
        return;
    }
    const stanza = stx`
        <iq type="set"
            ${domain !== bare_jid ? Stanza.unsafeXML(`to="${domain}"`) : ''}
            xmlns="jabber:client">
            <disable xmlns="${Strophe.NS.PUSH}"
                jid="${push_app_server.jid}"
                ${push_app_server.node ? Stanza.unsafeXML(`node="${push_app_server.node}"`) : ''}>
            </disable>
        </iq>`;
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
    const bare_jid = _converse.session.get('bare_jid');

    const stanza = stx`
        <iq type="set"
            ${domain !== bare_jid ? Stanza.unsafeXML(`to="${domain}"`) : ''}
            xmlns="jabber:client">
            <enable xmlns="${Strophe.NS.PUSH}"
                    jid="${push_app_server.jid}"
                    node="${push_app_server.node}">
                ${push_app_server.secret ? stx`
                    <x xmlns="${Strophe.NS.XFORM}" type="submit">
                        <field var="FORM_TYPE">
                            <value>${Strophe.NS.PUBSUB}#publish-options</value>
                        </field>
                        <field var="secret">
                            <value>${push_app_server.secret}</value>
                        </field>
                    </x>` : ''}
            </enable>
        </iq>`;
    return api.sendIQ(stanza);
}

/**
 * @param {string} [domain]
 */
export async function enablePush (domain) {
    if (!domain) {
        const bare_jid = _converse.session.get('bare_jid');
        domain = bare_jid;
    }
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
    if (model.get('type') == CHATROOMS_TYPE) {
        enablePush(Strophe.getDomainFromJid(model.get('jid')));
    }
}
