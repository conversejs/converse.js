(function (root, factory) {
    define([
        "jasmine",
        "jquery",
        "converse-core",
        "mock",
        "test-utils"], factory);
} (this, function (jasmine, $, converse, mock, test_utils) {
    "use strict";
    var Strophe = converse.env.Strophe;
    var $iq = converse.env.$iq;
    var _ = converse.env._;

    describe("XEP-0363: HTTP File Upload", function () {

        describe("Discovering support", function () {

            it("is done automatically", mock.initConverseWithAsync(function (done, _converse) {
                var IQ_stanzas = _converse.connection.IQ_stanzas;
                var IQ_ids =  _converse.connection.IQ_ids;
                test_utils.waitUntil(function () {
                    return _.filter(IQ_stanzas, function (iq) {
                        return iq.nodeTree.querySelector('query[xmlns="http://jabber.org/protocol/disco#info"]');
                    }).length > 0;
                }, 300).then(function () {
                    /* <iq type='result'
                     *      from='plays.shakespeare.lit'
                     *      to='romeo@montague.net/orchard'
                     *      id='info1'>
                     *  <query xmlns='http://jabber.org/protocol/disco#info'>
                     *      <identity
                     *          category='server'
                     *          type='im'/>
                     *      <feature var='http://jabber.org/protocol/disco#info'/>
                     *      <feature var='http://jabber.org/protocol/disco#items'/>
                     *  </query>
                     *  </iq>
                     */
                    var info_IQ_id = IQ_ids[0];
                    var stanza = $iq({
                        'type': 'result',
                        'from': 'localhost',
                        'to': 'dummy@localhost/resource',
                        'id': info_IQ_id
                    }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                        .c('identity', {
                            'category': 'server',
                            'type': 'im'}).up()
                        .c('feature', {
                            'var': 'http://jabber.org/protocol/disco#info'}).up()
                        .c('feature', {
                            'var': 'http://jabber.org/protocol/disco#items'});
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    var entities = _converse.disco_entities;
                    expect(entities.length).toBe(2); // We have an extra entity, which is the user's JID
                    expect(entities.get(_converse.domain).features.length).toBe(2);
                    expect(entities.get(_converse.domain).identities.length).toBe(1);

                    return test_utils.waitUntil(function () {
                        // Converse.js sees that the entity has a disco#items feature,
                        // so it will make a query for it.
                        return _.filter(IQ_stanzas, function (iq) {
                            return iq.nodeTree.querySelector('query[xmlns="http://jabber.org/protocol/disco#items"]');
                        }).length > 0;
                    }, 300);
                }).then(function () {
                    /* <iq from='montague.tld'
                     *      id='step_01'
                     *      to='romeo@montague.tld/garden'
                     *      type='result'>
                     *  <query xmlns='http://jabber.org/protocol/disco#items'>
                     *      <item jid='upload.montague.tld' name='HTTP File Upload' />
                     *      <item jid='conference.montague.tld' name='Chatroom Service' />
                     *  </query>
                     *  </iq>
                     */
                   var items_IQ_id = IQ_ids[IQ_ids.length-1];
                   var stanza = $iq({
                       'type': 'result',
                       'from': 'localhost',
                       'to': 'dummy@localhost/resource',
                       'id': items_IQ_id
                   }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#items'})
                       .c('item', {
                           'jid': 'upload.localhost',
                           'name': 'HTTP File Upload'}).up()
                       .c('item', {
                           'jid': 'conference.localhost',
                           'name': 'Chatrooms Service'});
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    var entities = _converse.disco_entities;
                    expect(entities.length).toBe(4); // We have an extra entity, which is the user's JID

                    return test_utils.waitUntil(function () {
                        // Converse.js sees that the entity has a disco#items feature,
                        // so it will make a query for it.
                        return _.filter(IQ_stanzas, function (iq) {
                            return iq.nodeTree.querySelector('iq[to="upload.localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                        }).length > 0;
                    }, 300);
                }).then(function () {
                    var stanza = _.filter(IQ_stanzas, function (iq) {
                        return iq.nodeTree.querySelector('iq[to="upload.localhost"] query[xmlns="http://jabber.org/protocol/disco#info"]');
                    })[0];
                    var IQ_id = IQ_ids[IQ_stanzas.indexOf(stanza)];
                    expect(stanza.toLocaleString()).toBe(
                        "<iq from='dummy@localhost/resource' to='upload.localhost' type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                            "<query xmlns='http://jabber.org/protocol/disco#info'/>"+
                        "</iq>");

                    // Upload service responds and reports a maximum file size of 5MiB
                    /* <iq from='upload.montague.tld'
                     *     id='step_02'
                     *     to='romeo@montague.tld/garden'
                     *     type='result'>
                     * <query xmlns='http://jabber.org/protocol/disco#info'>
                     *     <identity category='store'
                     *             type='file'
                     *             name='HTTP File Upload' />
                     *     <feature var='urn:xmpp:http:upload:0' />
                     *     <x type='result' xmlns='jabber:x:data'>
                     *     <field var='FORM_TYPE' type='hidden'>
                     *         <value>urn:xmpp:http:upload:0</value>
                     *     </field>
                     *     <field var='max-file-size'>
                     *         <value>5242880</value>
                     *     </field>
                     *     </x>
                     * </query>
                     * </iq>
                     */
                    stanza = $iq({'type': 'result', 'to': 'dummy@localhost/resource', 'id': IQ_id, 'from': 'upload.localhost'})
                        .c('query', {'xmlns': 'http://jabber.org/protocol/disco#info'})
                            .c('identity', {'category':'store', 'type':'file', 'name':'HTTP File Upload'}).up()
                            .c('feature', {'var':'urn:xmpp:http:upload:0'}).up()
                            .c('x', {'type':'result', 'xmlns':'jabber:x:data'})
                                .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                                    .c('value').t('urn:xmpp:http:upload:0').up().up()
                                .c('field', {'var':'max-file-size'})
                                    .c('value').t('5242880');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    var entities = _converse.disco_entities;
                    expect(entities.get('upload.localhost').identities.where({'category': 'store'}).length).toBe(1);
                    done();
                })
            }));
        });
    });
}));
