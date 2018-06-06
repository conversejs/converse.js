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
    const { Strophe, $iq } = converse.env;


    Strophe.addNamespace('PUSH', 'urn:xmpp:push:0');

    
    converse.plugins.add('converse-push', {

        initialize () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            const { _converse } = this,
                  { __ } = _converse;

            _converse.api.settings.update({
                'push_service': undefined,
                'push_service_node': undefined,
                'push_service_secret': undefined
            });

            function enablePush() {
                if (_converse.session.get('push_enabled')) {
                    return;
                }
                if (_converse.push_service && _converse.push_service_node) {
                    Promise.all([
                        _converse.api.disco.getIdentity('pubsub', 'push', _converse.push_service),
                        _converse.api.disco.supports(Strophe.NS.PUSH, _converse.push_service)
                    ]).then(() => _converse.api.disco.supports(Strophe.NS.PUSH, _converse.bare_jid))
                      .then(() => {
                        const stanza = $iq({'type': 'set'})
                            .c('enable', {
                                'xmlns': Strophe.NS.PUSH,
                                'jid': _converse.push_service,
                                'node': _converse.push_service_node
                            });
                          if (_converse.push_service_secret) {
                              stanza.c('x', {'xmlns': Strophe.NS.XFORM, 'type': 'submit'})
                                .c('field', {'var': 'FORM_TYPE'})
                                    .c('value').t(`${Strophe.NS.PUBSUB}#publish-options`).up().up()
                                .c('field', {'var': 'secret'})
                                    .c('value').t(_converse.push_service_secret);
                          }
                        _converse.api.sendIQ(stanza)
                          .then(() => _converse.session.set('push_enabled', true))
                          .catch((e) => {
                              _converse.log(`Could not enable push service for ${_converse.push_service}`, Strophe.LogLevel.ERROR);
                              _converse.log(e, Strophe.LogLevel.ERROR);
                          });
                    });
                }
            }
            _converse.api.listen.on('statusInitialized', enablePush);
        }
    });
}));
