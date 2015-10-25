/*global converse */
(function (root, factory) {
    define([
        "jquery",
        "mock",
        "test_utils"
        ], function ($, mock, test_utils) {
            return factory($, mock, test_utils);
        }
    );
} (this, function ($, mock, test_utils) {
    return describe("The XMPPStatus model", $.proxy(function(mock, test_utils) {
        beforeEach($.proxy(function () {
            window.localStorage.clear();
            window.sessionStorage.clear();
        }, converse));
        it("won't send <show>online when setting a custom status message", $.proxy(function () {
            this.xmppstatus.save({'status': 'online'});
            spyOn(this.xmppstatus, 'setStatusMessage').andCallThrough();
            spyOn(converse.connection, 'send');
            this.xmppstatus.setStatusMessage("I'm also happy!");
            runs (function () {
                expect(converse.connection.send).toHaveBeenCalled();
                var $stanza = $(converse.connection.send.argsForCall[0][0].tree());
                expect($stanza.children().length).toBe(1);
                expect($stanza.children('show').length).toBe(0);
            });
        }, converse));
    }, converse, mock, test_utils));
}));
