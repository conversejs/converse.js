(function (root, factory) {
    define(["mock", "converse-core", "test_utils"], factory);
} (this, function (mock, converse, test_utils) {
    var $ = converse.env.jQuery;

    return describe("The XMPPStatus model", function() {

        it("won't send <show>online</show> when setting a custom status message", mock.initConverse(function (_converse) {
            _converse.xmppstatus.save({'status': 'online'});
            spyOn(_converse.xmppstatus, 'setStatusMessage').andCallThrough();
            spyOn(_converse.connection, 'send');
            _converse.xmppstatus.setStatusMessage("I'm also happy!");
            expect(_converse.connection.send).toHaveBeenCalled();
            var $stanza = $(_converse.connection.send.argsForCall[0][0].tree());
            expect($stanza.children().length).toBe(2);
            expect($stanza.children('status').length).toBe(1);
            expect($stanza.children('status').text()).toBe("I'm also happy!");
            expect($stanza.children('show').length).toBe(0);
            expect($stanza.children('priority').length).toBe(1);
            expect($stanza.children('priority').text()).toBe('0');
        }));
    });
}));
