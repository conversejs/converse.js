(function (root, factory) {
    define([
        "mock",
        "test_utils"
        ], function (mock, test_utils) {
            return factory(mock, test_utils);
        }
    );
} (this, function (mock, test_utils) {
    return describe("Converse", $.proxy(function(mock, test_utils) {

        beforeEach($.proxy(function () {
            window.localStorage.clear();
            window.sessionStorage.clear();
        }, converse));

        it("has an API method for retrieving the next RID", $.proxy(function () {
            var old_connection = converse.connection;
            converse.connection._proto.rid = '1234';
            converse.expose_rid_and_sid = false;
            expect(converse_api.getRID()).toBe(null);

            converse.expose_rid_and_sid = true;
            expect(converse_api.getRID()).toBe('1234');

            converse.connection = undefined;
            expect(converse_api.getRID()).toBe(null);
            // Restore the connection
            converse.connection = old_connection;
        }, converse));

        it("has an API method for retrieving the SID", $.proxy(function () {
            var old_connection = converse.connection;
            converse.connection._proto.sid = '1234';
            converse.expose_rid_and_sid = false;
            expect(converse_api.getSID()).toBe(null);

            converse.expose_rid_and_sid = true;
            expect(converse_api.getSID()).toBe('1234');

            converse.connection = undefined;
            expect(converse_api.getSID()).toBe(null);
            // Restore the connection
            converse.connection = old_connection;
        }, converse));
    }, converse, mock, test_utils));
}));
