// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/* This is a Converse.js plugin which add support for registering
 * an "App Server" as defined in  XEP-0357
 */
(function (root, factory) {
    define(["converse-core"], factory);
}(this, function (converse) {
    "use strict";
    const { Strophe, $iq, _ } = converse.env;


    Strophe.addNamespace('PUSH', 'urn:xmpp:push:0');


    converse.plugins.add('converse-push', {

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                  { __ } = _converse;

            _converse.api.settings.update({
                'push_services': [],
            });

            function disablePushService (push_service) {
                if (!push_service.jid) {
                    return;
                }
                Promise.all([
                    _converse.api.disco.supports(Strophe.NS.PUSH, _converse.bare_jid)
                ]).then((result) => {
                    if (!result[0].length && !result[1].length) {
                        return _converse.log(
                            `Not disabling push service "${push_service.jid}", no disco support from your server.`,
                            Strophe.LogLevel.WARN
                        );
                    }
                    const stanza = $iq({'type': 'set'})
                        .c('disable', {
                            'xmlns': Strophe.NS.PUSH,
                            'jid': push_service.jid,
                        });
                    if (push_service.node) {
                        stanza.attrs({'node': push_service.node});
                    }

                    _converse.api.sendIQ(stanza)
                        .then(() => _converse.session.set('push_enabled', true))
                        .catch((e) => {
                            _converse.log(`Could not enable push service for ${push_service.jid}`, Strophe.LogLevel.ERROR);
                            _converse.log(e, Strophe.LogLevel.ERROR);
                        });
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            }

            function enablePushService (push_service) {
                if (!push_service.jid || !push_service.node) {
                    return;
                }
                _converse.api.disco.getIdentity('pubsub', 'push', push_service.jid)
                .then((identity) => {
                    if (!identity) {
                        return _converse.log(
                            `Not enabling push the service "${push_service.jid}", it doesn't have the right disco identtiy.`,
                            Strophe.LogLevel.WARN
                        );
                    }
                    return Promise.all([
                        _converse.api.disco.supports(Strophe.NS.PUSH, push_service.jid),
                        _converse.api.disco.supports(Strophe.NS.PUSH, _converse.bare_jid)
                    ]).then((result) => {
                        if (!result[0].length && !result[1].length) {
                            return _converse.log(
                                `Not enabling push service "${push_service.jid}", no disco support from your server.`,
                                Strophe.LogLevel.WARN
                            );
                        }
                        const stanza = $iq({'type': 'set'})
                            .c('enable', {
                                'xmlns': Strophe.NS.PUSH,
                                'jid': push_service.jid,
                                'node': push_service.node
                            });
                        if (push_service.secret) {
                            stanza.c('x', {'xmlns': Strophe.NS.XFORM, 'type': 'submit'})
                                .c('field', {'var': 'FORM_TYPE'})
                                    .c('value').t(`${Strophe.NS.PUBSUB}#publish-options`).up().up()
                                .c('field', {'var': 'secret'})
                                    .c('value').t(push_service.secret);
                        }
                        _converse.api.sendIQ(stanza)
                            .then(() => _converse.session.set('push_enabled', true))
                            .catch((e) => {
                                _converse.log(`Could not enable push service for ${push_service.jid}`, Strophe.LogLevel.ERROR);
                                _converse.log(e, Strophe.LogLevel.ERROR);
                            });
                    }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            }

            function enablePush () {
                if (_converse.session.get('push_enabled')) {
                    // XXX: this code is still a bit naive. We set push_enabled
                    // to true as soon as the first push service has been set.
                    //
                    // When enabling or disabling multiple push services,
                    // we won't wait until we have confirmation that all have been set.
                    return;
                }
                const enabled_services = _.reject(_converse.push_services, 'disable');
                _.each(enabled_services, enablePushService);

                const disabled_services = _.filter(_converse.push_services, 'disable');
                _.each(disabled_services, disablePushService);
            }
            _converse.api.listen.on('statusInitialized', enablePush);
        }
    });
}));
