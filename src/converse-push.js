// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-push
 * @description
 * Converse.js plugin which add support for registering
 * an "App Server" as defined in  XEP-0357
 */
import converse from "@converse/headless/converse-core";

const { Strophe, $iq, _ } = converse.env;

Strophe.addNamespace('PUSH', 'urn:xmpp:push:0');


converse.plugins.add('converse-push', {

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;

        _converse.api.settings.update({
            'push_app_servers': [],
            'enable_muc_push': false
        });

        async function disablePushAppServer (domain, push_app_server) {
            if (!push_app_server.jid) {
                return;
            }
            if (!(await _converse.api.disco.supports(Strophe.NS.PUSH, domain || _converse.bare_jid))) {
                return _converse.log(
                    `Not disabling push app server "${push_app_server.jid}", no disco support from your server.`,
                    Strophe.LogLevel.WARN
                );
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
            _converse.api.sendIQ(stanza)
            .catch(e => {
                _converse.log(`Could not disable push app server for ${push_app_server.jid}`, Strophe.LogLevel.ERROR);
                _converse.log(e, Strophe.LogLevel.ERROR);
            });
        }

        async function enablePushAppServer (domain, push_app_server) {
            if (!push_app_server.jid || !push_app_server.node) {
                return;
            }
            const identity = await _converse.api.disco.getIdentity('pubsub', 'push', push_app_server.jid);
            if (!identity) {
                return _converse.log(
                    `Not enabling push the service "${push_app_server.jid}", it doesn't have the right disco identtiy.`,
                    Strophe.LogLevel.WARN
                );
            }
            const result = await Promise.all([
                _converse.api.disco.supports(Strophe.NS.PUSH, push_app_server.jid),
                _converse.api.disco.supports(Strophe.NS.PUSH, domain)
            ]);
            if (!result[0] && !result[1]) {
                return _converse.log(
                    `Not enabling push app server "${push_app_server.jid}", no disco support from your server.`,
                    Strophe.LogLevel.WARN
                );
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
            return _converse.api.sendIQ(stanza);
        }

        async function enablePush (domain) {
            domain = domain || _converse.bare_jid;
            const push_enabled = _converse.session.get('push_enabled') || [];
            if (_.includes(push_enabled, domain)) {
                return;
            }
            const enabled_services = _.reject(_converse.push_app_servers, 'disable');
            const disabled_services = _.filter(_converse.push_app_servers, 'disable');
            const enabled = _.map(enabled_services, _.partial(enablePushAppServer, domain));
            const disabled = _.map(disabled_services, _.partial(disablePushAppServer, domain));
            try {
                await Promise.all(enabled.concat(disabled));
            } catch (e) {
                _converse.log('Could not enable or disable push App Server', Strophe.LogLevel.ERROR);
                if (e) _converse.log(e, Strophe.LogLevel.ERROR);
            } finally {
                push_enabled.push(domain);
            }
            _converse.session.save('push_enabled', push_enabled);
        }
        _converse.api.listen.on('statusInitialized', () => enablePush());

        function onChatBoxAdded (model) {
            if (model.get('type') == _converse.CHATROOMS_TYPE) {
                enablePush(Strophe.getDomainFromJid(model.get('jid')));
            }
        }
        if (_converse.enable_muc_push) {
            _converse.api.listen.on('chatBoxesInitialized',  () => _converse.chatboxes.on('add', onChatBoxAdded));
        }
    }
});

