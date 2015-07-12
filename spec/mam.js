(function (root, factory) {
    define([
        "jquery",
        "mock",
        "test_utils"
        ], function ($, mock, test_utils) {
            return factory($, mock, test_utils);
        }
    );
} (this, function ($, mock, test_utils) {
    "use strict";
    var Strophe = converse_api.env.Strophe;
    var $iq = converse_api.env.$iq;
    var $pres = converse_api.env.$pres;
    // See: https://xmpp.org/rfcs/rfc3921.html

    describe("Message Archive Management", $.proxy(function (mock, test_utils) {
        // Implement the protocol defined in https://xmpp.org/extensions/xep-0313.html#config

        describe("The archive.query API", $.proxy(function (mock, test_utils) {

           it("can be used to query for all archived messages", function () {
                var sent_stanza, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    converse.features.create({'var': Strophe.NS.MAM});
                }
                converse_api.archive.query();
                var queryid = $(sent_stanza.toString()).find('query').attr('queryid');
                expect(sent_stanza.toString()).toBe(
                    "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'><query xmlns='urn:xmpp:mam:0' queryid='"+queryid+"'/></iq>");
            });

           it("can be used to query for all messages to/from a particular JID", function () {
                var sent_stanza, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    converse.features.create({'var': Strophe.NS.MAM});
                }
                converse_api.archive.query({'with':'juliet@capulet.lit'});
                var queryid = $(sent_stanza.toString()).find('query').attr('queryid');
                expect(sent_stanza.toString()).toBe(
                    "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<query xmlns='urn:xmpp:mam:0' queryid='"+queryid+"'>"+
                            "<x xmlns='jabber:x:data'>"+
                            "<field var='FORM_TYPE'>"+
                                "<value>urn:xmpp:mam:0</value>"+
                            "</field>"+
                            "<field var='with'>"+
                                "<value>juliet@capulet.lit</value>"+
                            "</field>"+
                            "</x>"+
                        "</query>"+
                    "</iq>"
                );
            });

           it("can be used to query for all messages in a certain timespan", function () {
                var sent_stanza, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    converse.features.create({'var': Strophe.NS.MAM});
                }
                // Mock the browser's method for returning the timezone
                var getTimezoneOffset = Date.prototype.getTimezoneOffset;
                Date.prototype.getTimezoneOffset = function () {
                    return -120;
                };
                converse_api.archive.query({
                    'start': '2010-06-07T00:00:00Z',
                    'end': '2010-07-07T13:23:54Z'

                });
                var queryid = $(sent_stanza.toString()).find('query').attr('queryid');
                expect(sent_stanza.toString()).toBe(
                    "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<query xmlns='urn:xmpp:mam:0' queryid='"+queryid+"'>"+
                            "<x xmlns='jabber:x:data'>"+
                            "<field var='FORM_TYPE'>"+
                                "<value>urn:xmpp:mam:0</value>"+
                            "</field>"+
                            "<field var='start'>"+
                                "<value>2010-06-07T02:00:00+02:00</value>"+
                            "</field>"+
                            "<field var='end'>"+
                                "<value>2010-07-07T15:23:54+02:00</value>"+
                            "</field>"+
                            "</x>"+
                        "</query>"+
                    "</iq>"
                );
                // Restore
                Date.prototype.getTimezoneOffset = getTimezoneOffset;
           });

           it("throws a TypeError if an invalid date is provided", function () {
                expect(_.partial(converse_api.archive.query, {'start': 'not a real date'})).toThrow(
                    new TypeError('archive.query: invalid date provided for: start')
                );
           });

           it("can be used to query for all messages after a certain time", function () {
                var sent_stanza, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    converse.features.create({'var': Strophe.NS.MAM});
                }
                // Mock the browser's method for returning the timezone
                var getTimezoneOffset = Date.prototype.getTimezoneOffset;
                Date.prototype.getTimezoneOffset = function () {
                    return -120;
                };
                converse_api.archive.query({'start': '2010-06-07T00:00:00Z'});
                var queryid = $(sent_stanza.toString()).find('query').attr('queryid');
                expect(sent_stanza.toString()).toBe(
                    "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<query xmlns='urn:xmpp:mam:0' queryid='"+queryid+"'>"+
                            "<x xmlns='jabber:x:data'>"+
                            "<field var='FORM_TYPE'>"+
                                "<value>urn:xmpp:mam:0</value>"+
                            "</field>"+
                            "<field var='start'>"+
                                "<value>2010-06-07T02:00:00+02:00</value>"+
                            "</field>"+
                            "</x>"+
                        "</query>"+
                    "</iq>"
                );
                // Restore
                Date.prototype.getTimezoneOffset = getTimezoneOffset;
           });

           it("can be used to query for a limited set of results", function () {
                var sent_stanza, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    converse.features.create({'var': Strophe.NS.MAM});
                }
                // Mock the browser's method for returning the timezone
                var getTimezoneOffset = Date.prototype.getTimezoneOffset;
                Date.prototype.getTimezoneOffset = function () {
                    return -120;
                };
                converse_api.archive.query({'start': '2010-06-07T00:00:00Z', 'max':10});
                var queryid = $(sent_stanza.toString()).find('query').attr('queryid');
                expect(sent_stanza.toString()).toBe(
                    "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<query xmlns='urn:xmpp:mam:0' queryid='"+queryid+"'>"+
                            "<x xmlns='jabber:x:data'>"+
                                "<field var='FORM_TYPE'>"+
                                    "<value>urn:xmpp:mam:0</value>"+
                                "</field>"+
                                "<field var='start'>"+
                                    "<value>2010-06-07T02:00:00+02:00</value>"+
                                "</field>"+
                            "</x>"+
                            "<set xmlns='http://jabber.org/protocol/rsm'>"+
                                "<max>10</max>"+
                            "</set>"+
                        "</query>"+
                    "</iq>"
                );
                // Restore
                Date.prototype.getTimezoneOffset = getTimezoneOffset;
           });

           it("can be used to page through results", function () {
                var sent_stanza, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    converse.features.create({'var': Strophe.NS.MAM});
                }
                // Mock the browser's method for returning the timezone
                var getTimezoneOffset = Date.prototype.getTimezoneOffset;
                Date.prototype.getTimezoneOffset = function () {
                    return -120;
                };
                converse_api.archive.query({
                    'start': '2010-06-07T00:00:00Z',
                    'after': '09af3-cc343-b409f',
                    'max':10
                });
                var queryid = $(sent_stanza.toString()).find('query').attr('queryid');
                expect(sent_stanza.toString()).toBe(
                    "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<query xmlns='urn:xmpp:mam:0' queryid='"+queryid+"'>"+
                            "<x xmlns='jabber:x:data'>"+
                                "<field var='FORM_TYPE'>"+
                                    "<value>urn:xmpp:mam:0</value>"+
                                "</field>"+
                                "<field var='start'>"+
                                    "<value>2010-06-07T02:00:00+02:00</value>"+
                                "</field>"+
                            "</x>"+
                            "<set xmlns='http://jabber.org/protocol/rsm'>"+
                                "<max>10</max>"+
                                "<after>09af3-cc343-b409f</after>"+
                            "</set>"+
                        "</query>"+
                    "</iq>"
                );
                // Restore
                Date.prototype.getTimezoneOffset = getTimezoneOffset;
           });

           it("accepts \"before\" with an empty string as value to reverse the order", function () {
                var sent_stanza, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    converse.features.create({'var': Strophe.NS.MAM});
                }
                converse_api.archive.query({'before': '', 'max':10});
                var queryid = $(sent_stanza.toString()).find('query').attr('queryid');
                expect(sent_stanza.toString()).toBe(
                    "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<query xmlns='urn:xmpp:mam:0' queryid='"+queryid+"'>"+
                            "<x xmlns='jabber:x:data'>"+
                                "<field var='FORM_TYPE'>"+
                                    "<value>urn:xmpp:mam:0</value>"+
                                "</field>"+
                            "</x>"+
                            "<set xmlns='http://jabber.org/protocol/rsm'>"+
                                "<max>10</max>"+
                                "<before></before>"+
                            "</set>"+
                        "</query>"+
                    "</iq>"
                );
           });

        }, converse, mock, test_utils));

        describe("The default preference", $.proxy(function (mock, test_utils) {

            it("is set once server support for MAM has been confirmed", function () {
                var sent_stanza, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                spyOn(converse.features, 'onMAMPreferences').andCallThrough();

                var feature = new converse.Feature({
                    'var': Strophe.NS.MAM
                });
                spyOn(feature, 'save').andCallFake(feature.set); // Save will complain about a url not being set
                converse.features.onFeatureAdded(feature);

                expect(converse.connection.sendIQ).toHaveBeenCalled();
                expect(sent_stanza.toLocaleString()).toBe(
                    "<iq type='get' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<prefs xmlns='urn:xmpp:mam:0'/>"+
                    "</iq>"
                );

                converse.message_archiving = 'never';
                /* Example 15. Server responds with current preferences
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
                converse.connection._dataRecv(test_utils.createRequest(stanza));

                expect(converse.features.onMAMPreferences).toHaveBeenCalled();

                expect(converse.connection.sendIQ.callCount).toBe(2);
                expect(sent_stanza.toString()).toBe(
                    "<iq type='set' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<prefs xmlns='urn:xmpp:mam:0' default='never'>"+
                            "<always><jid>romeo@montague.lit</jid></always>"+
                            "<never><jid>montague@montague.lit</jid></never>"+
                        "</prefs>"+
                    "</iq>"
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
                converse.connection._dataRecv(test_utils.createRequest(stanza));
                expect(feature.save).toHaveBeenCalled();
                expect(feature.get('preferences').default).toBe('never');

                // Restore
                converse.message_archiving = 'never';
            });
        }, converse, mock, test_utils));
    }, converse, mock, test_utils));
}));
