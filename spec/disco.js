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

    describe("Service Discovery", function () {

        describe("Whenever converse.js queries a server for its features", function () {
            it("stores the features it receives", mock.initConverseWithAsync(function (done, _converse) {
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
                     *      <identity
                     *          category='conference'
                     *          type='text'
                     *          name='Play-Specific Chatrooms'/>
                     *      <identity
                     *          category='directory'
                     *          type='chatroom'
                     *          name='Play-Specific Chatrooms'/>
                     *      <feature var='http://jabber.org/protocol/disco#info'/>
                     *      <feature var='http://jabber.org/protocol/disco#items'/>
                     *      <feature var='http://jabber.org/protocol/muc'/>
                     *      <feature var='jabber:iq:register'/>
                     *      <feature var='jabber:iq:search'/>
                     *      <feature var='jabber:iq:time'/>
                     *      <feature var='jabber:iq:version'/>
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
                        .c('identity', {
                            'category': 'conference',
                            'type': 'text',
                            'name': 'Play-Specific Chatrooms'}).up()
                        .c('identity', {
                            'category': 'directory',
                            'type': 'chatroom',
                            'name': 'Play-Specific Chatrooms'}).up()
                        .c('feature', {
                            'var': 'http://jabber.org/protocol/disco#info'}).up()
                        .c('feature', {
                            'var': 'http://jabber.org/protocol/disco#items'}).up()
                        .c('feature', {
                            'var': 'jabber:iq:register'}).up()
                        .c('feature', {
                            'var': 'jabber:iq:time'}).up()
                        .c('feature', {
                            'var': 'jabber:iq:version'});
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    var entities = _converse.disco_entities;
                    expect(entities.length).toBe(1);
                    expect(entities.get(_converse.domain).features.length).toBe(5);
                    expect(entities.get(_converse.domain).identities.length).toBe(3);
                    expect(entities.get('localhost').features.where({'var': 'jabber:iq:version'}).length).toBe(1);
                    expect(entities.get('localhost').features.where({'var': 'jabber:iq:time'}).length).toBe(1);
                    expect(entities.get('localhost').features.where({'var': 'jabber:iq:register'}).length).toBe(1);
                    expect(entities.get('localhost').features.where(
                        {'var': 'http://jabber.org/protocol/disco#items'}).length).toBe(1);
                    expect(entities.get('localhost').features.where(
                        {'var': 'http://jabber.org/protocol/disco#info'}).length).toBe(1);


                test_utils.waitUntil(function () {
                    // Converse.js sees that the entity has a disco#items feature,
                    // so it will make a query for it.
                    return _.filter(IQ_stanzas, function (iq) {
                        return iq.nodeTree.querySelector('query[xmlns="http://jabber.org/protocol/disco#items"]');
                    }).length > 0;
                }, 300).then(function () {
                    /* <iq type='result'
                     *     from='catalog.shakespeare.lit'
                     *     to='romeo@montague.net/orchard'
                     *     id='items2'>
                     * <query xmlns='http://jabber.org/protocol/disco#items'>
                     *     <item jid='people.shakespeare.lit'
                     *         name='Directory of Characters'/>
                     *     <item jid='plays.shakespeare.lit'
                     *         name='Play-Specific Chatrooms'/>
                     *     <item jid='mim.shakespeare.lit'
                     *         name='Gateway to Marlowe IM'/>
                     *     <item jid='words.shakespeare.lit'
                     *         name='Shakespearean Lexicon'/>
                     *
                     *     <item jid='catalog.shakespeare.lit'
                     *         node='books'
                     *         name='Books by and about Shakespeare'/>
                     *     <item jid='catalog.shakespeare.lit'
                     *         node='clothing'
                     *         name='Wear your literary taste with pride'/>
                     *     <item jid='catalog.shakespeare.lit'
                     *         node='music'
                     *         name='Music from the time of Shakespeare'/>
                     * </query>
                     * </iq>
                     */
                   var items_IQ_id = IQ_ids.pop();
                   stanza = $iq({
                       'type': 'result',
                       'from': 'localhost',
                       'to': 'dummy@localhost/resource',
                       'id': items_IQ_id
                   }).c('query', {'xmlns': 'http://jabber.org/protocol/disco#items'})
                       .c('item', {
                           'jid': 'people.shakespeare.lit',
                           'name': 'Directory of Characters'}).up()
                       .c('item', {
                           'jid': 'plays.shakespeare.lit',
                           'name': 'Play-Specific Chatrooms'}).up()
                       .c('item', {
                           'jid': 'words.shakespeare.lit',
                           'name': 'Gateway to Marlowe IM'}).up()
                       .c('item', {
                           'jid': 'localhost',
                           'name': 'Shakespearean Lexicon'}).up()

                       .c('item', {
                           'jid': 'localhost',
                           'node': 'books',
                           'name': 'Books by and about Shakespeare'}).up()
                       .c('item', {
                           'node': 'localhost',
                           'name': 'Wear your literary taste with pride'}).up()
                       .c('item', {
                           'jid': 'localhost',
                           'node': 'music',
                           'name': 'Music from the time of Shakespeare'
                       });
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    entities = _converse.disco_entities;
                    expect(entities.length).toBe(4);
                    expect(entities.get(_converse.domain).identities.where({'category': 'conference'}).length).toBe(1);
                    expect(entities.get(_converse.domain).identities.where({'category': 'directory'}).length).toBe(1);
                    done();
                });
                });
            }));
        });

        describe("Whenever converse.js discovers a new server feature", function () {
           it("emits the serviceDiscovered event",
                mock.initConverseWithPromises(
                    null, ['discoInitialized'], {},
                    function (done, _converse) {

                sinon.spy(_converse, 'emit');
                _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                expect(_converse.emit.called).toBe(true);
                expect(_converse.emit.args[0][0]).toBe('serviceDiscovered');
                expect(_converse.emit.args[0][1].get('var')).toBe(Strophe.NS.MAM);
                done();
            }));
        });
    });
}));
