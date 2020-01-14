(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const Strophe = converse.env.Strophe,
          $iq = converse.env.$iq,
          _ = converse.env._,
          u = converse.env.utils;

    describe("Broadcast-/MOTD-Messages (XEP-0133)", function () {

        describe("Discovering support", function () {
            it("is done automatically", mock.initConverse(async (done, _converse) => {
                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const IQ_ids =  _converse.connection.IQ_ids;
                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.COMMANDS], []);

                await u.waitUntil(() => _.filter(
                    IQ_stanzas,
                    iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]')).length
                );

                /* <iq from='montague.tld'
                 *      id='step_01'
                 *      to='romeo@montague.tld/garden'
                 *      type='result'>
                 *  <query xmlns='http://jabber.org/protocol/disco#items'>
                 *      <item jid='montague.tld' name='Set message of the day and send to online users' node='http://jabber.org/protocol/admin#set-motd' />
                 *      <item jid='montague.tld' name="Update message of the day (don't send)" node='http://jabber.org/protocol/admin#edit-motd' />
                 *  </query>
                 *  </iq>
                 */
                let stanza = _.find(IQ_stanzas, function (iq) {
                    return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                });
                const items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                stanza = $iq({
                    'type': 'result',
                    'from': 'montague.lit',
                    'to': 'romeo@montague.lit/orchard',
                    'id': items_IQ_id
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#items'})
                    .c('item', {
                        'jid': 'montague.lit',
                        'name': 'Set message of the day and send to online users',
                        'node': 'http://jabber.org/protocol/admin#set-motd'})
                    .c('item', {
                        'jid': 'montague.lit',
                        'name': "Update message of the day (don't send)",
                        'node': 'http://jabber.org/protocol/admin#edit-motd'});

                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                expect(_converse.serviceAdminCommands.length).toBe(2);
                done();
            }))
        });

        describe("When not supported", function () {
            it("the service admin menu is not shown", mock.initConverse(async (done, _converse) => {
                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const IQ_ids =  _converse.connection.IQ_ids;
                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.COMMANDS], []);

                await u.waitUntil(() => _.filter(
                    IQ_stanzas,
                    iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]')).length
                );

                /* <iq from='montague.tld'
                 *      id='step_01'
                 *      to='romeo@montague.tld/garden'
                 *      type='error'>
                 *  <query node='announce' xmlns='http://jabber.org/protocol/disco#items' />
                 *   <error code='404' type='cancel'>
                 *      <item-not-found xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                 *  </error>
                 *  </iq>
                 */
                let stanza = _.find(IQ_stanzas, function (iq) {
                    return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                });
                const items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                stanza = $iq({
                    'type': 'error',
                    'from': 'montague.lit',
                    'to': 'romeo@montague.lit/orchard',
                    'id': items_IQ_id
                }).c('query', {'node':'announce', 'xmlns': 'http://jabber.org/protocol/disco#items'}).up()
                .c('error', {'code': '404', 'type': 'cancel'})
                    .c('item-not-found', {
                        'xmlns': 'urn:ietf:params:xml:ns:xmpp-stanzas'});

                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                const view = _converse.chatboxviews.get('controlbox');
                expect(view.el.querySelector('.service-admin-menu')).toBe(null);
                done();
            }))
        });

        describe("When supported", function () {
            it("the service admin menu is shown", mock.initConverse(async (done, _converse) => {
                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const IQ_ids =  _converse.connection.IQ_ids;
                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.COMMANDS], []);

                await u.waitUntil(() => _.filter(
                    IQ_stanzas,
                    iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]')).length
                );

                /* <iq from='montague.tld'
                 *      id='step_01'
                 *      to='romeo@montague.tld/garden'
                 *      type='result'>
                 *  <query xmlns='http://jabber.org/protocol/disco#items'>
                 *      <item jid='montague.tld' name='Set message of the day and send to online users' node='http://jabber.org/protocol/admin#set-motd' />
                 *      <item jid='montague.tld' name="Update message of the day (don't send)" node='http://jabber.org/protocol/admin#edit-motd' />
                 *  </query>
                 *  </iq>
                 */
                let stanza = _.find(IQ_stanzas, function (iq) {
                    return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                });
                const items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                stanza = $iq({
                    'type': 'result',
                    'from': 'montague.lit',
                    'to': 'romeo@montague.lit/orchard',
                    'id': items_IQ_id
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#items'})
                    .c('item', {
                        'jid': 'montague.lit',
                        'name': 'Set message of the day and send to online users',
                        'node': 'http://jabber.org/protocol/admin#set-motd'})
                    .c('item', {
                        'jid': 'montague.lit',
                        'name': "Update message of the day (don't send)",
                        'node': 'http://jabber.org/protocol/admin#edit-motd'});

                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                const view = _converse.chatboxviews.get('controlbox');
                expect(view.el.querySelector('.service-admin-menu')).not.toBe(null);
                done();
            }))
            it("a user may send an announce command", mock.initConverse(async (done, _converse) => {
                const IQ_stanzas = _converse.connection.IQ_stanzas;
                const IQ_ids =  _converse.connection.IQ_ids;
                await test_utils.waitUntilDiscoConfirmed(_converse, _converse.bare_jid, [], [Strophe.NS.COMMANDS], []);

                await u.waitUntil(() => _.filter(
                    IQ_stanzas,
                    iq => iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]')).length
                );

                /* <iq from='montague.tld'
                 *      id='step_01'
                 *      to='romeo@montague.tld/garden'
                 *      type='result'>
                 *  <query xmlns='http://jabber.org/protocol/disco#items'>
                 *      <item jid='montague.tld' name='Set message of the day and send to online users' node='http://jabber.org/protocol/admin#set-motd' />
                 *      <item jid='montague.tld' name="Update message of the day (don't send)" node='http://jabber.org/protocol/admin#edit-motd' />
                 *  </query>
                 *  </iq>
                 */
                let stanza = _.find(IQ_stanzas, function (iq) {
                    return iq.querySelector('iq[to="montague.lit"] query[xmlns="http://jabber.org/protocol/disco#items"]');
                });
                const items_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                stanza = $iq({
                    'type': 'result',
                    'from': 'montague.lit',
                    'to': 'romeo@montague.lit/orchard',
                    'id': items_IQ_id
                }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#items'})
                    .c('item', {
                        'jid': 'montague.lit',
                        'name': 'Set message of the day and send to online users',
                        'node': 'http://jabber.org/protocol/admin#set-motd'})
                    .c('item', {
                        'jid': 'montague.lit',
                        'name': "Update message of the day (don't send)",
                        'node': 'http://jabber.org/protocol/admin#edit-motd'});

                _converse.connection._dataRecv(test_utils.createRequest(stanza));
                let view = _converse.chatboxviews.get('controlbox');
                expect(view.el.querySelector('.service-admin-menu')).not.toBe(null);

                await test_utils.openControlBox(_converse);
                view.el.querySelector("a[title='edit-motd']").click();
                await u.waitUntil(() => _.filter(
                    IQ_stanzas,
                    iq => iq.querySelector('iq[to="montague.lit"] command[node="http://jabber.org/protocol/admin#edit-motd"]')).length
                );
                stanza = _.find(IQ_stanzas, function (iq) {
                    return iq.querySelector('iq[to="montague.lit"] command[node="http://jabber.org/protocol/admin#edit-motd"]');
                });
                expect(stanza).not.toBe(null);

                const command_IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                stanza = u.toStanza(`
                    <iq from="montague.lit" id="${command_IQ_id}" to="romeo@montague.lit/orchard" type="result" xmlns="jabber:client">
                      <command node="http://jabber.org/protocol/admin#edit-motd" status="executing" xmlns="http://jabber.org/protocol/commands">
                          <actions execute="complete">
                              <complete/>
                          </actions>
                          <x type="form" xmlns="jabber:x:data">
                              <title>Update message of the day (don't send)</title>
                              <field type="hidden" var="FORM_TYPE">
                                  <value>http://jabber.org/protocol/admin</value>
                              </field>
                              <field label="Subject" type="text-single" var="subject"/>
                             <field label="Message body" type="text-multi" var="body"/>
                          </x>
                      </command>
                    </iq>`);
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                view = _converse.chatboxviews.get(_converse.SERVICE_ADMIN_TYPE);
                const inputs = view.el.querySelectorAll('.form-control');
                inputs[0].value = 'Intelligent subject';
                inputs[1].value = 'Extraordinary content';
                spyOn(_converse.connection, 'send');
                view.el.querySelector('.send-button').click();
                expect(_converse.connection.send).toHaveBeenCalled();
                stanza = _converse.connection.send.calls.argsFor(0)[0];
                expect(Strophe.serialize(stanza)).toBe(
                    `<iq from="romeo@montague.lit/orchard" id="${stanza.getAttribute('id')}" to="montague.lit" type="set" xml:lang="en" xmlns="jabber:client">`+
                    `<command node="http://jabber.org/protocol/admin#edit-motd" xmlns="http://jabber.org/protocol/commands">`+
                    `<x type="submit" xmlns="jabber:x:data">`+
                    `<field type="hidden" var="FORM_TYPE"><value>http://jabber.org/protocol/admin</value></field>`+
                    `<field var="subject"><value>Intelligent subject</value></field>`+
                    `<field var="body"><value>Extraordinary content</value></field>`+
                    `</x></command></iq>`
                );
                done();
            }))

        });
    });
}));
