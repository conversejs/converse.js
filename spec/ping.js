(function (root, factory) {
    define(["mock", "converse-core", "test_utils", "converse-ping"], factory);
} (this, function (mock, test_utils) {
    "use strict";

    describe("XMPP Ping", function () {
        describe("Ping and pong handlers", function () {

            it("are registered when _converse.js is connected", mock.initConverse(function (_converse) {
                spyOn(_converse, 'registerPingHandler').andCallThrough();
                spyOn(_converse, 'registerPongHandler').andCallThrough();
                _converse.emit('connected');
                expect(_converse.registerPingHandler).toHaveBeenCalled();
                expect(_converse.registerPongHandler).toHaveBeenCalled();
            }));

            it("are registered when _converse.js reconnected", mock.initConverse(function (_converse) {
                spyOn(_converse, 'registerPingHandler').andCallThrough();
                spyOn(_converse, 'registerPongHandler').andCallThrough();
                _converse.emit('reconnected');
                expect(_converse.registerPingHandler).toHaveBeenCalled();
                expect(_converse.registerPongHandler).toHaveBeenCalled();
            }));
        });

        describe("An IQ stanza", function () {

            it("is sent out when _converse.js pings a server", mock.initConverse(function (_converse) {
                var sent_stanza, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').andCallFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.ping();
                expect(sent_stanza.toLocaleString()).toBe(
                    "<iq type='get' to='localhost' id='"+IQ_id+"' xmlns='jabber:client'>"+
                        "<ping xmlns='urn:xmpp:ping'/>"+
                    "</iq>");
            }));
        });
    });
}));
