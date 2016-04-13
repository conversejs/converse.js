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
    var b64_sha1 = converse_api.env.b64_sha1;

    return describe("The OTR module", function() {

        it("can store a session passphrase in session storage", function () {
            // With no prebind, the user's XMPP password is used and nothing is
            // stored in session storage.
            var auth = converse.authentication;
            var pass = converse.connection.pass;
            converse.authentication = "manual";
            converse.connection.pass = 's3cr3t!';
            expect(converse.otr.getSessionPassphrase()).toBe(converse.connection.pass);

            // With prebind, a random passphrase is generated and stored in
            // session storage.
            converse.authentication = "prebind";
            var pp = converse.otr.getSessionPassphrase();
            expect(pp).not.toBe(converse.connection.pass);
            expect(pp).toBe(window.sessionStorage[b64_sha1(converse.connection.jid)]);

            // Clean up
            converse.authentication = auth;
            converse.connection.pass = pass;
        });
    });
}));
