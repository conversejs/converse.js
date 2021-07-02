/*global mock, converse */

const u = converse.env.utils;

describe("The XMPPStatus model", function () {

    it("won't send <show>online</show> when setting a custom status message",
            mock.initConverse(async (_converse) => {

        const sent_stanzas = _converse.connection.sent_stanzas;
        await _converse.api.user.status.set('online');
        _converse.api.user.status.message.set("I'm also happy!");

        const stanza = await u.waitUntil(() => sent_stanzas.filter(s => s.matches('presence')).pop());
        expect(stanza.childNodes.length).toBe(3);
        expect(stanza.querySelectorAll('status').length).toBe(1);
        expect(stanza.querySelector('status').textContent).toBe("I'm also happy!");
        expect(stanza.querySelectorAll('show').length).toBe(0);
        expect(stanza.querySelectorAll('priority').length).toBe(1);
        expect(stanza.querySelector('priority').textContent).toBe('0');
    }));
});
