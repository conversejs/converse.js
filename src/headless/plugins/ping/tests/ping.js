/*global mock, converse */

const Strophe = converse.env.Strophe;
const u = converse.env.utils;


describe("XMPP Ping", function () {

    describe("An IQ stanza", function () {

        it("is returned when converse.js gets pinged",
                mock.initConverse(['statusInitialized'], {}, (_converse) => {
            const ping = u.toStanza(`
                <iq from="${_converse.domain}"
                    to="${_converse.jid}" id="s2c1" type="get">
                    <ping xmlns="urn:xmpp:ping"/>
                </iq>`);
            _converse.connection._dataRecv(mock.createRequest(ping));
            const sent_stanza = _converse.connection.IQ_stanzas.pop();
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq id="s2c1" to="${_converse.domain}" type="result" xmlns="jabber:client"/>`);
        }));

        it("is sent out when converse.js pings a server", mock.initConverse(['statusInitialized'], {}, (_converse) => {
            _converse.api.ping();
            const sent_stanza = _converse.connection.IQ_stanzas.pop();
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq id="${sent_stanza.getAttribute('id')}" to="montague.lit" type="get" xmlns="jabber:client">`+
                    `<ping xmlns="urn:xmpp:ping"/>`+
                `</iq>`);
        }));

        it("is not sent out if we're not connected", mock.initConverse(async (_converse) => {
            spyOn(_converse.connection, 'send');
            expect(await _converse.api.ping()).toBe(null);
            expect(_converse.connection.send.calls.count()).toBe(0);
        }));
    });
});
