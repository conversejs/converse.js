(function (root, factory) {
    define([
        "mock",
        "test_utils"
        ], function (mock, test_utils) {
            return factory(mock, test_utils);
        }
    );
} (this, function (mock, test_utils) {
    return describe("The OTR module", $.proxy(function(mock, test_utils) {

        beforeEach($.proxy(function () {
            window.localStorage.clear();
            window.sessionStorage.clear();
        }, converse));

        it("can store a session passphrase in session storage", $.proxy(function () {
            var pp;
            // With no prebind, the user's XMPP password is used and nothing is
            // stored in session storage.
            this.prebind = false;
            this.connection.pass = 's3cr3t!';
            expect(this.otr.getSessionPassphrase()).toBe(this.connection.pass);
            expect(window.sessionStorage.length).toBe(0);
            expect(window.localStorage.length).toBe(0);

            // With prebind, a random passphrase is generated and stored in
            // session storage.
            this.prebind = true;
            pp = this.otr.getSessionPassphrase();
            expect(pp).not.toBe(this.connection.pass);
            expect(window.sessionStorage.length).toBe(1);
            expect(window.localStorage.length).toBe(0);
            expect(pp).toBe(window.sessionStorage[b64_sha1(converse.connection.jid)]);

            // Clean up
            this.prebind = false;
        }, converse));
    }, converse, mock, test_utils));
}));
