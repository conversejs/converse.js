(function (root, factory) {
    define([
        "jasmine",
        "jquery",
        "converse-core",
        "mock",
        "test-utils"], factory);
} (this, function (jasmine, $, converse, mock, test_utils) {
    "use strict";
    var Strophe = converse.env.Strophe;

    describe("Service Discovery", function () {
        describe("Whenever converse.js discovers a new server feature", function () {
           it("emits the serviceDiscovered event", mock.initConverse(function (_converse) {
                sinon.spy(_converse, 'emit');
                _converse.features.create({'var': Strophe.NS.MAM});
                expect(_converse.emit.called).toBe(true);
                expect(_converse.emit.args[0][1].get('var')).toBe(Strophe.NS.MAM);
            }));
        });
    });
}));
