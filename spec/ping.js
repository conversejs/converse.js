/*global converse */
(function (root, factory) {
    define([
        "jquery",
        "mock",
        "test_utils",
        "converse-ping"
        ], function ($, mock, test_utils) {
            return factory($, mock, test_utils);
        }
    );
} (this, function ($, mock, test_utils) {
    "use strict";

    describe("XMPP Ping", $.proxy(function (mock, test_utils) {
        describe("Ping and pong handlers", $.proxy(function (mock, test_utils) {
            it("are registered when converse.js is initialized", $.proxy(function () {
                spyOn(converse, 'registerPingHandler').andCallThrough();
                spyOn(converse, 'registerPongHandler').andCallThrough();
                converse._initialize();
                expect(converse.registerPingHandler).toHaveBeenCalled();
                expect(converse.registerPongHandler).toHaveBeenCalled();
            }, converse, mock, test_utils));
        }));

        describe("An IQ stanza", $.proxy(function (mock, test_utils) {
            it("is sent out when converse.js pings a server", function () {
                var sent_stanza, IQ_id;
                var sendIQ = converse.connection.sendIQ;
                spyOn(converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                converse.ping();
                expect(sent_stanza.toLocaleString()).toBe(
                    "<iq type='get' to='localhost' id='"+IQ_id+"' xmlns='jabber:client'>"+
                        "<ping xmlns='urn:xmpp:ping'/>"+
                    "</iq>");
            });
        }));
    }, converse, mock, test_utils));
}));
