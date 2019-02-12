(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";

    describe("XMPP Ping", function () {
        describe("Ping and pong handlers", function () {

            it("are registered when _converse.js is connected",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                spyOn(_converse, 'registerPingHandler').and.callThrough();
                spyOn(_converse, 'registerPongHandler').and.callThrough();
                _converse.emit('connected');
                expect(_converse.registerPingHandler).toHaveBeenCalled();
                expect(_converse.registerPongHandler).toHaveBeenCalled();
                done();
            }));

            it("are registered when _converse.js reconnected",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

                spyOn(_converse, 'registerPingHandler').and.callThrough();
                spyOn(_converse, 'registerPongHandler').and.callThrough();
                _converse.emit('reconnected');
                expect(_converse.registerPingHandler).toHaveBeenCalled();
                expect(_converse.registerPongHandler).toHaveBeenCalled();
                done();
            }));
        });

        describe("An IQ stanza", function () {

            it("is sent out when _converse.js pings a server", mock.initConverse((done, _converse) => {
                let sent_stanza, IQ_id;
                const sendIQ = _converse.connection.sendIQ;
                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                _converse.ping();
                expect(sent_stanza.toLocaleString()).toBe(
                    `<iq id="${IQ_id}" to="localhost" type="get" xmlns="jabber:client">`+
                        `<ping xmlns="urn:xmpp:ping"/>`+
                    `</iq>`);
                done();
            }));
        });
    });
}));
