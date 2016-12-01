(function (root, factory) {
    define(["mock", "converse-api", "test_utils", "converse-ping"], factory);
} (this, function (mock, converse_api, test_utils) {
    "use strict";

    describe("XMPP Ping", function () {
        describe("Ping and pong handlers", function () {
            afterEach(function () {
                converse_api.user.logout();
                test_utils.clearBrowserStorage();
            });

            it("are registered when converse.js is connected", mock.initConverse(function (converse) {
                spyOn(converse, 'registerPingHandler').andCallThrough();
                spyOn(converse, 'registerPongHandler').andCallThrough();
                converse.emit('connected');
                expect(converse.registerPingHandler).toHaveBeenCalled();
                expect(converse.registerPongHandler).toHaveBeenCalled();
            }));

            it("are registered when converse.js reconnected", mock.initConverse(function (converse) {
                spyOn(converse, 'registerPingHandler').andCallThrough();
                spyOn(converse, 'registerPongHandler').andCallThrough();
                converse.emit('reconnected');
                expect(converse.registerPingHandler).toHaveBeenCalled();
                expect(converse.registerPongHandler).toHaveBeenCalled();
            }));
        });

        describe("An IQ stanza", function () {
            afterEach(function () {
                converse_api.user.logout();
                test_utils.clearBrowserStorage();
            });

            it("is sent out when converse.js pings a server", mock.initConverse(function (converse) {
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
            }));
        });
    });
}));
