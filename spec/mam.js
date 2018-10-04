(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    var _ = converse.env._;
    var Backbone = converse.env.Backbone;
    var Strophe = converse.env.Strophe;
    var $iq = converse.env.$iq;
    var $msg = converse.env.$msg;
    var moment = converse.env.moment;
    // See: https://xmpp.org/rfcs/rfc3921.html

    describe("Message Archive Management", function () {
        // Implement the protocol defined in https://xmpp.org/extensions/xep-0313.html#config

        describe("Archived Messages", function () {

           it("aren't shown as duplicates", 
                mock.initConverseWithPromises(
                    null, ['discoInitialized'], {},
                    function (done, _converse) {

                let view, stanza;

                test_utils.openAndEnterChatRoom(_converse, 'trek-radio', 'conference.lightwitch.org', 'jcbrand')
                .then(() => {
                    view = _converse.chatboxviews.get('trek-radio@conference.lightwitch.org');
                    stanza = Strophe.xmlHtmlNode(
                        `<message xmlns="jabber:client" to="jcbrand@lightwitch.org/converse.js-73057452" type="groupchat" from="trek-radio@conference.lightwitch.org/comndrdukath#0805 (STO)">
                            <body>negan</body>
                            <stanza-id xmlns="urn:xmpp:sid:0" id="45fbbf2a-1059-479d-9283-c8effaf05621" by="trek-radio@conference.lightwitch.org"/>
                         </message>`).firstElementChild;
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    return test_utils.waitUntil(() => view.content.querySelectorAll('.chat-msg').length)
                }).then(() => {
                    // XXX: we wait here until the first message appears before
                    // sending the duplicate. If we don't do that, then the
                    // duplicate appears before the promise for `createMessage`
                    // has been resolved, which means that the `isDuplicate`
                    // check fails because the first message doesn't exist yet.
                    //
                    // Not sure whether such a race-condition might pose a problem
                    // in "real-world" situations.
                    stanza = Strophe.xmlHtmlNode(
                        `<message xmlns="jabber:client" to="jcbrand@lightwitch.org/converse.js-73057452">
                            <result xmlns="urn:xmpp:mam:2" queryid="82d9db27-6cf8-4787-8c2c-5a560263d823" id="45fbbf2a-1059-479d-9283-c8effaf05621">
                                <forwarded xmlns="urn:xmpp:forward:0"><delay xmlns="urn:xmpp:delay" stamp="2018-01-09T06:17:23Z"/>
                                    <message from="trek-radio@conference.lightwitch.org/comndrdukath#0805 (STO)" type="groupchat">
                                        <body>negan</body>
                                    </message>
                                </forwarded>
                            </result>
                        </message>`).firstElementChild;

                    spyOn(view.model, 'isDuplicate').and.callThrough();
                    view.model.onMessage(stanza);
                    return test_utils.waitUntil(() => view.model.isDuplicate.calls.count());
                }).then(() => {
                    expect(view.content.querySelectorAll('.chat-msg').length).toBe(1);
                    done();
                }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
            }))
        });

        describe("The archive.query API", function () {

           it("can be used to query for all archived messages",
                mock.initConverseWithPromises(
                    null, ['discoInitialized'], {},
                    function (done, _converse) {

                var sent_stanza, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!_converse.disco_entities.get(_converse.domain).features.findWhere({'var': Strophe.NS.MAM})) {
                    _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                }
                _converse.api.archive.query();
                var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                expect(sent_stanza.toString()).toBe(
                    `<iq id="${IQ_id}" type="set" xmlns="jabber:client"><query queryid="${queryid}" xmlns="urn:xmpp:mam:2"/></iq>`);
                done();
            }));

           it("can be used to query for all messages to/from a particular JID",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }
                    var sent_stanza, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    _converse.api.archive.query({'with':'juliet@capulet.lit'});
                    var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                    expect(sent_stanza.toString()).toBe(
                        `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                            `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                                `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>urn:xmpp:mam:2</value>`+
                                `</field>`+
                                `<field var="with">`+
                                    `<value>juliet@capulet.lit</value>`+
                                `</field>`+
                                `</x>`+
                            `</query>`+
                        `</iq>`);
                    done();
                });
            }));

           it("can be used to query for archived messages from a chat room",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }

                    var sent_stanza, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    var callback = jasmine.createSpy('callback');

                    _converse.api.archive.query({'with': 'coven@chat.shakespeare.lit', 'groupchat': true}, callback);
                    var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');

                    expect(sent_stanza.toString()).toBe(
                        `<iq id="${IQ_id}" to="coven@chat.shakespeare.lit" type="set" xmlns="jabber:client">`+
                            `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                                `<x type="submit" xmlns="jabber:x:data">`+
                                    `<field type="hidden" var="FORM_TYPE">`+
                                        `<value>urn:xmpp:mam:2</value>`+
                                    `</field>`+
                                `</x>`+
                            `</query>`+
                        `</iq>`);
                    done();
                });
           }));

            it("checks whether returned MAM messages from a MUC room are from the right JID",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }
                    var sent_stanza, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    var callback = jasmine.createSpy('callback');

                    _converse.api.archive.query({'with': 'coven@chat.shakespear.lit', 'groupchat': true, 'max':'10'}, callback);
                    var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');

                    /* <message id='iasd207' from='coven@chat.shakespeare.lit' to='hag66@shakespeare.lit/pda'>
                     *     <result xmlns='urn:xmpp:mam:2' queryid='g27' id='34482-21985-73620'>
                     *         <forwarded xmlns='urn:xmpp:forward:0'>
                     *         <delay xmlns='urn:xmpp:delay' stamp='2002-10-13T23:58:37Z'/>
                     *         <message xmlns="jabber:client"
                     *             from='coven@chat.shakespeare.lit/firstwitch'
                     *             id='162BEBB1-F6DB-4D9A-9BD8-CFDCC801A0B2'
                     *             type='groupchat'>
                     *             <body>Thrice the brinded cat hath mew'd.</body>
                     *             <x xmlns='http://jabber.org/protocol/muc#user'>
                     *             <item affiliation='none'
                     *                     jid='witch1@shakespeare.lit'
                     *                     role='participant' />
                     *             </x>
                     *         </message>
                     *         </forwarded>
                     *     </result>
                     * </message>
                     */
                    var msg1 = $msg({'id':'iasd207', 'from': 'other@chat.shakespear.lit', 'to': 'dummy@localhost'})
                                .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'34482-21985-73620'})
                                    .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                        .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                        .c('message', {
                                            'xmlns':'jabber:client',
                                            'to':'dummy@localhost',
                                            'id':'162BEBB1-F6DB-4D9A-9BD8-CFDCC801A0B2',
                                            'from':'coven@chat.shakespeare.lit/firstwitch',
                                            'type':'groupchat' })
                                        .c('body').t("Thrice the brinded cat hath mew'd.");
                    _converse.connection._dataRecv(test_utils.createRequest(msg1));

                    /* Send an <iq> stanza to indicate the end of the result set.
                     *
                     * <iq type='result' id='juliet1'>
                     *     <fin xmlns='urn:xmpp:mam:2'>
                     *     <set xmlns='http://jabber.org/protocol/rsm'>
                     *         <first index='0'>28482-98726-73623</first>
                     *         <last>09af3-cc343-b409f</last>
                     *         <count>20</count>
                     *     </set>
                     * </iq>
                     */
                    var stanza = $iq({'type': 'result', 'id': IQ_id})
                        .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                            .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                                .c('first', {'index': '0'}).t('23452-4534-1').up()
                                .c('last').t('09af3-cc343-b409f').up()
                                .c('count').t('16');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    expect(callback).toHaveBeenCalled();
                    var args = callback.calls.argsFor(0);
                    expect(args[0].length).toBe(0);
                    done();
                });
           }));

           it("can be used to query for all messages in a certain timespan",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                var sent_stanza, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.api.disco.entities.get().then(function (entities) {
                    if (!entities.get(_converse.domain).features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }
                    var start = '2010-06-07T00:00:00Z';
                    var end = '2010-07-07T13:23:54Z';
                    _converse.api.archive.query({
                        'start': start,
                        'end': end

                    });
                    var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                    expect(sent_stanza.toString()).toBe(
                        `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                            `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                                `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>urn:xmpp:mam:2</value>`+
                                `</field>`+
                                `<field var="start">`+
                                    `<value>${moment(start).format()}</value>`+
                                `</field>`+
                                `<field var="end">`+
                                    `<value>${moment(end).format()}</value>`+
                                `</field>`+
                                `</x>`+
                            `</query>`+
                        `</iq>`
                    );
                    done();
                });
           }));

           it("throws a TypeError if an invalid date is provided",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }
                    expect(_.partial(_converse.api.archive.query, {'start': 'not a real date'})).toThrow(
                        new TypeError('archive.query: invalid date provided for: start')
                    );
                    done();
                });
           }));

           it("can be used to query for all messages after a certain time",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }
                    var sent_stanza, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    if (!_converse.disco_entities.get(_converse.domain).features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }
                    var start = '2010-06-07T00:00:00Z';
                    _converse.api.archive.query({'start': start});
                    var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                    expect(sent_stanza.toString()).toBe(
                        `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                            `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                                `<x type="submit" xmlns="jabber:x:data">`+
                                `<field type="hidden" var="FORM_TYPE">`+
                                    `<value>urn:xmpp:mam:2</value>`+
                                `</field>`+
                                `<field var="start">`+
                                    `<value>${moment(start).format()}</value>`+
                                `</field>`+
                                `</x>`+
                            `</query>`+
                        `</iq>`
                    );
                    done();
                });
           }));

           it("can be used to query for a limited set of results",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }

                    var sent_stanza, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    var start = '2010-06-07T00:00:00Z';
                    _converse.api.archive.query({'start': start, 'max':10});
                    var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                    expect(sent_stanza.toString()).toBe(
                        `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                            `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                                `<x type="submit" xmlns="jabber:x:data">`+
                                    `<field type="hidden" var="FORM_TYPE">`+
                                        `<value>urn:xmpp:mam:2</value>`+
                                    `</field>`+
                                    `<field var="start">`+
                                        `<value>${moment(start).format()}</value>`+
                                    `</field>`+
                                `</x>`+
                                `<set xmlns="http://jabber.org/protocol/rsm">`+
                                    `<max>10</max>`+
                                `</set>`+
                            `</query>`+
                        `</iq>`
                    );
                    done();
                });
           }));

           it("can be used to page through results",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }
                    var sent_stanza, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    var start = '2010-06-07T00:00:00Z';
                    _converse.api.archive.query({
                        'start': start,
                        'after': '09af3-cc343-b409f',
                        'max':10
                    });
                    var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                    expect(sent_stanza.toString()).toBe(
                        `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                            `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                                `<x type="submit" xmlns="jabber:x:data">`+
                                    `<field type="hidden" var="FORM_TYPE">`+
                                        `<value>urn:xmpp:mam:2</value>`+
                                    `</field>`+
                                    `<field var="start">`+
                                        `<value>${moment(start).format()}</value>`+
                                    `</field>`+
                                `</x>`+
                                `<set xmlns="http://jabber.org/protocol/rsm">`+
                                    `<max>10</max>`+
                                    `<after>09af3-cc343-b409f</after>`+
                                `</set>`+
                            `</query>`+
                        `</iq>`);
                    done();
                });
           }));

           it("accepts \"before\" with an empty string as value to reverse the order",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }
                    var sent_stanza, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    _converse.api.archive.query({'before': '', 'max':10});
                    var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                    expect(sent_stanza.toString()).toBe(
                        `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                            `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                                `<x type="submit" xmlns="jabber:x:data">`+
                                    `<field type="hidden" var="FORM_TYPE">`+
                                        `<value>urn:xmpp:mam:2</value>`+
                                    `</field>`+
                                `</x>`+
                                `<set xmlns="http://jabber.org/protocol/rsm">`+
                                    `<max>10</max>`+
                                    `<before></before>`+
                                `</set>`+
                            `</query>`+
                        `</iq>`);
                    done();
                });
           }));

           it("accepts a Strophe.RSM object for the query options",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }
                    var sent_stanza, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    // Normally the user wouldn't manually make a Strophe.RSM object
                    // and pass it in. However, in the callback method an RSM object is
                    // returned which can be reused for easy paging. This test is
                    // more for that usecase.
                    var rsm =  new Strophe.RSM({'max': '10'});
                    rsm['with'] = 'romeo@montague.lit'; // eslint-disable-line dot-notation
                    rsm.start = '2010-06-07T00:00:00Z';
                    _converse.api.archive.query(rsm);

                    var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');
                    expect(sent_stanza.toString()).toBe(
                        `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                            `<query queryid="${queryid}" xmlns="urn:xmpp:mam:2">`+
                                `<x type="submit" xmlns="jabber:x:data">`+
                                    `<field type="hidden" var="FORM_TYPE">`+
                                        `<value>urn:xmpp:mam:2</value>`+
                                    `</field>`+
                                    `<field var="with">`+
                                        `<value>romeo@montague.lit</value>`+
                                    `</field>`+
                                    `<field var="start">`+
                                        `<value>${moment(rsm.start).format()}</value>`+
                                    `</field>`+
                                `</x>`+
                                `<set xmlns="http://jabber.org/protocol/rsm">`+
                                    `<max>10</max>`+
                                `</set>`+
                            `</query>`+
                        `</iq>`);
                    done();
                });
           }));

           it("accepts a callback function, which it passes the messages and a Strophe.RSM object",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    if (!entity.features.findWhere({'var': Strophe.NS.MAM})) {
                        _converse.disco_entities.get(_converse.domain).features.create({'var': Strophe.NS.MAM});
                    }
                    var sent_stanza, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    var callback = jasmine.createSpy('callback');

                    _converse.api.archive.query({'with': 'romeo@capulet.lit', 'max':'10'}, callback);
                    var queryid = sent_stanza.nodeTree.querySelector('query').getAttribute('queryid');

                    /*  <message id='aeb213' to='juliet@capulet.lit/chamber'>
                     *  <result xmlns='urn:xmpp:mam:2' queryid='f27' id='28482-98726-73623'>
                     *      <forwarded xmlns='urn:xmpp:forward:0'>
                     *      <delay xmlns='urn:xmpp:delay' stamp='2010-07-10T23:08:25Z'/>
                     *      <message xmlns='jabber:client'
                     *          to='juliet@capulet.lit/balcony'
                     *          from='romeo@montague.lit/orchard'
                     *          type='chat'>
                     *          <body>Call me but love, and I'll be new baptized; Henceforth I never will be Romeo.</body>
                     *      </message>
                     *      </forwarded>
                     *  </result>
                     *  </message>
                     */
                    var msg1 = $msg({'id':'aeb213', 'to':'juliet@capulet.lit/chamber'})
                                .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'28482-98726-73623'})
                                    .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                        .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                        .c('message', {
                                            'xmlns':'jabber:client',
                                            'to':'juliet@capulet.lit/balcony',
                                            'from':'romeo@montague.lit/orchard',
                                            'type':'chat' })
                                        .c('body').t("Call me but love, and I'll be new baptized;");
                    _converse.connection._dataRecv(test_utils.createRequest(msg1));

                    var msg2 = $msg({'id':'aeb213', 'to':'juliet@capulet.lit/chamber'})
                                .c('result',  {'xmlns': 'urn:xmpp:mam:2', 'queryid':queryid, 'id':'28482-98726-73624'})
                                    .c('forwarded', {'xmlns':'urn:xmpp:forward:0'})
                                        .c('delay', {'xmlns':'urn:xmpp:delay', 'stamp':'2010-07-10T23:08:25Z'}).up()
                                        .c('message', {
                                            'xmlns':'jabber:client',
                                            'to':'juliet@capulet.lit/balcony',
                                            'from':'romeo@montague.lit/orchard',
                                            'type':'chat' })
                                        .c('body').t("Henceforth I never will be Romeo.");
                    _converse.connection._dataRecv(test_utils.createRequest(msg2));

                    /* Send an <iq> stanza to indicate the end of the result set.
                     *
                     * <iq type='result' id='juliet1'>
                     *     <fin xmlns='urn:xmpp:mam:2'>
                     *     <set xmlns='http://jabber.org/protocol/rsm'>
                     *         <first index='0'>28482-98726-73623</first>
                     *         <last>09af3-cc343-b409f</last>
                     *         <count>20</count>
                     *     </set>
                     * </iq>
                     */
                    var stanza = $iq({'type': 'result', 'id': IQ_id})
                        .c('fin', {'xmlns': 'urn:xmpp:mam:2'})
                            .c('set',  {'xmlns': 'http://jabber.org/protocol/rsm'})
                                .c('first', {'index': '0'}).t('23452-4534-1').up()
                                .c('last').t('09af3-cc343-b409f').up()
                                .c('count').t('16');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    expect(callback).toHaveBeenCalled();
                    var args = callback.calls.argsFor(0);
                    expect(args[0].length).toBe(2);
                    expect(args[0][0].outerHTML).toBe(msg1.nodeTree.outerHTML);
                    expect(args[0][1].outerHTML).toBe(msg2.nodeTree.outerHTML);
                    expect(args[1]['with']).toBe('romeo@capulet.lit'); // eslint-disable-line dot-notation
                    expect(args[1].max).toBe('10');
                    expect(args[1].count).toBe('16');
                    expect(args[1].first).toBe('23452-4534-1');
                    expect(args[1].last).toBe('09af3-cc343-b409f');
                    done()
                });
           }));
        });

        describe("The default preference", function () {

            it("is set once server support for MAM has been confirmed",
                    mock.initConverseWithPromises(
                        null, [], {},
                        function (done, _converse) {

                _converse.api.disco.entities.get(_converse.domain).then(function (entity) {
                    var sent_stanza, IQ_id;
                    var sendIQ = _converse.connection.sendIQ;
                    spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                        sent_stanza = iq;
                        IQ_id = sendIQ.bind(this)(iq, callback, errback);
                    });
                    spyOn(_converse, 'onMAMPreferences').and.callThrough();
                    _converse.message_archiving = 'never';

                    var feature = new Backbone.Model({
                        'var': Strophe.NS.MAM
                    });
                    spyOn(feature, 'save').and.callFake(feature.set); // Save will complain about a url not being set

                    entity.onFeatureAdded(feature);

                    expect(_converse.connection.sendIQ).toHaveBeenCalled();
                    expect(sent_stanza.toLocaleString()).toBe(
                        `<iq id="${IQ_id}" type="get" xmlns="jabber:client">`+
                            `<prefs xmlns="urn:xmpp:mam:2"/>`+
                        `</iq>`);

                    /* Example 20. Server responds with current preferences
                     *
                     * <iq type='result' id='juliet2'>
                     *   <prefs xmlns='urn:xmpp:mam:0' default='roster'>
                     *     <always/>
                     *     <never/>
                     *   </prefs>
                     * </iq>
                     */
                    var stanza = $iq({'type': 'result', 'id': IQ_id})
                        .c('prefs', {'xmlns': Strophe.NS.MAM, 'default':'roster'})
                        .c('always').c('jid').t('romeo@montague.lit').up().up()
                        .c('never').c('jid').t('montague@montague.lit');
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));

                    expect(_converse.onMAMPreferences).toHaveBeenCalled();
                    expect(_converse.connection.sendIQ.calls.count()).toBe(2);

                    expect(sent_stanza.toString()).toBe(
                        `<iq id="${IQ_id}" type="set" xmlns="jabber:client">`+
                            `<prefs default="never" xmlns="urn:xmpp:mam:2">`+
                                `<always><jid>romeo@montague.lit</jid></always>`+
                                `<never><jid>montague@montague.lit</jid></never>`+
                            `</prefs>`+
                        `</iq>`
                    );

                    expect(feature.get('preference')).toBe(undefined);
                    /* <iq type='result' id='juliet3'>
                     *   <prefs xmlns='urn:xmpp:mam:0' default='always'>
                     *       <always>
                     *          <jid>romeo@montague.lit</jid>
                     *       </always>
                     *       <never>
                     *          <jid>montague@montague.lit</jid>
                     *       </never>
                     *   </prefs>
                     * </iq>
                     */
                    stanza = $iq({'type': 'result', 'id': IQ_id})
                        .c('prefs', {'xmlns': Strophe.NS.MAM, 'default':'always'})
                        .c('always').up()
                        .c('never').up();
                    _converse.connection._dataRecv(test_utils.createRequest(stanza));
                    expect(feature.save).toHaveBeenCalled();
                    expect(feature.get('preferences')['default']).toBe('never'); // eslint-disable-line dot-notation
                    done();
                });
            }));
        });
    });
}));
