(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const Strophe = converse.env.Strophe;
    const u = converse.env.utils;


    describe("XMPP Ping", function () {

        describe("An IQ stanza", function () {

            it("is returned when converse.js gets pinged", mock.initConverse((done, _converse) => {
                const ping = u.toStanza(`
                    <iq from="${_converse.domain}"
                        to="${_converse.jid}" id="s2c1" type="get">
                        <ping xmlns="urn:xmpp:ping"/>
                    </iq>`);
                _converse.connection._dataRecv(test_utils.createRequest(ping));
                const sent_stanza = _converse.connection.IQ_stanzas.pop();
                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq id="s2c1" to="${_converse.domain}" type="result" xmlns="jabber:client"/>`);
                done();
            }));

            it("is sent out when converse.js pings a server", mock.initConverse((done, _converse) => {
                _converse.api.ping();
                const sent_stanza = _converse.connection.IQ_stanzas.pop();
                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq id="${sent_stanza.getAttribute('id')}" to="montague.lit" type="get" xmlns="jabber:client">`+
                        `<ping xmlns="urn:xmpp:ping"/>`+
                    `</iq>`);
                done();
            }));
        });
    });
}));
