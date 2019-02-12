(function (root, factory) {
    define(["jasmine", "mock", "test-utils"], factory);
} (this, function (jasmine, mock, test_utils) {

    return describe("The XMPPStatus model", function () {

        it("won't send <show>online</show> when setting a custom status message", mock.initConverse((done, _converse) => {
            _converse.xmppstatus.save({'status': 'online'});
            spyOn(_converse.connection, 'send');
            _converse.api.user.status.message.set("I'm also happy!");
            expect(_converse.connection.send).toHaveBeenCalled();
            const stanza = _converse.connection.send.calls.argsFor(0)[0].tree();
            expect(stanza.childNodes.length).toBe(3);
            expect(stanza.querySelectorAll('status').length).toBe(1);
            expect(stanza.querySelector('status').textContent).toBe("I'm also happy!");
            expect(stanza.querySelectorAll('show').length).toBe(0);
            expect(stanza.querySelectorAll('priority').length).toBe(1);
            expect(stanza.querySelector('priority').textContent).toBe('0');
            done();
        }));
    });
}));
