(function (root, factory) {
    define(["mock", "converse-api", "test_utils"], factory);
} (this, function (mock, converse_api, test_utils) {
    var $ = converse_api.env.jQuery;

    return describe("The XMPPStatus model", function() {
        afterEach(function () {
            converse_api.user.logout();
            test_utils.clearBrowserStorage();
        });

        it("won't send <show>online when setting a custom status message", mock.initConverse(function (converse) {
            converse.xmppstatus.save({'status': 'online'});
            spyOn(converse.xmppstatus, 'setStatusMessage').andCallThrough();
            spyOn(converse.connection, 'send');
            converse.xmppstatus.setStatusMessage("I'm also happy!");
            runs (function () {
                expect(converse.connection.send).toHaveBeenCalled();
                var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
                expect($stanza.children().length).toBe(1);
                expect($stanza.children('show').length).toBe(0);
            });
        }));
    });
}));
